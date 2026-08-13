import { describe, expect, it } from 'vitest'

import {
  getRetrievability,
  normalizeFsrsSchedulingOptions,
  scheduleReview,
  createInitialFsrsCard,
} from '@/lib/fsrs'

import {
  buildConsistencyPoints,
  buildOverdueBacklogPoints,
  buildRatingsMixPoints,
  buildRecallQualityPoints,
  buildRetentionHealth,
  buildStabilityPoints,
  buildTopicPoints,
  buildUpcomingLoadPoints,
  type AnalyticsReviewEvent,
} from './chart-data'
import { metricDefinitions } from './metric-definitions'

const start = new Date('2026-08-01T00:00:00.000Z')
const end = new Date('2026-08-03T23:59:59.999Z')
const options = {
  start,
  end,
  fsrsOptions: normalizeFsrsSchedulingOptions(),
  lowSampleThreshold: 2,
}
const validLog = (stability: number) =>
  JSON.stringify({
    rating: 'good',
    state: 'review',
    dueAt: '2026-08-01T12:00:00.000Z',
    stability,
    difficulty: 5,
    elapsedDays: 1,
    lastElapsedDays: 1,
    scheduledDays: 4,
    learningSteps: 0,
    reviewedAt: '2026-08-01T12:00:00.000Z',
  })

function event(
  overrides: Partial<AnalyticsReviewEvent> = {},
): AnalyticsReviewEvent {
  return {
    id: '1',
    cardId: 'card-1',
    problemSlug: 'two-sum',
    title: 'Two Sum',
    topicLabels: ['Array'],
    rating: 'good',
    reviewedAt: new Date('2026-08-01T12:00:00.000Z'),
    isCorrect: true,
    fsrsReviewLog: validLog(4),
    ...overrides,
  }
}

describe('analytics chart-data builders', () => {
  it('describes persisted correctness without inventing retry exclusion', () => {
    expect(metricDefinitions.observedCorrectness.label).toBe(
      'Observed correctness',
    )
    expect(metricDefinitions.observedCorrectness.explanation).toContain(
      'does not identify retries',
    )
    expect(metricDefinitions.overdueBacklog.lowSampleOrEmptyState).toContain(
      'not complete',
    )
  })

  it('builds daily observed and pre-review predicted recall with null empty samples', () => {
    const points = buildRecallQualityPoints(
      [
        event(),
        event({
          id: '2',
          cardId: 'card-2',
          isCorrect: false,
          rating: 'again',
          reviewedAt: new Date('2026-08-02T12:00:00.000Z'),
        }),
      ],
      options,
    )
    expect(
      points.map(
        ({ date, reviewCount, eligibleSampleSize, observedRecall }) => ({
          date,
          reviewCount,
          eligibleSampleSize,
          observedRecall,
        }),
      ),
    ).toEqual([
      {
        date: '2026-08-01',
        reviewCount: 1,
        eligibleSampleSize: 1,
        observedRecall: 1,
      },
      {
        date: '2026-08-02',
        reviewCount: 1,
        eligibleSampleSize: 1,
        observedRecall: 0,
      },
      {
        date: '2026-08-03',
        reviewCount: 0,
        eligibleSampleSize: 0,
        observedRecall: null,
      },
    ])
    expect(points[0]!.predictedRecall).not.toBeNull()
  })

  it('keeps no eligible assessments unknown and handles zero-review days', () => {
    const points = buildRecallQualityPoints(
      [event({ isCorrect: null })],
      options,
    )
    expect(points[0]!.observedRecall).toBeNull()
    expect(points[2]!.reviewCount).toBe(0)
  })

  it('replays multiple cards with the configured normalized FSRS options', () => {
    const fsrsOptions = normalizeFsrsSchedulingOptions({
      targetRetention: 0.75,
      enableShortTerm: false,
      learningSteps: ['1d'],
      relearningSteps: ['2d'],
    })
    const configuredOptions = { ...options, fsrsOptions }
    const firstReview = event({
      reviewedAt: new Date('2026-08-01T12:00:00.000Z'),
    })
    const secondCardReview = event({
      id: '2',
      cardId: 'card-2',
      reviewedAt: new Date('2026-08-02T12:00:00.000Z'),
      rating: 'easy',
    })
    const repeatReview = event({
      id: '3',
      cardId: 'card-1',
      reviewedAt: new Date('2026-08-03T12:00:00.000Z'),
      rating: 'again',
    })
    const points = buildRecallQualityPoints(
      [firstReview, secondCardReview, repeatReview],
      configuredOptions,
    )
    let card = createInitialFsrsCard(firstReview.reviewedAt)
    card = scheduleReview(
      card,
      'good',
      firstReview.reviewedAt,
      fsrsOptions,
    ).card
    const expectedBeforeRepeat = getRetrievability(
      card,
      repeatReview.reviewedAt,
      fsrsOptions,
    )
    const expectedBeforeSecondCardReview = getRetrievability(
      createInitialFsrsCard(secondCardReview.reviewedAt),
      secondCardReview.reviewedAt,
      fsrsOptions,
    )

    expect(points[2]!.predictedRecall).toBeCloseTo(expectedBeforeRepeat)
    expect(points[1]!.predictedRecall).toBeCloseTo(
      expectedBeforeSecondCardReview,
    )
    expect(points.map((point) => point.reviewCount)).toEqual([1, 1, 1])
  })

  it('groups consistency by local week as association-only', () => {
    const points = buildConsistencyPoints(
      [
        event(),
        event({
          id: '2',
          reviewedAt: new Date('2026-08-02T12:00:00.000Z'),
          isCorrect: false,
        }),
      ],
      options,
    )
    expect(points[0]).toMatchObject({
      reviewDays: 2,
      firstPassRecall: 0.5,
      sampleSize: 2,
      associationOnly: true,
    })
  })

  it('builds rating mix, including null Hard + Again on empty days', () => {
    const points = buildRatingsMixPoints(
      [event({ rating: 'hard' }), event({ id: '2', rating: 'again' })],
      options,
    )
    expect(points[0]).toMatchObject({
      hard: 1,
      again: 1,
      total: 2,
      hardAgainShare: 1,
    })
    expect(points[2]!.hardAgainShare).toBeNull()
  })

  it('filters rating mix by exact start and end timestamps', () => {
    const points = buildRatingsMixPoints(
      [
        event({ id: 'before', reviewedAt: new Date(start.getTime() - 1) }),
        event({ id: 'start', reviewedAt: start, rating: 'hard' }),
        event({ id: 'end', reviewedAt: end, rating: 'again' }),
        event({ id: 'after', reviewedAt: new Date(end.getTime() + 1) }),
      ],
      options,
    )

    expect(points[0]).toMatchObject({ hard: 1, total: 1 })
    expect(points[2]).toMatchObject({ again: 1, total: 1 })
  })

  it('groups weakest topics, skips missing topics, and marks low samples', () => {
    const points = buildTopicPoints(
      [
        event(),
        event({ id: '2', topicLabels: ['Graph'], isCorrect: false }),
        event({ id: '3', topicLabels: ['Array'], isCorrect: false }),
      ],
      options,
    )
    expect(points.map((point) => point.topic)).toEqual(['Graph', 'Array'])
    expect(points.every((point) => point.lowSample)).toBe(false)
  })

  it('uses only valid stored stability logs and stable weekly ordering', () => {
    const points = buildStabilityPoints(
      [
        event({ fsrsReviewLog: validLog(2) }),
        event({ id: '2', fsrsReviewLog: 'bad' }),
        event({
          id: '3',
          reviewedAt: new Date('2026-08-03T12:00:00.000Z'),
          fsrsReviewLog: validLog(6),
        }),
      ],
      options,
    )
    expect(points).toEqual([
      { week: '2026-07-27', medianStabilityDays: 2, sampleSize: 1 },
      { week: '2026-08-03', medianStabilityDays: 6, sampleSize: 1 },
    ])
  })

  it('returns an explicit unavailable overdue history boundary', () => {
    expect(buildOverdueBacklogPoints(null, options)).toEqual([])
    expect(
      buildOverdueBacklogPoints(
        [{ date: new Date('2026-08-02T12:00:00.000Z'), overdueCount: 3 }],
        options,
      ),
    ).toEqual([])
    const points = buildOverdueBacklogPoints(
      [
        { date: new Date('2026-08-01T12:00:00.000Z'), overdueCount: 1 },
        { date: new Date('2026-08-02T12:00:00.000Z'), overdueCount: 3 },
        { date: new Date('2026-08-03T12:00:00.000Z'), overdueCount: 2 },
      ],
      options,
    )
    expect(points).toHaveLength(3)
    expect(points.every((point) => point.historyAvailable)).toBe(true)
  })

  it('separates overdue and upcoming due load across the 14-day range', () => {
    const points = buildUpcomingLoadPoints(
      [
        new Date('2026-08-12T00:00:00.000Z'),
        new Date('2026-08-20T00:00:00.000Z'),
      ],
      new Date('2026-08-13T12:00:00.000Z'),
    )
    expect(points[0]).toMatchObject({
      overdueCount: 1,
      dueCount: 0,
      today: true,
    })
    expect(points[7]).toMatchObject({ dueCount: 1 })
  })

  it('sorts retention health deterministically and excludes suspended cards', () => {
    const result = buildRetentionHealth(
      [
        {
          slug: 'b',
          title: 'B',
          topics: ['Graph'],
          retrievability: 0.5,
          targetRetention: 0.9,
          stabilityDays: 2,
          difficulty: 5,
          lapseCount: 1,
          dueAt: start,
          lastReviewAt: start,
        },
        {
          slug: 'high-difficulty',
          title: 'High Difficulty',
          topics: ['Dynamic Programming'],
          retrievability: 0.95,
          targetRetention: 0.9,
          stabilityDays: 10,
          difficulty: 8,
          lapseCount: 0,
          dueAt: new Date(end.getTime() + 1),
          lastReviewAt: end,
        },
        {
          slug: 'steady',
          title: 'Steady',
          topics: ['Array'],
          retrievability: 0.95,
          targetRetention: 0.9,
          stabilityDays: 10,
          difficulty: 7,
          lapseCount: 0,
          dueAt: new Date(end.getTime() + 1),
          lastReviewAt: end,
        },
        {
          slug: 'a',
          title: 'A',
          topics: [],
          retrievability: 0.5,
          targetRetention: 0.9,
          stabilityDays: 5,
          difficulty: 3,
          lapseCount: 0,
          dueAt: start,
          lastReviewAt: start,
        },
        {
          slug: 'z',
          title: 'Z',
          topics: [],
          retrievability: 0.1,
          targetRetention: 0.9,
          stabilityDays: 1,
          difficulty: 3,
          lapseCount: 0,
          dueAt: start,
          lastReviewAt: start,
          suspended: true,
        },
      ],
      end,
      { fragileDifficultyThreshold: 8 },
    )
    expect(result.health.map((row) => row.slug)).toEqual([
      'a',
      'b',
      'high-difficulty',
      'steady',
    ])
    expect(result.fragile.map((row) => row.slug)).toEqual([
      'a',
      'b',
      'high-difficulty',
    ])
  })
})
