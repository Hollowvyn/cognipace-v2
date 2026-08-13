import { describe, expect, it } from 'vitest'

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

import { getAnalyticsSummary } from './analytics-service'

describe('getAnalyticsSummary memory profile', () => {
  it.each([14, 30, 90] as const)(
    'retains the selected %s-day range in summary metadata',
    async (range) => {
      const handle = await createTestDb()
      const now = new Date('2026-01-15T12:00:00.000Z')

      const summary = await getAnalyticsSummary(handle.db, { range, now })

      expect(summary.range).toBe(range)
      expect(summary.periodEnd).toBe(now.toISOString())
      expect(summary.periodStart).toBe(
        new Date(now.getTime() - range * 24 * 60 * 60 * 1000).toISOString(),
      )
      expect(summary.observedRatingQuality).toBeNull()
      expect(summary.chartDataStatus).toBe('ready')
      expect(summary.predictedRecall).toEqual({
        value: null,
        sampleSize: 0,
        lowSample: true,
      })
      expect(summary.recallQuality).toHaveLength(range + 1)
      expect(summary.ratingsMix).toHaveLength(range + 1)
      expect(summary.upcomingLoad).toHaveLength(14)
    },
  )

  it('counts real tracked cards instead of weak-problem candidates', async () => {
    const handle = await createTestDb()
    const now = new Date('2026-01-15T12:00:00.000Z')

    await insertTrackedCard(handle.db, {
      problemSlug: 'two-sum',
      status: 'review',
      state: 'review',
      dueAt: new Date('2026-01-16T12:00:00.000Z'),
      lastReviewAt: new Date('2026-01-14T12:00:00.000Z'),
    })
    await insertTrackedCard(handle.db, {
      problemSlug: 'two-sum-ii-input-array-is-sorted',
      status: 'review',
      state: 'review',
      dueAt: new Date('2026-01-15T23:00:00.000Z'),
      lastReviewAt: new Date('2026-01-14T12:00:00.000Z'),
    })
    await insertTrackedCard(handle.db, {
      problemSlug: 'valid-palindrome',
      status: 'learning',
      state: 'learning',
      dueAt: new Date('2026-01-15T11:00:00.000Z'),
      lastReviewAt: new Date('2026-01-14T12:00:00.000Z'),
    })
    await insertTrackedCard(handle.db, {
      problemSlug: 'valid-parentheses',
      status: 'mastered',
      state: 'review',
      dueAt: now,
      lastReviewAt: new Date('2026-01-14T12:00:00.000Z'),
    })
    await insertTrackedCard(handle.db, {
      problemSlug: 'maximum-subarray',
      status: 'suspended',
      state: 'review',
      dueAt: new Date('2026-01-15T10:00:00.000Z'),
      lastReviewAt: new Date('2026-01-14T12:00:00.000Z'),
      isSuspended: true,
    })

    const summary = await getAnalyticsSummary(handle.db, now)

    expect(summary.weakProblems).toEqual([])
    expect(summary.memoryProfile).toMatchObject({
      totalTracked: 5,
      dueToday: 3,
      overdue: 1,
      learning: 1,
      review: 2,
      mastered: 1,
      suspended: 1,
      lowSample: true,
    })
    expect(summary.dueForecast14Days[0]?.dueCount).toBe(
      summary.memoryProfile.dueToday,
    )
    expect(summary.memoryProfile.averageRetrievability).not.toBeNull()
    expect(summary.memoryProfile.averageRetrievability).toBeGreaterThanOrEqual(
      0,
    )
    expect(summary.memoryProfile.averageRetrievability).toBeLessThanOrEqual(1)
  })

  it('returns truthful chart payloads for an empty database', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-01-15T12:00:00.000Z')

    const summary = await getAnalyticsSummary(handle.db, { range: 30, now })

    expect(summary.chartDataStatus).toBe('ready')
    expect(summary.predictedRecall).toEqual({
      value: null,
      sampleSize: 0,
      lowSample: true,
    })
    expect(
      summary.recallQuality.every((point) => point.observedRecall === null),
    ).toBe(true)
    expect(summary.topics).toEqual([])
    expect(summary.stability).toEqual([])
    expect(summary.overdueBacklog).toEqual([])
    expect(summary.overdueHistoryAvailableFrom).toBeNull()
    expect(summary.upcomingLoad).toHaveLength(14)
    expect(summary.upcomingLoad.every((point) => point.dueCount === 0)).toBe(
      true,
    )
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

    const summary = await getAnalyticsSummary(handle.db, { range: 14, now })
    const day = summary.recallQuality.find(
      (point) => point.date === '2026-08-02',
    )

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

    const summary = await getAnalyticsSummary(handle.db, { range: 14, now })

    expect(summary.observedRatingQuality).toBe(1)
    expect(summary.observedRatingSampleSize).toBe(10)
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

    const summary = await getAnalyticsSummary(handle.db, { range: 14, now })

    expect(summary.memoryProfile.totalTracked).toBe(1)
    expect(
      summary.upcomingLoad.reduce((sum, point) => sum + point.dueCount, 0),
    ).toBe(1)
    expect(summary.retentionHealth).toEqual([])
    expect(summary.fragileKnowledge).toEqual([])
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

    const summary = await getAnalyticsSummary(handle.db, { range: 14, now })
    const graphsPoint = summary.topics.find((topic) => topic.topic === 'Graphs')
    const recallPoint = summary.recallQuality.find(
      (point) => point.date === '2026-01-20',
    )

    expect(summary.targetRetention).toBe(0.85)
    expect(summary.predictedRecall.sampleSize).toBe(11)
    expect(summary.predictedRecall.lowSample).toBe(false)
    expect(summary.predictedRecall.value).not.toBeNull()
    expect(recallPoint?.predictedRecall).not.toBeNull()
    expect(graphsPoint).toMatchObject({
      topic: 'Graphs',
      recallQuality: 1,
      sampleSize: 10,
      lowSample: false,
    })
    expect(summary.stability.length).toBeGreaterThan(0)
    expect(
      summary.stability.some((point) => point.medianStabilityDays !== null),
    ).toBe(true)
    expect(
      summary.ratingsMix.reduce((sum, point) => sum + point.again, 0),
    ).toBe(1)
    expect(summary.upcomingLoad[0]?.overdueCount).toBe(0)
    expect(summary.upcomingLoad[1]?.dueCount).toBe(1)
    expect(summary.retentionHealth).toHaveLength(2)
    expect(
      summary.fragileKnowledge.some((row) => row.topics.includes('Graphs')),
    ).toBe(true)
    expect(summary.overdueBacklog).toEqual([])
    expect(summary.overdueHistoryAvailableFrom).toBeNull()
  })

  it('keeps the serialized summary deterministic for the same range and time', async () => {
    const handle = await createTestDb({ seed: false })
    const now = new Date('2026-01-15T12:00:00.000Z')

    const first = await getAnalyticsSummary(handle.db, { range: 90, now })
    const second = await getAnalyticsSummary(handle.db, { range: 90, now })

    expect(second).toEqual(first)
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
    correct: boolean[]
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

async function insertTrackedCard(
  db: Awaited<ReturnType<typeof createTestDb>>['db'],
  input: {
    problemSlug: string
    status: string
    state: string
    dueAt: Date
    lastReviewAt: Date
    isSuspended?: boolean
  },
) {
  const now = new Date('2026-01-01T00:00:00.000Z').getTime()

  await db.insert(problemPractice).values({
    problemSlug: input.problemSlug,
    status: input.status,
    firstSeenAt: now,
    lastSeenAt: now,
    lastReviewedAt: input.lastReviewAt.getTime(),
    solvedCount: 1,
    attemptCount: 1,
    isSuspended: input.isSuspended ?? false,
    createdAt: now,
    updatedAt: now,
  })
  await db.insert(fsrsCards).values({
    id: `${input.problemSlug}:default`,
    problemSlug: input.problemSlug,
    cardKind: defaultFsrsCardKind,
    dueAt: input.dueAt.getTime(),
    stability: 4,
    difficulty: 5,
    elapsedDays: 1,
    scheduledDays: 1,
    learningSteps: 0,
    reps: 1,
    lapses: 0,
    state: input.state,
    lastReviewAt: input.lastReviewAt.getTime(),
    createdAt: now,
    updatedAt: now,
  })
}
