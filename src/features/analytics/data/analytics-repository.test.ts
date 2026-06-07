import { describe, expect, it } from 'vitest'

import type { Db } from '@/platform/db'
import { createTestDb } from '@/platform/db/test-db'
import { fsrsCards, problemPractice, reviewAttempts } from '@/platform/db/schema'

import {
  getReviewDayStats,
  getRecentRatings,
  getUpcomingCards,
  getWeakProblemCandidates,
  getRetentionScatterCandidates,
} from './analytics-repository'

const BASE_TS = new Date('2026-01-15T12:00:00.000Z').getTime()
const ts = (d: Date) => d.getTime()

async function insertCard(
  db: Db,
  slug: string,
  opts: {
    id?: string
    dueAt?: number
    lapses?: number
    difficulty?: number
    stability?: number
  } = {},
) {
  const id = opts.id ?? `${slug}:default`
  await db.insert(fsrsCards).values({
    id,
    problemSlug: slug,
    cardKind: 'default',
    dueAt: opts.dueAt ?? BASE_TS,
    stability: opts.stability ?? 10,
    difficulty: opts.difficulty ?? 5,
    elapsedDays: 7,
    scheduledDays: 7,
    learningSteps: 0,
    reps: 1,
    lapses: opts.lapses ?? 0,
    state: 'review',
    lastReviewAt: BASE_TS,
    createdAt: BASE_TS,
    updatedAt: BASE_TS,
  })
  return id
}

async function insertPractice(
  db: Db,
  slug: string,
  opts: { isSuspended?: boolean; status?: string } = {},
) {
  await db.insert(problemPractice).values({
    problemSlug: slug,
    status: opts.status ?? 'review',
    firstSeenAt: BASE_TS,
    lastSeenAt: BASE_TS,
    lastReviewedAt: BASE_TS,
    isSuspended: opts.isSuspended ?? false,
    createdAt: BASE_TS,
    updatedAt: BASE_TS,
  })
}

async function insertAttempt(
  db: Db,
  id: string,
  slug: string,
  cardId: string,
  rating: string,
  reviewedAt: Date,
) {
  await db.insert(reviewAttempts).values({
    id,
    problemSlug: slug,
    cardId,
    rating,
    reviewMode: 'standard',
    reviewedAt: ts(reviewedAt),
    createdAt: ts(reviewedAt),
    updatedAt: ts(reviewedAt),
  })
}

// ---------------------------------------------------------------------------

describe('getReviewDayStats', () => {
  it('returns zeros when no attempts exist', async () => {
    const { db } = await createTestDb()
    const result = await getReviewDayStats(db)
    expect(result.totalReviews).toBe(0)
    expect(result.reviewDays).toBe(0)
  })

  it('counts total reviews and distinct review days', async () => {
    const { db } = await createTestDb()
    const day1 = new Date('2026-01-10T09:00:00.000Z')
    const day2 = new Date('2026-01-11T09:00:00.000Z')

    const cardId = await insertCard(db, 'two-sum')
    await insertAttempt(db, 'a1', 'two-sum', cardId, 'good', day1)
    await insertAttempt(db, 'a2', 'two-sum', cardId, 'good', day1)
    await insertAttempt(db, 'a3', 'two-sum', cardId, 'again', day2)

    const result = await getReviewDayStats(db)
    expect(result.totalReviews).toBe(3)
    expect(result.reviewDays).toBe(2)
  })
})

// ---------------------------------------------------------------------------

describe('getRecentRatings', () => {
  it('returns empty when no attempts exist', async () => {
    const { db } = await createTestDb()
    const since = new Date('2026-01-01T00:00:00.000Z')
    const result = await getRecentRatings(db, since)
    expect(result).toEqual([])
  })

  it('includes attempts at or after the since cutoff and excludes earlier ones', async () => {
    const { db } = await createTestDb()
    const since = new Date('2026-01-10T00:00:00.000Z')
    const before = new Date('2026-01-09T23:59:59.999Z')
    const exactly = new Date('2026-01-10T00:00:00.000Z')
    const after = new Date('2026-01-11T09:00:00.000Z')

    const cardId = await insertCard(db, 'two-sum')
    await insertAttempt(db, 'a1', 'two-sum', cardId, 'hard', before)
    await insertAttempt(db, 'a2', 'two-sum', cardId, 'good', exactly)
    await insertAttempt(db, 'a3', 'two-sum', cardId, 'easy', after)

    const result = await getRecentRatings(db, since)
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.rating)).toEqual(
      expect.arrayContaining(['good', 'easy']),
    )
  })

  it('returns correct rating and reviewedAt values', async () => {
    const { db } = await createTestDb()
    const reviewedAt = new Date('2026-01-12T08:00:00.000Z')
    const since = new Date('2026-01-01T00:00:00.000Z')

    const cardId = await insertCard(db, 'two-sum')
    await insertAttempt(db, 'a1', 'two-sum', cardId, 'again', reviewedAt)

    const [item] = await getRecentRatings(db, since)
    expect(item?.rating).toBe('again')
    expect(item?.reviewedAt.getTime()).toBe(reviewedAt.getTime())
  })
})

// ---------------------------------------------------------------------------

describe('getUpcomingCards', () => {
  it('returns empty when no cards exist', async () => {
    const { db } = await createTestDb()
    const until = new Date('2026-02-01T00:00:00.000Z')
    const result = await getUpcomingCards(db, until)
    expect(result).toEqual([])
  })

  it('includes cards due on or before until and excludes cards due after', async () => {
    const { db } = await createTestDb()
    const before = new Date('2026-01-15T00:00:00.000Z')
    const exactly = new Date('2026-01-20T00:00:00.000Z')
    const after = new Date('2026-01-21T00:00:00.000Z')

    await insertPractice(db, 'two-sum')
    await insertPractice(db, 'valid-parentheses')

    await insertCard(db, 'two-sum', { dueAt: ts(before) })
    await insertCard(db, 'valid-parentheses', { dueAt: ts(after) })

    const result = await getUpcomingCards(db, exactly)
    expect(result).toHaveLength(1)
    expect(result[0]?.dueAt.getTime()).toBe(ts(before))
  })

  it('excludes cards belonging to suspended problems', async () => {
    const { db } = await createTestDb()
    const until = new Date('2026-01-20T00:00:00.000Z')
    const due = new Date('2026-01-15T00:00:00.000Z')

    await insertPractice(db, 'two-sum', { isSuspended: true })
    await insertCard(db, 'two-sum', { dueAt: ts(due) })

    const result = await getUpcomingCards(db, until)
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------

describe('getWeakProblemCandidates', () => {
  it('returns empty when no reviewed problems exist', async () => {
    const { db } = await createTestDb()
    const result = await getWeakProblemCandidates(db)
    expect(result).toEqual([])
  })

  it('excludes problems with zero lapses', async () => {
    const { db } = await createTestDb()
    await insertPractice(db, 'two-sum')
    await insertCard(db, 'two-sum', { lapses: 0 })

    const result = await getWeakProblemCandidates(db)
    expect(result).toEqual([])
  })

  it('excludes suspended problems', async () => {
    const { db } = await createTestDb()
    await insertPractice(db, 'two-sum', { isSuspended: true })
    await insertCard(db, 'two-sum', { lapses: 3 })

    const result = await getWeakProblemCandidates(db)
    expect(result).toEqual([])
  })

  it('returns slug, title, lapseCount, difficulty, stability, lastReviewAt for a weak problem', async () => {
    const { db } = await createTestDb()
    await insertPractice(db, 'two-sum')
    await insertCard(db, 'two-sum', { lapses: 2, difficulty: 6.5, stability: 3.0 })

    const result = await getWeakProblemCandidates(db)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      slug: 'two-sum',
      title: 'Two Sum',
      lapseCount: 2,
      difficulty: 6.5,
      stability: 3.0,
    })
    expect(result[0]?.lastReviewAt?.getTime()).toBe(BASE_TS)
  })

  it('orders by lapses DESC then difficulty DESC', async () => {
    const { db } = await createTestDb()
    await insertPractice(db, 'two-sum')
    await insertPractice(db, 'valid-parentheses')
    await insertCard(db, 'two-sum', { lapses: 1, difficulty: 8 })
    await insertCard(db, 'valid-parentheses', { lapses: 3, difficulty: 4 })

    const result = await getWeakProblemCandidates(db)
    expect(result.map((r) => r.slug)).toEqual(['valid-parentheses', 'two-sum'])
  })
})

// ---------------------------------------------------------------------------

describe('getRetentionScatterCandidates', () => {
  it('returns empty when no practiced problems exist', async () => {
    const { db } = await createTestDb()

    const result = await getRetentionScatterCandidates(db)

    expect(result).toEqual([])
  })

  it('excludes cards in new state (lastReviewAt is null)', async () => {
    const { db } = await createTestDb()
    await insertPractice(db, 'two-sum')
    await db.insert(fsrsCards).values({
      id: 'two-sum:default',
      problemSlug: 'two-sum',
      cardKind: 'default',
      dueAt: BASE_TS,
      stability: 10,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      learningSteps: 0,
      reps: 0,
      lapses: 0,
      state: 'new',
      lastReviewAt: null,
      createdAt: BASE_TS,
      updatedAt: BASE_TS,
    })

    const result = await getRetentionScatterCandidates(db)

    expect(result).toEqual([])
  })

  it('excludes suspended problems', async () => {
    const { db } = await createTestDb()
    await insertPractice(db, 'two-sum', { isSuspended: true })
    await insertCard(db, 'two-sum')

    const result = await getRetentionScatterCandidates(db)

    expect(result).toEqual([])
  })

  it('returns slug, title, stability, difficulty, lapseCount, lastReviewAt for a reviewed problem', async () => {
    const { db } = await createTestDb()
    await insertPractice(db, 'two-sum')
    await insertCard(db, 'two-sum', { stability: 12, difficulty: 6.5, lapses: 1 })

    const result = await getRetentionScatterCandidates(db)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      slug: 'two-sum',
      title: 'Two Sum',
      stability: 12,
      difficulty: 6.5,
      lapseCount: 1,
    })
    expect(result[0]?.lastReviewAt).toBeInstanceOf(Date)
    expect(result[0]?.lastReviewAt.getTime()).toBe(BASE_TS)
  })

  it('returns all non-new, non-suspended problems regardless of lapse count', async () => {
    const { db } = await createTestDb()
    await insertPractice(db, 'two-sum')
    await insertPractice(db, 'valid-parentheses')
    await insertCard(db, 'two-sum', { lapses: 0 })
    await insertCard(db, 'valid-parentheses', { lapses: 3 })

    const result = await getRetentionScatterCandidates(db)

    expect(result).toHaveLength(2)
  })
})
