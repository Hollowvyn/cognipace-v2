import {
  getRetrievability,
  parseFsrsCardState,
  type FsrsCardSnapshot,
} from '@/lib/fsrs'

import type { Db } from '@/platform/db'

import { getPracticeProgressSummary } from '@/features/practice/server/practice-service'
import { getSettings } from '@/features/settings/server/settings-service'

import {
  getReviewDayStats,
  getRecentRatings,
  getMemoryProfileCards,
  getUpcomingCards,
  getWeakProblemCandidates,
  getRetentionScatterCandidates,
  type MemoryProfileCard,
} from '../data/analytics-repository'

import {
  buildRetentionProxy,
  buildDueForecast,
  buildWeakProblems,
  buildMemoryProfile,
  buildAnalyticsSummary,
  buildRetentionScatter,
  type AnalyticsSummary,
  type RetentionScatterEntry,
  type ReferenceCurvePoint,
} from '../domain/summary'

export async function getAnalyticsSummary(
  db: Db,
  now = new Date(),
): Promise<AnalyticsSummary> {
  const thirtyDaysAgo = subtractDays(now, 30)
  const fourteenDaysLater = addDays(now, 14)

  // Step 1: run all reads in parallel
  const [
    dayStats,
    recentRatings,
    upcomingCards,
    weakCandidates,
    memoryProfileCards,
    settings,
    scatterCandidates,
  ] = await Promise.all([
    getReviewDayStats(db),
    getRecentRatings(db, thirtyDaysAgo),
    getUpcomingCards(db, fourteenDaysLater),
    getWeakProblemCandidates(db),
    getMemoryProfileCards(db),
    getSettings(db),
    getRetentionScatterCandidates(db),
  ])

  // Step 2: get streak (needs dailyGoal from settings)
  const practiceProgress = await getPracticeProgressSummary(db, {
    dailyGoal: settings.practice.dailyGoal,
  })

  // Step 3: enrich weak candidates with retrievability (needs `now`)
  const enrichedCandidates = weakCandidates.flatMap((candidate) => {
    if (candidate.lastReviewAt === null) return []
    return [
      {
        slug: candidate.slug,
        title: candidate.title,
        lapseCount: candidate.lapseCount,
        difficulty: candidate.difficulty,
        retrievability: getRetrievability(
          buildMinimalCard(
            candidate.stability,
            candidate.difficulty,
            candidate.lapseCount,
            candidate.lastReviewAt,
          ),
          now,
        ),
      },
    ]
  })

  // Step 4: build domain objects
  const retention = buildRetentionProxy(recentRatings, now)
  const forecast = buildDueForecast(upcomingCards, now)
  const weakProblems = buildWeakProblems(enrichedCandidates)
  const memoryProfile = buildMemoryProfileInput(memoryProfileCards, now)

  const dayMs = 24 * 60 * 60 * 1000

  const enrichedScatter: RetentionScatterEntry[] = scatterCandidates.map((c) => ({
    slug: c.slug,
    title: c.title,
    retrievability: getRetrievability(
      buildMinimalCard(c.stability, c.difficulty, c.lapseCount, c.lastReviewAt),
      now,
    ),
    daysSinceReview: Math.round((now.getTime() - c.lastReviewAt.getTime()) / dayMs),
    difficulty: c.difficulty,
    stability: c.stability,
    lapseCount: c.lapseCount,
    lastReviewAt: c.lastReviewAt.toISOString(),
  }))

  const medianStability = computeMedianStability(scatterCandidates.map((c) => c.stability))
  // ⚡ Bolt: Using reduce prevents Maximum Call Stack Exceeded errors from spread operators on large arrays
  const maxDays = enrichedScatter.reduce((max, e) => Math.max(max, e.daysSinceReview), 14)
  const precomputedCurve: ReferenceCurvePoint[] = Array.from(
    { length: maxDays + 1 },
    (_, day) => ({
      days: day,
      retrievability: getRetrievability(
        buildMinimalCard(medianStability, 5, 0, new Date(now.getTime() - day * dayMs)),
        now,
      ),
    }),
  )

  const { scatter, referenceCurve } = buildRetentionScatter(enrichedScatter, precomputedCurve)

  // Step 5: assemble
  return buildAnalyticsSummary({
    generatedAt: now,
    reviewDays: dayStats.reviewDays,
    totalReviews: dayStats.totalReviews,
    currentStreak: practiceProgress.currentStreak,
    retention,
    forecast,
    weakProblems,
    memoryProfile,
    targetRetention: settings.review.targetRetention,
    scatter,
    referenceCurve,
  })
}

function buildMemoryProfileInput(cards: MemoryProfileCard[], now: Date) {
  const activeCards = cards.filter((card) => !isSuspendedMemoryCard(card))
  const todayKey = toLocalDateKey(now)

  return buildMemoryProfile({
    totalTracked: cards.length,
    dueToday: activeCards.filter(
      (card) => card.dueAt < now || toLocalDateKey(card.dueAt) === todayKey,
    ).length,
    overdue: activeCards.filter((card) => card.dueAt < now).length,
    learning: activeCards.filter(isLearningMemoryCard).length,
    review: activeCards.filter(isReviewMemoryCard).length,
    mastered: activeCards.filter((card) => card.practiceStatus === 'mastered')
      .length,
    suspended: cards.filter(isSuspendedMemoryCard).length,
    retrievabilities: activeCards.flatMap((card) =>
      card.lastReviewAt ? [getRetrievability(buildMemoryCard(card), now)] : [],
    ),
  })
}

function isSuspendedMemoryCard(card: MemoryProfileCard): boolean {
  return card.isSuspended || card.practiceStatus === 'suspended'
}

function isLearningMemoryCard(card: MemoryProfileCard): boolean {
  if (card.practiceStatus === 'mastered') return false

  const state = parseFsrsCardState(card.state)
  return (
    card.practiceStatus === 'learning' ||
    state === 'new' ||
    state === 'learning' ||
    state === 'relearning'
  )
}

function isReviewMemoryCard(card: MemoryProfileCard): boolean {
  if (card.practiceStatus === 'mastered') return false
  return parseFsrsCardState(card.state) === 'review'
}

function buildMemoryCard(card: MemoryProfileCard): FsrsCardSnapshot {
  return {
    dueAt: card.dueAt,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsedDays,
    scheduledDays: card.scheduledDays,
    learningSteps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: parseFsrsCardState(card.state),
    lastReviewAt: card.lastReviewAt,
  }
}

function buildMinimalCard(
  stability: number,
  difficulty: number,
  lapses: number,
  lastReviewAt: Date,
): FsrsCardSnapshot {
  return {
    dueAt: lastReviewAt,
    stability,
    difficulty,
    elapsedDays: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: lapses,
    lapses,
    state: 'review',
    lastReviewAt,
  }
}

function computeMedianStability(stabilities: number[]): number {
  if (stabilities.length === 0) return 21
  const sorted = [...stabilities].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
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

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
