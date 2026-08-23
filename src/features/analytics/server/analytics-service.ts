import {
  getRetrievability,
  getTargetRetentionDuration,
  normalizeFsrsSchedulingOptions,
  parseFsrsCardState,
  type FsrsCardSnapshot,
} from '@/lib/fsrs'

import type { Db } from '@/platform/db'

import { getPracticeProgressSummary } from '@/features/practice/server/practice-service'
import { getSettings } from '@/features/settings/server/settings-service'
import type { AnalyticsRange } from '../api/analytics-contracts'

import {
  getReviewDayStats,
  getReviewHistory,
  getCurrentFsrsCards,
  getMemoryProfileCards,
  getUpcomingCards,
  getWeakProblemCandidates,
  getRetentionScatterCandidates,
  type CurrentFsrsCard,
  type MemoryProfileCard,
} from '../data/analytics-repository'

import {
  buildHardAgainSummary,
  buildOverdueBacklogPoints,
  buildPredictedRecallSamples,
  buildPracticeRhythmPoints,
  buildRatingsMixPoints,
  buildRecallQualityPoints,
  buildRetentionHealth,
  buildStabilityPoints,
  buildTopicPoints,
  buildUpcomingLoadPoints,
  getValidStabilitySample,
  hasObservedCorrectnessReview,
  hasTopicRecallEvidence,
  hasValidReviewRating,
  reconstructOverdueBacklogSnapshots,
  type AnalyticsCurrentCard,
  type AnalyticsRangeOptions,
  type AnalyticsReviewEvent,
} from '../domain/chart-data'
import {
  calculateAnalyticsReadiness,
  findRichestReadyRange,
  type AnalyticsReadiness,
} from '../domain/analytics-readiness'
import {
  buildAnalyticsBucketsFromTimeFrame,
  type AnalyticsBucket,
} from '../domain/analytics-range-policy'
import {
  buildAnalyticsTimeFrame,
  buildForecastBounds,
  getAnalyticsDateKey,
} from '../domain/analytics-time'
import { buildHistoricalAnalyticsViews } from '../domain/historical-presentation'
import { buildCurrentStateAnalyticsViews } from '../domain/current-state-presentation'

import {
  buildObservedRatingQuality,
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
  nowOrOptions:
    | Date
    | { range: AnalyticsRange; now?: Date; timeZone?: string } = new Date(),
): Promise<AnalyticsSummary> {
  const now =
    nowOrOptions instanceof Date
      ? nowOrOptions
      : (nowOrOptions.now ?? new Date())
  const range = nowOrOptions instanceof Date ? 30 : nowOrOptions.range
  const timeZone =
    nowOrOptions instanceof Date ? 'UTC' : (nowOrOptions.timeZone ?? 'UTC')
  const presentationTimeFrame = buildAnalyticsTimeFrame({
    asOf: now,
    requestedDays: range,
    timeZone,
  })
  const periodEnd = new Date(presentationTimeFrame.asOf)
  const buckets = buildAnalyticsBucketsFromTimeFrame(presentationTimeFrame)
  const periodStart = buckets[0]!.start
  const forecastBounds = buildForecastBounds({
    asOf: now,
    timeZone: presentationTimeFrame.timeZone,
  })
  const fourteenDaysLater = new Date(forecastBounds.end)

  const [
    dayStats,
    reviewHistory,
    currentFsrsCards,
    upcomingCards,
    weakCandidates,
    memoryProfileCards,
    settings,
    scatterCandidates,
  ] = await Promise.all([
    getReviewDayStats(db),
    getReviewHistory(db),
    getCurrentFsrsCards(db),
    getUpcomingCards(db, fourteenDaysLater),
    getWeakProblemCandidates(db),
    getMemoryProfileCards(db),
    getSettings(db),
    getRetentionScatterCandidates(db),
  ])

  const fsrsOptions = normalizeFsrsSchedulingOptions({
    targetRetention: settings.review.targetRetention,
  })
  const recentRatings = reviewHistory.map(({ rating, reviewedAt }) => ({
    rating,
    reviewedAt,
  }))

  const practiceProgress = await getPracticeProgressSummary(db, {
    dailyGoal: settings.practice.dailyGoal,
  })

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
          fsrsOptions,
        ),
      },
    ]
  })

  // Step 4: build domain objects
  const observedRatingQuality = buildObservedRatingQuality(
    recentRatings,
    now,
    range,
    {
      periodStart: new Date(presentationTimeFrame.periodStart),
      periodEnd: new Date(presentationTimeFrame.periodEnd),
    },
  )
  const forecast = buildDueForecast(
    upcomingCards,
    now,
    presentationTimeFrame.timeZone,
  )
  const weakProblems = buildWeakProblems(enrichedCandidates)
  const memoryProfile = buildMemoryProfileInput(
    memoryProfileCards,
    now,
    fsrsOptions,
    presentationTimeFrame.timeZone,
  )

  const chartOptions: AnalyticsRangeOptions = {
    start: periodStart,
    end: now,
    buckets,
    fsrsOptions,
    timeZone: presentationTimeFrame.timeZone,
    timeFrame: presentationTimeFrame,
  }
  const analyticsReviewHistory = reviewHistory satisfies AnalyticsReviewEvent[]
  const analyticsCurrentCards = buildCurrentAnalyticsCards(
    currentFsrsCards,
    now,
    fsrsOptions,
  )
  const historicalViews = buildHistoricalAnalyticsViews(
    analyticsReviewHistory,
    {
      buckets,
      end: new Date(presentationTimeFrame.asOf),
      fsrsOptions,
      start: periodStart,
      timeZone: presentationTimeFrame.timeZone,
      timeFrame: presentationTimeFrame,
    },
  )
  const currentStateViews = buildCurrentStateAnalyticsViews(
    analyticsCurrentCards.map((card) => ({
      cardId: card.cardId,
      slug: card.slug,
      title: card.title,
      retrievability: card.retrievability,
      targetDurationDays: card.fsrsCard
        ? getTargetRetentionDuration(
            card.fsrsCard,
            fsrsOptions.targetRetention,
            fsrsOptions,
          )
        : null,
      dueAt: card.dueAt,
      difficulty: card.difficulty,
      lapseCount: card.lapseCount,
      lastReviewAt: card.lastReviewAt,
      suspended: card.suspended ?? false,
    })),
    {
      asOf: now,
      targetRetention: fsrsOptions.targetRetention,
      timeZone: presentationTimeFrame.timeZone,
    },
  )
  const views = { ...historicalViews, ...currentStateViews }
  const baselineEvidenceCounts = buildBucketEvidenceCounts(
    analyticsReviewHistory,
    buckets,
    periodEnd,
    hasValidReviewRating,
  )
  const requestedReadiness = calculateAnalyticsReadiness({
    requestedDays: range,
    evidenceCounts: baselineEvidenceCounts,
    bucketKeys: buckets.map((bucket) => bucket.key),
  })
  const correctnessEvidenceCounts = buildBucketEvidenceCounts(
    analyticsReviewHistory,
    buckets,
    periodEnd,
    hasObservedCorrectnessReview,
  )
  const recallReadiness = calculateAnalyticsReadiness({
    requestedDays: range,
    evidenceCounts: correctnessEvidenceCounts,
    bucketKeys: buckets.map((bucket) => bucket.key),
  })
  const practiceRhythmReadiness = calculateAnalyticsReadiness({
    requestedDays: range,
    evidenceCounts: correctnessEvidenceCounts,
    bucketKeys: buckets.map((bucket) => bucket.key),
  })
  const ratingsMixReadiness = requestedReadiness

  const recallQuality = buildRecallQualityPoints(
    analyticsReviewHistory,
    chartOptions,
  )
  const predictedRecall = buildMetricSummary(
    buildPredictedRecallSamples(analyticsReviewHistory, chartOptions).map(
      (sample) => sample.value,
    ),
  )
  const practiceRhythm = buildPracticeRhythmPoints(
    analyticsReviewHistory,
    chartOptions,
  )
  const ratingsMix = trimHistoricalPoints(
    buildRatingsMixPoints(analyticsReviewHistory, chartOptions),
    ratingsMixReadiness,
  )
  const hardAgain = buildHardAgainSummary(analyticsReviewHistory, chartOptions)
  const topics = buildTopicPoints(analyticsReviewHistory, chartOptions)
  const topicReadiness = calculateAnalyticsReadiness({
    requestedDays: range,
    evidenceCounts: buildBucketEvidenceCounts(
      analyticsReviewHistory,
      buckets,
      periodEnd,
      hasTopicRecallEvidence,
    ),
    bucketKeys: buckets.map((bucket) => bucket.key),
  })
  const stability = buildStabilityPoints(analyticsReviewHistory, chartOptions)
  const stabilityReadiness = calculateAnalyticsReadiness({
    requestedDays: range,
    evidenceCounts: buildBucketEvidenceCounts(
      analyticsReviewHistory,
      buckets,
      periodEnd,
      (event) => getValidStabilitySample(event) !== null,
    ),
    bucketKeys: buckets.map((bucket) => bucket.key),
  })
  const overdueSnapshots = reconstructOverdueBacklogSnapshots(
    analyticsReviewHistory,
    analyticsCurrentCards,
    chartOptions,
  )
  const overdueBacklogResult = buildOverdueBacklogPoints(
    overdueSnapshots,
    chartOptions,
  )
  const overdueReadiness = calculateAnalyticsReadiness({
    requestedDays: range,
    evidenceCounts: bucketCountsFromDatedObservations(
      buckets,
      overdueSnapshots,
    ),
    bucketKeys: buckets.map((bucket) => bucket.key),
  })
  const overdueBacklog = overdueBacklogResult.points
  const historicalReadiness = {
    requested: requestedReadiness,
    recallQuality: recallReadiness,
    practiceRhythm: practiceRhythmReadiness,
    ratingsMix: ratingsMixReadiness,
    topics: topicReadiness,
    stability: stabilityReadiness,
    overdueBacklog: overdueReadiness,
    recommendedRange: requestedReadiness.ready
      ? null
      : findRecommendedRange(
          analyticsReviewHistory,
          now,
          range,
          presentationTimeFrame.timeZone,
        ),
  }
  const upcomingLoad = buildUpcomingLoadPoints(
    upcomingCards.map((card) => card.dueAt),
    now,
    presentationTimeFrame.timeZone,
  )
  const { health: retentionHealth, fragile: fragileKnowledge } =
    buildRetentionHealth(analyticsCurrentCards, now, {
      fragileDifficultyThreshold: 7,
    })

  const dayMs = 24 * 60 * 60 * 1000

  const enrichedScatter: RetentionScatterEntry[] = scatterCandidates.map(
    (c) => ({
      slug: c.slug,
      title: c.title,
      retrievability: getRetrievability(
        buildMinimalCard(
          c.stability,
          c.difficulty,
          c.lapseCount,
          c.lastReviewAt,
        ),
        now,
        fsrsOptions,
      ),
      daysSinceReview: Math.round(
        (now.getTime() - c.lastReviewAt.getTime()) / dayMs,
      ),
      difficulty: c.difficulty,
      stability: c.stability,
      lapseCount: c.lapseCount,
      lastReviewAt: c.lastReviewAt.toISOString(),
    }),
  )

  const medianStability = computeMedianStability(
    scatterCandidates.map((c) => c.stability),
  )
  const maxDays = Math.max(
    14,
    ...enrichedScatter.map((e) => e.daysSinceReview),
    0,
  )
  const precomputedCurve: ReferenceCurvePoint[] = Array.from(
    { length: maxDays + 1 },
    (_, day) => ({
      days: day,
      retrievability: getRetrievability(
        buildMinimalCard(
          medianStability,
          5,
          0,
          new Date(now.getTime() - day * dayMs),
        ),
        now,
        fsrsOptions,
      ),
    }),
  )

  const { scatter, referenceCurve } = buildRetentionScatter(
    enrichedScatter,
    precomputedCurve,
  )

  // Step 5: assemble
  return buildAnalyticsSummary({
    generatedAt: now,
    timeFrame: presentationTimeFrame,
    reviewDays: dayStats.reviewDays,
    totalReviews: dayStats.totalReviews,
    currentStreak: practiceProgress.currentStreak,
    observedRatingQuality,
    range,
    forecast,
    weakProblems,
    memoryProfile,
    targetRetention: fsrsOptions.targetRetention,
    views,
    scatter,
    referenceCurve,
    historicalReadiness,
    predictedRecall,
    recallQuality,
    practiceRhythm,
    ratingsMix,
    hardAgain,
    topics,
    stability,
    overdueBacklog,
    overdueHistoryAvailableFrom:
      overdueBacklogResult.overdueHistoryAvailableFrom,
    upcomingLoad,
    retentionHealth,
    fragileKnowledge,
  })
}

function buildMemoryProfileInput(
  cards: MemoryProfileCard[],
  now: Date,
  fsrsOptions: ReturnType<typeof normalizeFsrsSchedulingOptions>,
  timeZone = 'UTC',
) {
  const activeCards = cards.filter((card) => !isSuspendedMemoryCard(card))
  const todayKey = getAnalyticsDateKey(now, timeZone)

  return buildMemoryProfile({
    totalTracked: cards.length,
    dueToday: activeCards.filter(
      (card) =>
        card.dueAt < now ||
        getAnalyticsDateKey(card.dueAt, timeZone) === todayKey,
    ).length,
    overdue: activeCards.filter((card) => card.dueAt < now).length,
    learning: activeCards.filter(isLearningMemoryCard).length,
    review: activeCards.filter(isReviewMemoryCard).length,
    mastered: activeCards.filter((card) => card.practiceStatus === 'mastered')
      .length,
    suspended: cards.filter(isSuspendedMemoryCard).length,
    retrievabilities: activeCards.flatMap((card) =>
      card.lastReviewAt
        ? [getRetrievability(buildMemoryCard(card), now, fsrsOptions)]
        : [],
    ),
  })
}

function buildCurrentAnalyticsCards(
  cards: CurrentFsrsCard[],
  now: Date,
  fsrsOptions: ReturnType<typeof normalizeFsrsSchedulingOptions>,
): AnalyticsCurrentCard[] {
  return cards.map((card) => {
    const fsrsCard = buildCurrentCard(card)
    return {
      fsrsCard,
      cardId: card.cardId,
      slug: card.problemSlug,
      title: card.title,
      topics: card.topics,
      retrievability: getRetrievability(fsrsCard, now, fsrsOptions),
      targetRetention: fsrsOptions.targetRetention,
      stabilityDays: card.stability,
      difficulty: card.difficulty,
      lapseCount: card.lapses,
      dueAt: card.dueAt,
      createdAt: card.createdAt,
      lastReviewAt: card.lastReviewAt,
      suspended: card.isSuspended || card.practiceStatus === 'suspended',
    }
  })
}

function buildCurrentCard(card: CurrentFsrsCard): FsrsCardSnapshot {
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

function buildMetricSummary(
  values: readonly number[],
  lowSampleThreshold = 10,
): { value: number | null; sampleSize: number; lowSample: boolean } {
  const sampleSize = values.length
  if (sampleSize < lowSampleThreshold) {
    return { value: null, sampleSize, lowSample: true }
  }

  return {
    value: values.reduce((sum, value) => sum + value, 0) / sampleSize,
    sampleSize,
    lowSample: false,
  }
}

function buildBucketEvidenceCounts(
  events: readonly AnalyticsReviewEvent[],
  buckets: readonly AnalyticsBucket[],
  periodEnd: Date,
  isEligible: (event: AnalyticsReviewEvent) => boolean,
): number[] {
  return buckets.map(
    (bucket) =>
      events.filter(
        (event) =>
          event.reviewedAt >= bucket.start &&
          event.reviewedAt <= bucket.end &&
          event.reviewedAt <= periodEnd &&
          isEligible(event),
      ).length,
  )
}

function bucketCountsFromDatedObservations<T extends { date: Date }>(
  buckets: readonly AnalyticsBucket[],
  observations: readonly T[],
): number[] {
  return buckets.map(
    (bucket) =>
      observations.filter(
        (observation) =>
          observation.date >= bucket.start && observation.date <= bucket.end,
      ).length,
  )
}

function trimHistoricalPoints<T extends { bucketStart: string }>(
  points: readonly T[],
  readiness: AnalyticsReadiness,
): T[] {
  if (readiness.effectiveStart === null) return []

  const effectiveStartIndex = points.findIndex(
    (point) => point.bucketStart === readiness.effectiveStart,
  )

  return effectiveStartIndex === -1 ? [] : points.slice(effectiveStartIndex)
}

function findRecommendedRange(
  events: readonly AnalyticsReviewEvent[],
  now: Date,
  requestedDays: AnalyticsRange,
  timeZone: string,
): AnalyticsRange | null {
  const ranges = ([14, 30, 90] as const)
    .filter((range) => range < requestedDays)
    .map((range) => {
      const buckets = buildAnalyticsBucketsFromTimeFrame(
        buildAnalyticsTimeFrame({
          asOf: now,
          requestedDays: range,
          timeZone,
        }),
      )
      const readiness = calculateAnalyticsReadiness({
        requestedDays: range,
        evidenceCounts: buildBucketEvidenceCounts(
          events,
          buckets,
          now,
          hasValidReviewRating,
        ),
        bucketKeys: buckets.map((bucket) => bucket.key),
      })

      return { range, ready: readiness.ready }
    })

  const recommendedRange = findRichestReadyRange(ranges)
  return recommendedRange === 14 ||
    recommendedRange === 30 ||
    recommendedRange === 90
    ? recommendedRange
    : null
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
