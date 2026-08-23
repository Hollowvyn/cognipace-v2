import { describe, expect, it } from 'vitest'

import {
  normalizeFsrsSchedulingOptions,
  replayReviewHistorySequence,
} from '@/lib/fsrs'

import {
  buildHistoricalAnalyticsViews,
  type HistoricalAnalyticsReviewEvent,
} from './historical-presentation'

const options = {
  buckets: [
    {
      key: '2026-08-01',
      start: new Date('2026-08-01T00:00:00.000Z'),
      end: new Date('2026-08-01T23:59:59.999Z'),
      label: '2026-08-01',
    },
    {
      key: '2026-08-02',
      start: new Date('2026-08-02T00:00:00.000Z'),
      end: new Date('2026-08-02T23:59:59.999Z'),
      label: '2026-08-02',
    },
  ],
  end: new Date('2026-08-02T23:59:59.999Z'),
  fsrsOptions: normalizeFsrsSchedulingOptions({ targetRetention: 0.9 }),
  start: new Date('2026-08-01T00:00:00.000Z'),
  timeZone: 'UTC',
}

function event(
  overrides: Partial<HistoricalAnalyticsReviewEvent> = {},
): HistoricalAnalyticsReviewEvent {
  return {
    cardId: 'card-1',
    fsrsReviewLog: JSON.stringify({
      rating: 'good',
      state: 'review',
      dueAt: '2026-08-01T12:00:00.000Z',
      stability: 6,
      difficulty: 5,
      elapsedDays: 1,
      lastElapsedDays: 1,
      scheduledDays: 4,
      learningSteps: 0,
      reviewedAt: '2026-08-01T12:00:00.000Z',
    }),
    id: 'one',
    problemSlug: 'problem-1',
    rating: 'good',
    reviewedAt: new Date('2026-08-01T12:00:00.000Z'),
    topicLabels: [],
    ...overrides,
  }
}

describe('buildHistoricalAnalyticsViews', () => {
  it('pairs rating-derived recalled outcomes with the FSRS estimate from the exact reviews', () => {
    const views = buildHistoricalAnalyticsViews(
      [
        event(),
        event({
          id: 'two',
          rating: 'again',
          reviewedAt: new Date('2026-08-01T13:00:00.000Z'),
        }),
      ],
      options,
    )

    expect(views.observedRecallVsFsrs.rows[0]).toMatchObject({
      recalledCount: 1,
      pairedReviews: 2,
      observedRecall: 0.5,
      provenance: 'reconstructed',
    })
    expect(views.observedRecallVsFsrs.rows[0]?.fsrsEstimate).not.toBeNull()
    expect(views.observedRecallVsFsrs.rows[0]?.difference).not.toBeNull()
  })

  it('keeps known zero-practice buckets at zero and their Review Success unknown', () => {
    const views = buildHistoricalAnalyticsViews([event()], options)

    expect(views.practiceRhythm.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          completedReviews: 0,
          goodEasy: 0,
          reviewSuccess: null,
          validRatings: 0,
        }),
      ]),
    )
  })

  it('only exposes a memory-strength IQR when a bucket has four eligible reviews', () => {
    const withThree = buildHistoricalAnalyticsViews(
      Array.from({ length: 3 }, (_, index) =>
        event({
          id: `three-${index}`,
          reviewedAt: new Date(
            `2026-08-01T${String(10 + index).padStart(2, '0')}:00:00.000Z`,
          ),
        }),
      ),
      options,
    )
    const withFour = buildHistoricalAnalyticsViews(
      Array.from({ length: 4 }, (_, index) =>
        event({
          id: `four-${index}`,
          reviewedAt: new Date(
            `2026-08-01T${String(10 + index).padStart(2, '0')}:00:00.000Z`,
          ),
        }),
      ),
      options,
    )

    expect(withThree.memoryStrength.rows[0]).toMatchObject({
      q1: null,
      q3: null,
    })
    expect(withFour.memoryStrength.rows[0]).toMatchObject({
      eligibleReviews: 4,
      provenance: 'reconstructed',
    })
    expect(withFour.memoryStrength.rows[0]?.q1).not.toBeNull()
    expect(withFour.memoryStrength.rows[0]?.q3).not.toBeNull()
  })

  it('derives post-review Memory Strength from the replayed post-review card rather than the stored log snapshot', () => {
    const reviewedAt = new Date('2026-08-01T12:00:00.000Z')
    const replayedPostReview = replayReviewHistorySequence(
      [{ rating: 'good', reviewedAt }],
      options.fsrsOptions,
    )[0]!.card.stability
    const views = buildHistoricalAnalyticsViews(
      [
        event({
          fsrsReviewLog: JSON.stringify({
            rating: 'good',
            state: 'review',
            dueAt: '2026-08-01T12:00:00.000Z',
            stability: 999,
            difficulty: 5,
            elapsedDays: 1,
            lastElapsedDays: 1,
            scheduledDays: 4,
            learningSteps: 0,
            reviewedAt: '2026-08-01T12:00:00.000Z',
          }),
          reviewedAt,
        }),
      ],
      options,
    )

    expect(views.memoryStrength.rows[0]?.medianStrengthDays).toBeCloseTo(
      replayedPostReview,
    )
    expect(views.memoryStrength.rows[0]?.medianStrengthDays).not.toBe(999)
  })

  it('builds valid-rating composition rows with zero categories and no invented empty stack', () => {
    const views = buildHistoricalAnalyticsViews(
      [
        event({ id: 'again', rating: 'again' }),
        event({ id: 'good', rating: 'good' }),
        event({ id: 'invalid', rating: 'unknown' }),
      ],
      options,
    )

    expect(views).toMatchObject({
      ratingsMix: {
        rows: [
          {
            again: 1,
            hard: 0,
            good: 1,
            easy: 0,
            validRatings: 2,
            againShare: 0.5,
            hardShare: 0,
            goodShare: 0.5,
            easyShare: 0,
            challengingReviews: 1,
            evidence: 'measured',
          },
          {
            validRatings: 0,
            againShare: null,
            hardShare: null,
            goodShare: null,
            easyShare: null,
            evidence: 'not-measured',
          },
        ],
      },
    })
  })

  it('ranks only the five lowest qualifying normalized topics by Good + Easy Review Success', () => {
    const reviews = Array.from({ length: 10 }, (_, index) =>
      event({
        cardId: `graph-${index % 3}`,
        id: `graph-${index}`,
        problemSlug: `graph-${index % 3}`,
        rating: index < 4 ? 'again' : 'good',
        topicLabels: ['Graphs', 'graphs', ' Graphs '],
      }),
    ).concat(
      Array.from({ length: 10 }, (_, index) =>
        event({
          cardId: `array-${index % 3}`,
          id: `array-${index}`,
          problemSlug: `array-${index % 3}`,
          rating: 'easy',
          topicLabels: ['Arrays'],
        }),
      ),
    )

    const views = buildHistoricalAnalyticsViews(reviews, options)

    expect(views).toMatchObject({
      topicPerformance: {
        rows: [
          {
            topic: 'Graphs',
            reviewSuccess: 0.6,
            goodEasy: 6,
            validRatings: 10,
            distinctProblems: 3,
            evidence: 'Measured',
          },
          {
            topic: 'Arrays',
            reviewSuccess: 1,
            goodEasy: 10,
            validRatings: 10,
            distinctProblems: 3,
            evidence: 'Measured',
          },
        ],
        strongerQualifyingTopics: 0,
      },
    })
  })

  it('retains only five qualifying topics and counts stronger qualifiers separately', () => {
    const reviews = Array.from({ length: 6 }, (_, topicIndex) =>
      Array.from({ length: 10 }, (_, reviewIndex) =>
        event({
          cardId: `topic-${topicIndex}-${reviewIndex % 3}`,
          id: `topic-${topicIndex}-${reviewIndex}`,
          problemSlug: `topic-${topicIndex}-${reviewIndex % 3}`,
          rating: reviewIndex < topicIndex ? 'good' : 'again',
          topicLabels: [`Topic ${topicIndex}`],
        }),
      ),
    ).flat()

    const views = buildHistoricalAnalyticsViews(reviews, options)

    expect(views.topicPerformance.rows).toHaveLength(5)
    expect(views.topicPerformance.rows.map((row) => row.topic)).toEqual([
      'Topic 0',
      'Topic 1',
      'Topic 2',
      'Topic 3',
      'Topic 4',
    ])
    expect(views.topicPerformance.strongerQualifyingTopics).toBe(1)
  })
})
