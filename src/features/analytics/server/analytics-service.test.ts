import { describe, expect, it } from 'vitest'

import { defaultFsrsCardKind } from '@/lib/fsrs'

import { createTestDb } from '@/platform/db/test-db'
import { fsrsCards, problemPractice } from '@/platform/db/schema'

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
})

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
