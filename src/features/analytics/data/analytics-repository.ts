import { and, eq, gt, gte, lte, ne } from 'drizzle-orm'

import { defaultFsrsCardKind } from '@/lib/fsrs'

import type { Db } from '@/platform/db'

import {
  fsrsCards,
  problemPractice,
  problems,
  reviewAttempts,
} from '@/platform/db/schema'

export interface ReviewDayStats {
  totalReviews: number
  reviewDays: number
}

export interface RecentRating {
  rating: string
  reviewedAt: Date
}

export interface UpcomingCard {
  dueAt: Date
}

export interface WeakProblemCandidate {
  slug: string
  title: string
  lapseCount: number
  difficulty: number
  stability: number
  lastReviewAt: Date | null
}

export async function getReviewDayStats(db: Db): Promise<ReviewDayStats> {
  const rows = await db
    .select({ reviewedAt: reviewAttempts.reviewedAt })
    .from(reviewAttempts)

  const dateKeys = new Set(
    rows.map((r) => toLocalDateKey(new Date(r.reviewedAt))),
  )

  return {
    totalReviews: rows.length,
    reviewDays: dateKeys.size,
  }
}

export async function getRecentRatings(
  db: Db,
  since: Date,
): Promise<RecentRating[]> {
  const rows = await db
    .select({
      rating: reviewAttempts.rating,
      reviewedAt: reviewAttempts.reviewedAt,
    })
    .from(reviewAttempts)
    .where(gte(reviewAttempts.reviewedAt, since.getTime()))

  return rows.map((row) => ({
    rating: row.rating,
    reviewedAt: new Date(row.reviewedAt),
  }))
}

export async function getUpcomingCards(
  db: Db,
  until: Date,
): Promise<UpcomingCard[]> {
  const rows = await db
    .select({ dueAt: fsrsCards.dueAt })
    .from(fsrsCards)
    .innerJoin(
      problemPractice,
      eq(problemPractice.problemSlug, fsrsCards.problemSlug),
    )
    .where(
      and(
        eq(fsrsCards.cardKind, defaultFsrsCardKind),
        lte(fsrsCards.dueAt, until.getTime()),
        eq(problemPractice.isSuspended, false),
      ),
    )

  return rows.map((row) => ({ dueAt: new Date(row.dueAt) }))
}

export async function getWeakProblemCandidates(
  db: Db,
): Promise<WeakProblemCandidate[]> {
  const rows = await db
    .select({
      slug: problems.slug,
      title: problems.title,
      lapseCount: fsrsCards.lapses,
      difficulty: fsrsCards.difficulty,
      stability: fsrsCards.stability,
      lastReviewAt: fsrsCards.lastReviewAt,
    })
    .from(problems)
    .innerJoin(
      fsrsCards,
      and(
        eq(fsrsCards.problemSlug, problems.slug),
        eq(fsrsCards.cardKind, defaultFsrsCardKind),
      ),
    )
    .innerJoin(
      problemPractice,
      eq(problemPractice.problemSlug, problems.slug),
    )
    .where(
      and(
        ne(problemPractice.status, 'new'),
        eq(problemPractice.isSuspended, false),
        gt(fsrsCards.lapses, 0),
      ),
    )

  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    lapseCount: row.lapseCount,
    difficulty: row.difficulty,
    stability: row.stability,
    lastReviewAt:
      row.lastReviewAt === null ? null : new Date(row.lastReviewAt),
  }))
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
