import { describe, expect, it } from 'vitest'

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

const start = new Date('2026-08-01T00:00:00.000Z')
const end = new Date('2026-08-03T23:59:59.999Z')
const options = { start, end, targetRetention: 0.9, lowSampleThreshold: 2 }
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
    const points = buildOverdueBacklogPoints(
      [{ date: new Date('2026-08-02T12:00:00.000Z'), overdueCount: 3 }],
      options,
    )
    expect(points[0]).toMatchObject({ historyAvailable: false })
    expect(points[1]).toMatchObject({ overdueCount: 3, historyAvailable: true })
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
    )
    expect(result.health.map((row) => row.slug)).toEqual(['a', 'b'])
    expect(result.fragile.map((row) => row.slug)).toEqual(['a', 'b'])
  })
})
