import { describe, expect, it } from 'vitest'

import { eq } from 'drizzle-orm'

import {
  createInitialFsrsCard,
  defaultFsrsCardKind,
  scheduleReview,
  serializeFsrsReviewLogSnapshot,
  type ReviewRating,
} from '@/lib/fsrs'

import type { Db } from '@/platform/db'
import { createTestDb } from '@/platform/db/test-db'
import {
  fsrsCards,
  problemPractice,
  problemTopics,
  problems,
  reviewAttempts,
  topics,
} from '@/platform/db/schema'

import { updateSettings } from '@/features/settings/server/settings-service'
import { analyticsSummarySchema } from '../api/analytics-contracts'
import { getAnalyticsSummary } from './analytics-service'

describe('getAnalyticsSummary service regressions', () => {
  it.each([90, 120, 'all'] as const)(
    'retains the selected %s range in the evidence-backed contract',
    async (range) => {
      const handle = await createTestDb({ seed: false })
      const now = new Date('2026-01-15T12:00:00.000Z')

      const summary = await getAnalyticsSummary(handle.db, { range, now })

      expect(summary.range).toBe(range)
      expect(summary.timeFrame.requestedRange).toBe(range)
      expect(summary.observedRatingQuality).toBeNull()
      expect(summary).not.toHaveProperty('historicalReadiness')
      expect(summary.predictedRecall).toEqual({
        value: null,
        sampleSize: 0,
        lowSample: true,
      })
      expect(summary.views.observedRecallVsFsrs.evidence).toMatchObject({
        observations: 0,
        measuredBuckets: 0,
        displayMode: 'table',
        tableOnly: true,
      })
      expect(summary.views.memoryStrength.evidence).toMatchObject({
        observations: 0,
        measuredBuckets: 0,
        displayMode: 'table',
        tableOnly: true,
      })
      expect(summary.views.practiceRhythm.evidence).toMatchObject({
        observations: 0,
        measuredBuckets: 0,
        displayMode: 'table',
        tableOnly: true,
      })
      expect(summary.views.ratingsMix.evidence).toMatchObject({
        observations: 0,
        measuredBuckets: 0,
        displayMode: 'table',
        tableOnly: true,
      })
      expect(summary.views.upcomingReviewLoad.rows).toHaveLength(14)
    },
  )

  it('returns truthful chart payloads for an empty database', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-01-15T12:00:00.000Z')

    const summary = await getAnalyticsSummary(handle.db, { range: 120, now })

    expect(summary.timeFrame.requestedRange).toBe(120)
    expect(summary.predictedRecall).toEqual({
      value: null,
      sampleSize: 0,
      lowSample: true,
    })
    expect(
      summary.recallQuality.every((point) => point.observedRecall === null),
    ).toBe(true)
    expect(summary.topics).toEqual([])
    expect(
      summary.stability.every(
        (point) => point.medianStabilityDays === null && point.sampleSize === 0,
      ),
    ).toBe(true)
    expect(summary.views.overdueBacklog.knownDays).toBe(0)
    expect(summary.views.upcomingReviewLoad.rows).toHaveLength(14)
    expect(
      summary.views.upcomingReviewLoad.rows.every(
        (point) => point.dueCount === 0,
      ),
    ).toBe(true)
  })

  it('counts same-day pre-review predictions individually in the summary', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-08-03T12:00:00.000Z')
    const firstReview = new Date('2026-08-02T12:00:00.000Z')
    const secondReview = new Date('2026-08-02T12:05:00.000Z')

    await insertAnalyticsProblem(handle.db, 'same-day-problem', 'Same Day', [])
    await insertAnalyticsHistory(handle.db, 'same-day-problem', {
      id: 'same-day-card:default',
      dates: [firstReview, secondReview],
      ratings: ['good', 'hard'],
      correct: [true, true],
      dueAt: new Date('2026-08-04T12:00:00.000Z'),
      stability: 4,
      difficulty: 5,
    })

    const summary = await getAnalyticsSummary(handle.db, { range: 90, now })
    const day = summary.recallQuality.find((point) => point.reviewCount === 2)

    expect(summary.predictedRecall.sampleSize).toBe(2)
    expect(summary.predictedRecall.lowSample).toBe(true)
    expect(day).toMatchObject({ reviewCount: 2 })
  })

  it('excludes future-dated reviews from observed rating quality', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-01-31T12:00:00.000Z')
    const inRangeDates = Array.from(
      { length: 10 },
      (_, index) =>
        new Date(
          `2026-01-${String(20 + index).padStart(2, '0')}T12:00:00.000Z`,
        ),
    )

    await insertAnalyticsProblem(
      handle.db,
      'bounded-problem',
      'Bounded Problem',
      [],
    )
    await insertAnalyticsHistory(handle.db, 'bounded-problem', {
      id: 'bounded-card:default',
      dates: inRangeDates,
      ratings: Array<ReviewRating>(10).fill('good'),
      correct: Array<boolean>(10).fill(true),
      dueAt: new Date('2026-02-01T12:00:00.000Z'),
      stability: 8,
      difficulty: 5,
    })
    const futureTimestamp = new Date('2026-02-01T12:00:00.001Z').getTime()
    await handle.db.insert(reviewAttempts).values({
      id: 'future-review',
      problemSlug: 'bounded-problem',
      cardId: 'bounded-card:default',
      rating: 'again',
      reviewMode: 'manual',
      reviewedAt: futureTimestamp,
      isCorrect: false,
      fsrsReviewLog: null,
      createdAt: futureTimestamp,
      updatedAt: futureTimestamp,
    })

    const summary = await getAnalyticsSummary(handle.db, { range: 90, now })

    expect(summary.observedRatingQuality).toBe(1)
    expect(summary.observedRatingSampleSize).toBe(10)
  })

  it('excludes same-local-day post-as-of reviews from Ratings Mix, Topic Performance, and its equivalent comparison', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-01-31T12:00:00.000Z')
    const previousDates = Array.from(
      { length: 14 },
      (_, index) => new Date(Date.UTC(2026, 0, 4 + index, 12)),
    )
    const selectedDates = Array.from(
      { length: 14 },
      (_, index) => new Date(Date.UTC(2026, 0, 18 + index, 12)),
    )
    const dates = [...previousDates, ...selectedDates]

    for (const index of [1, 2, 3]) {
      const slug = `post-as-of-graphs-${index}`
      await insertAnalyticsProblem(
        handle.db,
        slug,
        `Graphs ${index}`,
        index === 1 ? ['Graphs'] : [],
      )
      if (index > 1) {
        await handle.db.insert(problemTopics).values({
          problemSlug: slug,
          topicId: 'post-as-of-graphs-1:graphs',
        })
      }
      await insertAnalyticsHistory(handle.db, slug, {
        id: `${slug}-card:default`,
        dates,
        ratings: [
          ...Array<ReviewRating>(14).fill('again'),
          ...Array<ReviewRating>(14).fill('good'),
        ],
        correct: Array<boolean>(dates.length).fill(true),
        dueAt: new Date('2026-02-01T12:00:00.000Z'),
        stability: 8,
        difficulty: 5,
      })
    }

    const postAsOf = new Date('2026-01-31T13:00:00.000Z')
    await handle.db.insert(reviewAttempts).values({
      id: 'post-as-of-ratings-mix-review',
      problemSlug: 'post-as-of-graphs-1',
      cardId: 'post-as-of-graphs-1-card:default',
      rating: 'again',
      reviewMode: 'manual',
      reviewedAt: postAsOf.getTime(),
      isCorrect: false,
      fsrsReviewLog: null,
      createdAt: postAsOf.getTime(),
      updatedAt: postAsOf.getTime(),
    })

    const summary = await getAnalyticsSummary(handle.db, { range: 90, now })

    expect(summary.views.ratingsMix).toMatchObject({
      selectedHardAgain: 42,
      selectedValidRatings: 84,
      comparison: {
        direction: null,
        previousHardAgainShare: null,
        previousValidRatings: 0,
      },
    })
    expect(summary.views.topicPerformance.rows).toEqual([
      expect.objectContaining({
        topic: 'Graphs',
        reviewSuccess: 0.5,
        goodEasy: 42,
        validRatings: 84,
        distinctProblems: 3,
      }),
    ])
  })

  it('keeps never-reviewed cards in tracked and workload metrics, not fragile knowledge', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-01-31T12:00:00.000Z')

    await insertAnalyticsProblem(handle.db, 'new-problem', 'New Problem', [
      'Graphs',
    ])
    await insertNeverReviewedCard(handle.db, 'new-problem', {
      dueAt: new Date('2026-02-01T12:00:00.000Z'),
    })

    const summary = await getAnalyticsSummary(handle.db, { range: 90, now })

    expect(
      summary.views.upcomingReviewLoad.rows.reduce(
        (sum, point) => sum + point.dueCount,
        0,
      ),
    ).toBe(1)
  })

  it('derives chart metrics from full history and current FSRS state', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-01-31T12:00:00.000Z')
    const selectedDates = Array.from(
      { length: 10 },
      (_, index) =>
        new Date(
          `2026-01-${String(20 + index).padStart(2, '0')}T12:00:00.000Z`,
        ),
    )

    await insertAnalyticsProblem(
      handle.db,
      'graphs-problem',
      'Graphs Problem',
      ['Graphs'],
    )
    await insertAnalyticsProblem(
      handle.db,
      'arrays-problem',
      'Arrays Problem',
      ['Arrays'],
    )
    await insertAnalyticsHistory(handle.db, 'graphs-problem', {
      id: 'graphs-card:default',
      dates: [new Date('2026-01-10T12:00:00.000Z'), ...selectedDates],
      ratings: ['again', 'again', ...Array<ReviewRating>(9).fill('good')],
      correct: [false, ...Array<boolean>(10).fill(true)],
      dueAt: new Date('2026-02-01T12:00:00.000Z'),
      stability: 12,
      difficulty: 8,
    })
    await insertAnalyticsHistory(handle.db, 'arrays-problem', {
      id: 'arrays-card:default',
      dates: [new Date('2026-01-25T12:00:00.000Z')],
      ratings: ['good'],
      correct: [true],
      dueAt: new Date('2026-02-03T12:00:00.000Z'),
      stability: 4,
      difficulty: 4,
    })
    await updateSettings(handle.db, { review: { targetRetention: 0.85 } })

    const summary = await getAnalyticsSummary(handle.db, { range: 90, now })
    const graphsPoint = summary.topics.find((topic) => topic.topic === 'Graphs')

    expect(summary.targetRetention).toBe(0.85)
    expect(summary.predictedRecall.sampleSize).toBe(12)
    expect(summary.predictedRecall.lowSample).toBe(false)
    expect(summary.predictedRecall.value).not.toBeNull()
    expect(summary.hardAgain).toMatchObject({
      selectedShare: 2 / 12,
      sampleSize: 12,
      previousShare: null,
      previousSampleSize: 0,
      previousLowSample: true,
      direction: null,
    })
    expect(
      summary.recallQuality.some((point) => point.predictedRecall !== null),
    ).toBe(true)
    expect(graphsPoint).toMatchObject({
      topic: 'Graphs',
      recallQuality: 10 / 11,
      sampleSize: 11,
      lowSample: false,
    })
    expect(summary.stability.length).toBeGreaterThan(0)
    expect(
      summary.stability.some((point) => point.medianStabilityDays !== null),
    ).toBe(true)
    expect(
      summary.ratingsMix.reduce((sum, point) => sum + point.again, 0),
    ).toBe(2)
    expect(summary.views.upcomingReviewLoad.rows[0]?.overdueCount).toBe(0)
    expect(summary.views.upcomingReviewLoad.rows[1]?.dueCount).toBe(1)
    expect(summary.views.retentionMap.rows).toHaveLength(2)
    expect(summary.views.overdueBacklog.rows).toHaveLength(120)
  })

  it.each([90, 120] as const)(
    'keeps fixed overdue backlog history available when replay is complete for %s days',
    async (range) => {
      const handle = await createTestDb({ seed: false })
      const now = new Date('2026-08-13T12:00:00.000Z')
      const dates = Array.from({ length: range }, (_, index) => {
        const date = new Date(now)
        date.setDate(date.getDate() - (range - 1 - index))
        return date
      })

      await insertAnalyticsProblem(
        handle.db,
        `complete-overdue-${range}`,
        `Complete overdue ${range}`,
        [],
      )
      await insertAnalyticsHistory(handle.db, `complete-overdue-${range}`, {
        id: `complete-overdue-${range}:default`,
        dates,
        ratings: Array<ReviewRating>(dates.length).fill('good'),
        correct: Array<boolean>(dates.length).fill(true),
        dueAt: new Date('2026-08-14T12:00:00.000Z'),
        stability: 10,
        difficulty: 5,
      })

      const summary = await getAnalyticsSummary(handle.db, { range, now })

      expect(summary.views.overdueBacklog.knownDays).toBe(120)
    },
  )

  it('keeps sparse reconstructed overdue history unready and preserves null bucket gaps', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-08-13T12:00:00.000Z')
    const dates = Array.from({ length: 30 }, (_, index) => {
      const date = new Date('2026-07-15T12:00:00.000Z')
      date.setDate(date.getDate() + index)
      return date
    })

    await insertAnalyticsProblem(
      handle.db,
      'sparse-overdue-history',
      'Sparse overdue history',
      [],
    )
    await insertAnalyticsHistory(handle.db, 'sparse-overdue-history', {
      id: 'sparse-overdue-history:default',
      dates,
      ratings: Array<ReviewRating>(dates.length).fill('good'),
      correct: Array<boolean>(dates.length).fill(true),
      dueAt: new Date('2026-08-14T12:00:00.000Z'),
      stability: 10,
      difficulty: 5,
    })
    await handle.db
      .update(reviewAttempts)
      .set({ fsrsReviewLog: 'invalid review log' })
      .where(eq(reviewAttempts.id, 'sparse-overdue-history:default:3'))

    const summary = await getAnalyticsSummary(handle.db, { range: 120, now })

    expect(
      summary.views.overdueBacklog.rows.some(
        (point) => point.overdueCount === null,
      ),
    ).toBe(true)
  })

  it('keeps recall quality unready when valid ratings have no persisted correctness', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-08-13T12:00:00.000Z')
    const dates = Array.from({ length: 24 }, (_, index) => {
      const date = new Date('2026-07-21T12:00:00.000Z')
      date.setDate(date.getDate() + index)
      return date
    })

    await insertAnalyticsProblem(
      handle.db,
      'ratings-without-correctness',
      'Ratings without correctness',
      [],
    )
    await insertAnalyticsHistory(handle.db, 'ratings-without-correctness', {
      id: 'ratings-without-correctness:default',
      dates,
      ratings: Array<ReviewRating>(dates.length).fill('good'),
      correct: Array<boolean | null>(dates.length).fill(null),
      dueAt: new Date('2026-08-14T12:00:00.000Z'),
      stability: 10,
      difficulty: 5,
    })

    const summary = await getAnalyticsSummary(handle.db, { range: 120, now })
    expect(summary.recallQuality.length).toBeGreaterThan(0)
    expect(
      summary.recallQuality.every((point) => point.eligibleSampleSize === 0),
    ).toBe(true)
  })

  it('keeps practice rhythm unready when review volume has no persisted correctness', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-08-13T12:00:00.000Z')
    const dates = Array.from({ length: 24 }, (_, index) => {
      const date = new Date('2026-07-21T12:00:00.000Z')
      date.setDate(date.getDate() + index)
      return date
    })

    await insertAnalyticsProblem(
      handle.db,
      'practice-without-correctness',
      'Practice without correctness',
      [],
    )
    await insertAnalyticsHistory(handle.db, 'practice-without-correctness', {
      id: 'practice-without-correctness:default',
      dates,
      ratings: Array<ReviewRating>(dates.length).fill('good'),
      correct: Array<boolean | null>(dates.length).fill(null),
      dueAt: new Date('2026-08-14T12:00:00.000Z'),
      stability: 10,
      difficulty: 5,
    })

    const summary = await getAnalyticsSummary(handle.db, { range: 120, now })
    expect(summary.practiceRhythm.length).toBeGreaterThan(0)
    expect(summary.practiceRhythm.some((point) => point.reviewCount > 0)).toBe(
      true,
    )
    expect(
      summary.practiceRhythm.every(
        (point) => point.observedCorrectness === null,
      ),
    ).toBe(true)
  })

  it('excludes invalid persisted ratings from every historical view', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-08-13T12:00:00.000Z')
    const dates = Array.from({ length: 24 }, (_, index) => {
      const date = new Date('2026-07-21T12:00:00.000Z')
      date.setDate(date.getDate() + index)
      return date
    })

    await insertAnalyticsProblem(
      handle.db,
      'invalid-rating-evidence',
      'Invalid rating evidence',
      ['Graphs'],
    )
    await insertAnalyticsHistory(handle.db, 'invalid-rating-evidence', {
      id: 'invalid-rating-evidence:default',
      dates,
      ratings: Array<ReviewRating>(dates.length).fill('good'),
      correct: Array<boolean>(dates.length).fill(true),
      dueAt: new Date('2026-08-14T12:00:00.000Z'),
      stability: 10,
      difficulty: 5,
    })
    await handle.db
      .update(reviewAttempts)
      .set({ rating: 'unexpected-rating' })
      .where(eq(reviewAttempts.cardId, 'invalid-rating-evidence:default'))

    const summary = await getAnalyticsSummary(handle.db, { range: 120, now })
    expect(
      summary.recallQuality.every((point) => point.eligibleSampleSize === 0),
    ).toBe(true)
    expect(
      summary.practiceRhythm.every((point) => point.reviewCount === 0),
    ).toBe(true)
    expect(summary.ratingsMix.every((point) => point.total === 0)).toBe(true)
    expect(summary.topics).toEqual([])
    expect(
      summary.stability.every(
        (point) => point.medianStabilityDays === null && point.sampleSize === 0,
      ),
    ).toBe(true)
  })

  it('uses only valid persisted ratings for mixed historical evidence', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-08-13T12:00:00.000Z')
    const dates = Array.from({ length: 14 }, (_, index) => {
      const date = new Date('2026-07-31T12:00:00.000Z')
      date.setDate(date.getDate() + index)
      return date
    })

    await insertAnalyticsProblem(
      handle.db,
      'mixed-rating-evidence',
      'Mixed rating evidence',
      ['Graphs'],
    )
    await insertAnalyticsHistory(handle.db, 'mixed-rating-evidence', {
      id: 'mixed-rating-evidence:default',
      dates,
      ratings: Array<ReviewRating>(dates.length).fill('good'),
      correct: Array<boolean>(dates.length).fill(true),
      dueAt: new Date('2026-08-14T12:00:00.000Z'),
      stability: 10,
      difficulty: 5,
    })
    for (const index of [0, 2, 4, 6, 8, 10, 12]) {
      await handle.db
        .update(reviewAttempts)
        .set({ rating: 'unexpected-rating' })
        .where(eq(reviewAttempts.id, `mixed-rating-evidence:default:${index}`))
    }

    const summary = await getAnalyticsSummary(handle.db, { range: 90, now })
    expect(
      summary.recallQuality.reduce(
        (count, point) => count + point.eligibleSampleSize,
        0,
      ),
    ).toBe(7)
    expect(
      summary.practiceRhythm.reduce(
        (count, point) => count + point.reviewCount,
        0,
      ),
    ).toBe(7)
    expect(summary.topics).toEqual([
      {
        topic: 'Graphs',
        recallQuality: 1,
        sampleSize: 7,
        lowSample: true,
      },
    ])
    expect(
      summary.stability.reduce((count, point) => count + point.sampleSize, 0),
    ).toBe(7)
  })

  it('counts only persisted correctness observations for recall quality', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-08-13T12:00:00.000Z')
    const dates = Array.from({ length: 14 }, (_, index) => {
      const date = new Date('2026-07-31T12:00:00.000Z')
      date.setDate(date.getDate() + index)
      return date
    })

    await insertAnalyticsProblem(
      handle.db,
      'mixed-correctness',
      'Mixed correctness',
      [],
    )
    await insertAnalyticsHistory(handle.db, 'mixed-correctness', {
      id: 'mixed-correctness:default',
      dates,
      ratings: Array<ReviewRating>(dates.length).fill('good'),
      correct: dates.map((_, index) =>
        index === 0 || index === 7 ? null : true,
      ),
      dueAt: new Date('2026-08-14T12:00:00.000Z'),
      stability: 10,
      difficulty: 5,
    })

    const summary = await getAnalyticsSummary(handle.db, { range: 90, now })
    expect(
      summary.recallQuality.reduce(
        (count, point) => count + point.eligibleSampleSize,
        0,
      ),
    ).toBe(12)
  })

  it('returns non-empty practice rhythm data accepted by the runtime response parser', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-01-31T12:00:00.000Z')

    await insertAnalyticsProblem(handle.db, 'legacy-consistency', 'Legacy', [])
    await insertAnalyticsHistory(handle.db, 'legacy-consistency', {
      id: 'legacy-consistency-card:default',
      dates: [new Date('2026-01-20T12:00:00.000Z')],
      ratings: ['good'],
      correct: [true],
      dueAt: new Date('2026-02-01T12:00:00.000Z'),
      stability: 4,
      difficulty: 5,
    })

    const summary = await getAnalyticsSummary(handle.db, { range: 90, now })
    const parsed = analyticsSummarySchema.parse({
      ...summary,
      observedRatingQuality: {
        value: summary.lowSample ? null : summary.observedRatingQuality,
        sampleSize: summary.observedRatingSampleSize,
        lowSample: summary.lowSample,
      },
    })

    expect(parsed.practiceRhythm).toHaveLength(13)
    expect(
      parsed.practiceRhythm.find((point) => point.reviewCount > 0),
    ).toEqual({
      bucketStart: '2026-01-19',
      bucketEnd: '2026-01-25',
      reviewCount: 1,
      observedCorrectness: 1,
      sampleSize: 1,
      associationOnly: true,
    })
  })

  it.each([90, 120] as const)(
    'uses weekly presentation buckets for the selected %s-day history',
    async (range) => {
      const handle = await createTestDb({ seed: false })
      const summary = await getAnalyticsSummary(handle.db, {
        range,
        now: new Date('2026-08-13T12:00:00.000Z'),
      })

      expect(summary.timeFrame.bucketGrain).toBe('week')
      expect(summary.timeFrame.buckets.length).toBeGreaterThan(0)
      expect(
        summary.timeFrame.buckets.every((bucket) =>
          /^\d{4}-\d{2}-\d{2}$/.test(bucket.startKey),
        ),
      ).toBe(true)
    },
  )

  it('keeps the serialized summary deterministic for the same range and time', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-01-15T12:00:00.000Z')

    const first = await getAnalyticsSummary(handle.db, { range: 90, now })
    const second = await getAnalyticsSummary(handle.db, { range: 90, now })

    expect(second).toEqual(first)
  })

  it('uses one requested timezone for bucket rows and forecast grouping', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-03-08T05:30:00.000Z')
    const reviewAt = new Date('2026-03-08T04:30:00.000Z')

    await insertAnalyticsProblem(
      handle.db,
      'timezone-boundary-problem',
      'Timezone Boundary Problem',
      [],
    )
    await insertAnalyticsHistory(handle.db, 'timezone-boundary-problem', {
      id: 'timezone-boundary-card:default',
      dates: [reviewAt],
      ratings: ['good'],
      correct: [true],
      dueAt: new Date('2026-03-09T03:30:00.000Z'),
      stability: 10,
      difficulty: 5,
    })

    const summary = await getAnalyticsSummary(handle.db, {
      range: 90,
      now,
      timeZone: 'America/New_York',
    })

    expect(
      summary.recallQuality.find((point) => point.reviewCount === 1),
    ).toMatchObject({
      bucketStart: '2026-03-02',
      reviewCount: 1,
    })
    expect(summary.views.upcomingReviewLoad.rows[0]).toMatchObject({
      date: '2026-03-08',
      dueCount: 1,
    })
  })

  it('uses local frame bounds for quality and Hard + Again comparisons', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-03-08T05:30:00.000Z')
    const previous = Array.from(
      { length: 10 },
      (_, index) => new Date(Date.UTC(2026, 1, 22, 5, index)),
    )
    const previousPartialBoundary = new Date('2026-02-22T06:00:00.000Z')
    const selected = Array.from(
      { length: 10 },
      (_, index) => new Date(Date.UTC(2026, 2, 7, 12, index)),
    )
    const dates = [...previous, previousPartialBoundary, ...selected]

    await insertAnalyticsProblem(
      handle.db,
      'timezone-comparison-problem',
      'Timezone Comparison Problem',
      [],
    )
    await insertAnalyticsHistory(handle.db, 'timezone-comparison-problem', {
      id: 'timezone-comparison-card:default',
      dates,
      ratings: [
        ...Array<ReviewRating>(10).fill('good'),
        'again',
        ...Array<ReviewRating>(10).fill('good'),
      ],
      correct: Array<boolean>(dates.length).fill(true),
      dueAt: new Date('2026-03-09T03:30:00.000Z'),
      stability: 10,
      difficulty: 5,
    })

    const summary = await getAnalyticsSummary(handle.db, {
      range: 90,
      now,
      timeZone: 'America/New_York',
    })

    expect(summary.observedRatingSampleSize).toBe(21)
    expect(summary.observedRatingQuality).toBe(20 / 21)
    expect(summary.hardAgain).toMatchObject({
      selectedShare: 1 / 21,
      sampleSize: 21,
      previousShare: null,
      previousSampleSize: 0,
      previousLowSample: true,
    })
  })
})

describe('getAnalyticsSummary long-range evidence', () => {
  it('keeps fixed local workload windows independent of the historical selector', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-03-08T05:30:00.000Z')
    const summaries = await Promise.all(
      ([90, 120, 'all'] as const).map((range) =>
        getAnalyticsSummary(handle.db, {
          range,
          now,
          timeZone: 'America/New_York',
        }),
      ),
    )

    const workloadViews = summaries.map((summary) => ({
      overdueBacklog: summary.views.overdueBacklog,
      upcomingReviewLoad: summary.views.upcomingReviewLoad,
    }))

    expect(workloadViews[0]).toEqual(workloadViews[1])
    expect(workloadViews[1]).toEqual(workloadViews[2])
    expect(workloadViews[0]?.overdueBacklog.rows).toHaveLength(120)
    expect(workloadViews[0]?.overdueBacklog.rows[0]).toMatchObject({
      date: '2025-11-09',
      overdueCount: null,
    })
    expect(workloadViews[0]?.overdueBacklog.rows.at(-1)).toMatchObject({
      date: '2026-03-08',
      overdueCount: null,
      inProgress: true,
    })
    expect(workloadViews[0]?.upcomingReviewLoad.rows).toHaveLength(14)
    expect(
      workloadViews[0]?.upcomingReviewLoad.rows.map((row) => row.date),
    ).toEqual([
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
      '2026-03-13',
      '2026-03-14',
      '2026-03-15',
      '2026-03-16',
      '2026-03-17',
      '2026-03-18',
      '2026-03-19',
      '2026-03-20',
      '2026-03-21',
    ])
  })

  it('reconstructs the same 120-day backlog across historical selections', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-03-08T05:30:00.000Z')
    const dates = Array.from(
      { length: 120 },
      (_, index) => new Date(Date.UTC(2025, 10, 9 + index, 12)),
    )

    await insertAnalyticsProblem(
      handle.db,
      'fixed-workload',
      'Fixed Workload',
      [],
    )
    await insertAnalyticsHistory(handle.db, 'fixed-workload', {
      id: 'fixed-workload:default',
      dates,
      ratings: Array<ReviewRating>(dates.length).fill('good'),
      correct: Array<boolean>(dates.length).fill(true),
      dueAt: new Date('2026-03-09T03:30:00.000Z'),
      stability: 10,
      difficulty: 5,
    })

    const summaries = await Promise.all(
      ([90, 120, 'all'] as const).map((range) =>
        getAnalyticsSummary(handle.db, {
          range,
          now,
          timeZone: 'America/New_York',
        }),
      ),
    )
    const overdueBacklogs = summaries.map(
      (summary) => summary.views.overdueBacklog,
    )

    expect(overdueBacklogs[0]).toEqual(overdueBacklogs[1])
    expect(overdueBacklogs[1]).toEqual(overdueBacklogs[2])
    expect(overdueBacklogs[0]?.selectedDays).toBe(120)
    expect(overdueBacklogs[0]?.knownDays).toBeGreaterThan(0)
  })

  it.each([90, 120, 'all'] as const)(
    'returns a truthful empty %s frame without readiness output',
    async (range) => {
      const handle = await createTestDb({ seed: false })
      const summary = await getAnalyticsSummary(handle.db, {
        range,
        now: new Date('2026-08-24T12:00:00.000Z'),
      })

      expect(summary.timeFrame.requestedRange).toBe(range)
      expect(summary).not.toHaveProperty('historicalReadiness')
      expect(summary).not.toHaveProperty('recommendedRange')
      if (range === 'all') {
        expect(summary.timeFrame).toMatchObject({
          periodStart: null,
          buckets: [],
        })
      } else {
        expect(summary.timeFrame.buckets.length).toBeGreaterThan(0)
      }
    },
  )

  it('counts paired-review evidence from true review observations without double-counting', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-08-24T12:00:00.000Z')

    await insertAnalyticsProblem(handle.db, 'evidence-card', 'Evidence', [])
    await insertAnalyticsHistory(handle.db, 'evidence-card', {
      id: 'evidence-card:default',
      dates: [
        new Date('2026-06-01T12:00:00.000Z'),
        new Date('2026-08-20T12:00:00.000Z'),
        new Date('2026-08-23T12:00:00.000Z'),
      ],
      ratings: ['good', 'hard', 'good'],
      correct: [true, true, true],
      dueAt: new Date('2026-08-25T12:00:00.000Z'),
      stability: 3,
      difficulty: 5,
    })

    const summary = await getAnalyticsSummary(handle.db, { range: 90, now })

    expect(summary.views.observedRecallVsFsrs.evidence).toMatchObject({
      observations: 3,
      measuredBuckets: 2,
      historyDays: 85,
    })
    expect(summary.views.ratingsMix.evidence.observations).toBe(3)
  })

  it('resolves an invalid All-time timezone before choosing policy and frame', async () => {
    const handle = await createTestDb({ seed: false })
    await insertAnalyticsProblem(handle.db, 'invalid-zone', 'Invalid zone', [])
    await insertAnalyticsHistory(handle.db, 'invalid-zone', {
      id: 'invalid-zone:default',
      dates: [new Date('2024-10-07T12:00:00.000Z')],
      ratings: ['good'],
      correct: [true],
      dueAt: new Date('2024-10-08T12:00:00.000Z'),
      stability: 3,
      difficulty: 5,
    })

    const summary = await getAnalyticsSummary(handle.db, {
      range: 'all',
      now: new Date('2026-08-24T12:00:00.000Z'),
      timeZone: 'Not/A_Zone',
    })

    expect(summary.timeFrame).toMatchObject({
      timeZone: 'UTC',
      timeZoneFallback: true,
      periodStart: '2024-10-07T00:00:00.000Z',
    })
    expect(summary.timeFrame.buckets.length).toBeGreaterThan(0)
    expect(summary.views.ratingsMix.comparison).toMatchObject({
      direction: null,
      previousHardAgainShare: null,
    })
  })

  it('uses the earliest valid rating instead of an earlier invalid review for All time', async () => {
    const handle = await createTestDb({ seed: false })
    await insertAnalyticsProblem(handle.db, 'valid-start', 'Valid start', [])
    await insertAnalyticsHistory(handle.db, 'valid-start', {
      id: 'valid-start:default',
      dates: [new Date('2024-02-02T12:00:00.000Z')],
      ratings: ['good'],
      correct: [true],
      dueAt: new Date('2024-02-03T12:00:00.000Z'),
      stability: 3,
      difficulty: 5,
    })
    await handle.db.insert(reviewAttempts).values({
      id: 'invalid-before-valid',
      problemSlug: 'valid-start',
      cardId: 'valid-start:default',
      rating: 'unknown',
      reviewMode: 'manual',
      reviewedAt: new Date('2024-01-01T12:00:00.000Z').getTime(),
      isCorrect: null,
      fsrsReviewLog: null,
      createdAt: new Date('2024-01-01T12:00:00.000Z').getTime(),
      updatedAt: new Date('2024-01-01T12:00:00.000Z').getTime(),
    })

    const summary = await getAnalyticsSummary(handle.db, {
      range: 'all',
      now: new Date('2024-03-01T12:00:00.000Z'),
    })

    expect(summary.timeFrame.periodStart).toBe('2024-02-02T00:00:00.000Z')
  })

  it('retains populated empty periods for 120 days and adaptive All time', async () => {
    const handle = await createTestDb({ seed: false })
    await insertAnalyticsProblem(handle.db, 'periods', 'Periods', [])
    await insertAnalyticsHistory(handle.db, 'periods', {
      id: 'periods:default',
      dates: [
        new Date('2024-10-07T12:00:00.000Z'),
        new Date('2026-08-24T12:00:00.000Z'),
      ],
      ratings: ['good', 'hard'],
      correct: [true, true],
      dueAt: new Date('2026-08-25T12:00:00.000Z'),
      stability: 3,
      difficulty: 5,
    })
    const now = new Date('2026-08-24T12:00:00.000Z')

    const selected120 = await getAnalyticsSummary(handle.db, {
      range: 120,
      now,
    })
    const allTime = await getAnalyticsSummary(handle.db, { range: 'all', now })

    expect(selected120.views.observedRecallVsFsrs.rows).toHaveLength(
      selected120.timeFrame.buckets.length,
    )
    expect(
      selected120.views.observedRecallVsFsrs.rows.some(
        (row) => row.pairedReviews === 0,
      ),
    ).toBe(true)
    expect(allTime.timeFrame.bucketGrain).toBe('month')
    expect(allTime.views.observedRecallVsFsrs.rows).toHaveLength(
      allTime.timeFrame.buckets.length,
    )
  })

  it.each([90, 120, 'all'] as const)(
    'replays one full card sequence before the %s display filter',
    async (range) => {
      const handle = await createTestDb({ seed: false })
      await insertAnalyticsProblem(handle.db, `replay-${range}`, 'Replay', [])
      await insertAnalyticsHistory(handle.db, `replay-${range}`, {
        id: `replay-${range}:default`,
        dates: [
          new Date('2024-10-07T12:00:00.000Z'),
          new Date('2026-08-24T12:00:00.000Z'),
        ],
        ratings: ['good', 'hard'],
        correct: [true, true],
        dueAt: new Date('2026-08-25T12:00:00.000Z'),
        stability: 3,
        difficulty: 5,
      })

      const summary = await getAnalyticsSummary(handle.db, {
        range,
        now: new Date('2026-08-24T12:00:00.000Z'),
      })

      expect(
        summary.views.memoryStrength.rows
          .filter((row) => row.eligibleReviews === 1)
          .at(-1)?.medianChangeDays,
      ).not.toBeNull()
    },
  )

  it('includes an event at partial-day asOf in requested-zone evidence', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-03-08T05:30:00.000Z')
    await insertAnalyticsProblem(handle.db, 'as-of', 'As of', [])
    await insertAnalyticsHistory(handle.db, 'as-of', {
      id: 'as-of:default',
      dates: [now],
      ratings: ['good'],
      correct: [true],
      dueAt: new Date('2026-03-09T03:30:00.000Z'),
      stability: 3,
      difficulty: 5,
    })

    const summary = await getAnalyticsSummary(handle.db, {
      range: 120,
      now,
      timeZone: 'America/New_York',
    })

    expect(summary.views.observedRecallVsFsrs.evidence).toMatchObject({
      observations: 1,
      measuredBuckets: 1,
      historyDays: 1,
    })
  })

  it('returns an explicit unsupported All-time frame beyond the policy horizon', async () => {
    const handle = await createTestDb({ seed: false })
    await insertAnalyticsProblem(handle.db, 'old-history', 'Old history', [])
    await insertAnalyticsHistory(handle.db, 'old-history', {
      id: 'old-history:default',
      dates: [new Date('1970-01-05T12:00:00.000Z')],
      ratings: ['good'],
      correct: [true],
      dueAt: new Date('1970-01-06T12:00:00.000Z'),
      stability: 3,
      difficulty: 5,
    })

    const summary = await getAnalyticsSummary(handle.db, {
      range: 'all',
      now: new Date('2026-08-24T12:00:00.000Z'),
    })

    expect(summary.timeFrame).toMatchObject({
      bucketGrain: null,
      allTimeUnsupported: true,
      periodStart: null,
      buckets: [],
    })
  })
})

async function insertAnalyticsProblem(
  db: Db,
  slug: string,
  title: string,
  topicLabels: string[],
) {
  const timestamp = new Date('2026-01-01T00:00:00.000Z').getTime()
  await db.insert(problems).values({
    slug,
    title,
    difficulty: 'medium',
    isPremium: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await db.insert(problemPractice).values({
    problemSlug: slug,
    status: 'review',
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
    lastReviewedAt: timestamp,
    solvedCount: 1,
    attemptCount: 1,
    isSuspended: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  for (const label of topicLabels) {
    const topicId = `${slug}:${label.toLowerCase()}`
    await db.insert(topics).values({
      id: topicId,
      label,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await db.insert(problemTopics).values({ problemSlug: slug, topicId })
  }
}

async function insertAnalyticsHistory(
  db: Db,
  slug: string,
  input: {
    id: string
    dates: Date[]
    ratings: ReviewRating[]
    correct: Array<boolean | null>
    dueAt: Date
    stability: number
    difficulty: number
  },
) {
  const initialCard = createInitialFsrsCard(input.dates[0])
  let card = initialCard
  const rows = []

  for (const [index, reviewedAt] of input.dates.entries()) {
    const scheduled = scheduleReview(card, input.ratings[index]!, reviewedAt, {
      targetRetention: 0.85,
    })
    rows.push({
      id: `${input.id}:${index}`,
      problemSlug: slug,
      cardId: input.id,
      rating: input.ratings[index]!,
      reviewMode: 'manual',
      reviewedAt: reviewedAt.getTime(),
      isCorrect: input.correct[index]!,
      fsrsReviewLog: serializeFsrsReviewLogSnapshot(scheduled.log),
      createdAt: reviewedAt.getTime(),
      updatedAt: reviewedAt.getTime(),
    })
    card = scheduled.card
  }

  await db.insert(fsrsCards).values({
    id: input.id,
    problemSlug: slug,
    cardKind: defaultFsrsCardKind,
    dueAt: input.dueAt.getTime(),
    stability: input.stability,
    difficulty: input.difficulty,
    elapsedDays: card.elapsedDays,
    scheduledDays: card.scheduledDays,
    learningSteps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReviewAt: card.lastReviewAt?.getTime() ?? null,
    createdAt: input.dates[0]!.getTime(),
    updatedAt: input.dates.at(-1)!.getTime(),
  })
  await db.insert(reviewAttempts).values(rows)
}

async function insertNeverReviewedCard(
  db: Db,
  slug: string,
  input: { dueAt: Date },
) {
  const now = new Date('2026-01-01T00:00:00.000Z').getTime()
  await db.insert(fsrsCards).values({
    id: `${slug}:default`,
    problemSlug: slug,
    cardKind: defaultFsrsCardKind,
    dueAt: input.dueAt.getTime(),
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: 0,
    lapses: 0,
    state: 'new',
    lastReviewAt: null,
    createdAt: now,
    updatedAt: now,
  })
}
