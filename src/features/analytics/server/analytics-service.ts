import { getRetrievability, type FsrsCardSnapshot } from '@/lib/fsrs'

import type { Db } from '@/platform/db'

import { getPracticeProgressSummary } from '@/features/practice/server/practice-service'
import { getSettings } from '@/features/settings/server/settings-service'

import {
  getReviewDayStats,
  getRecentRatings,
  getUpcomingCards,
  getWeakProblemCandidates,
} from '../data/analytics-repository'

import {
  buildRetentionProxy,
  buildDueForecast,
  buildWeakProblems,
  buildAnalyticsSummary,
  type AnalyticsSummary,
} from '../domain/summary'

export async function getAnalyticsSummary(
  db: Db,
  now = new Date(),
): Promise<AnalyticsSummary> {
  const thirtyDaysAgo = subtractDays(now, 30)
  const fourteenDaysLater = addDays(now, 14)

  // Step 1: run all 5 queries in parallel
  const [dayStats, recentRatings, upcomingCards, weakCandidates, settings] =
    await Promise.all([
      getReviewDayStats(db),
      getRecentRatings(db, thirtyDaysAgo),
      getUpcomingCards(db, fourteenDaysLater),
      getWeakProblemCandidates(db),
      getSettings(db),
    ])

  // Step 2: get streak (needs dailyGoal from settings)
  const practiceProgress = await getPracticeProgressSummary(db, {
    dailyGoal: settings.practice.dailyGoal,
  })

  // Step 3: enrich weak candidates with retrievability (needs `now`)
  const enrichedCandidates = weakCandidates.map((candidate) => ({
    slug: candidate.slug,
    title: candidate.title,
    lapseCount: candidate.lapseCount,
    difficulty: candidate.difficulty,
    retrievability: getRetrievability(
      buildMinimalCard(candidate.stability, candidate.lapseCount, candidate.lastReviewAt),
      now,
    ),
  }))

  // Step 4: build domain objects
  const retention = buildRetentionProxy(recentRatings, now)
  const forecast = buildDueForecast(upcomingCards, now)
  const weakProblems = buildWeakProblems(enrichedCandidates)

  // Step 5: assemble
  return buildAnalyticsSummary({
    generatedAt: now,
    reviewDays: dayStats.reviewDays,
    totalReviews: dayStats.totalReviews,
    currentStreak: practiceProgress.currentStreak,
    retention,
    forecast,
    weakProblems,
  })
}

function buildMinimalCard(
  stability: number,
  lapses: number,
  lastReviewAt: Date | null,
): FsrsCardSnapshot {
  return {
    dueAt: lastReviewAt ?? new Date(0),
    stability,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: lapses,
    lapses,
    state: 'review',
    lastReviewAt,
  }
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}
