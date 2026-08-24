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
  getUpcomingCards,
  type CurrentFsrsCard,
} from '../data/analytics-repository'

import {
  buildHardAgainSummary,
  buildPredictedRecallSamples,
  buildPracticeRhythmPoints,
  buildRatingsMixPoints,
  buildRecallQualityPoints,
  buildStabilityPoints,
  buildTopicPoints,
  buildUpcomingLoadPoints,
  hasValidReviewRating,
  reconstructOverdueBacklogSnapshots,
  type AnalyticsCurrentCard,
  type AnalyticsRangeOptions,
  type AnalyticsReviewEvent,
} from '../domain/chart-data'
import {
  buildAnalyticsBucketsFromTimeFrame,
  selectAnalyticsLongRangePolicy,
} from '../domain/analytics-range-policy'
import {
  buildForecastBounds,
  buildSelectedAnalyticsTimeFrame,
  resolveAnalyticsTimeZone,
  type SelectedAnalyticsTimeFrame,
} from '../domain/analytics-time'
import {
  buildHistoricalAnalyticsPresentation,
  type HistoricalAnalyticsEvidenceObservations,
  type HistoricalAnalyticsViews,
} from '../domain/historical-presentation'
import { buildCurrentStateAnalyticsViews } from '../domain/current-state-presentation'
import { buildWorkloadAnalyticsViews } from '../domain/workload-presentation'
import { classifyAnalyticsEvidence } from '../domain/analytics-evidence'

import {
  buildObservedRatingQuality,
  buildAnalyticsSummary,
  type AnalyticsSummary,
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
  const range = nowOrOptions instanceof Date ? 90 : nowOrOptions.range
  const requestedTimeZone =
    nowOrOptions instanceof Date ? 'UTC' : (nowOrOptions.timeZone ?? 'UTC')
  const timeZoneResolution = resolveAnalyticsTimeZone(requestedTimeZone)
  const { timeZone } = timeZoneResolution
  const forecastBounds = buildForecastBounds({
    asOf: now,
    timeZone,
  })
  const fourteenDaysLater = new Date(forecastBounds.end)

  const [dayStats, reviewHistory, currentFsrsCards, upcomingCards, settings] =
    await Promise.all([
      getReviewDayStats(db),
      getReviewHistory(db),
      getCurrentFsrsCards(db),
      getUpcomingCards(db, fourteenDaysLater),
      getSettings(db),
    ])

  const fsrsOptions = normalizeFsrsSchedulingOptions({
    targetRetention: settings.review.targetRetention,
  })
  const allTimeStart = getEarliestEligibleRatingDate(reviewHistory, now)
  const longRangePolicy = selectAnalyticsLongRangePolicy({
    requestedRange: range,
    allTimeStart,
    asOf: now,
    timeZone,
  })
  const selectedTimeFrame = buildSelectedAnalyticsTimeFrame({
    asOf: now,
    requestedRange: range,
    allTimeStart,
    timeZone,
    bucketGrain: longRangePolicy.bucketGrain,
  })
  const presentationTimeFrame = {
    ...selectedTimeFrame,
    timeZoneFallback: timeZoneResolution.fallback,
  }
  const workloadTimeFrame = buildSelectedAnalyticsTimeFrame({
    asOf: now,
    requestedRange: 120,
    allTimeStart: null,
    timeZone,
    bucketGrain: 'week',
  })
  const periodEnd = new Date(presentationTimeFrame.asOf)
  const buckets = buildAnalyticsBucketsFromTimeFrame(presentationTimeFrame)
  const periodStart = presentationTimeFrame.periodStart
    ? new Date(presentationTimeFrame.periodStart)
    : periodEnd
  const recentRatings = reviewHistory.map(({ rating, reviewedAt }) => ({
    rating,
    reviewedAt,
  }))

  const practiceProgress = await getPracticeProgressSummary(db, {
    dailyGoal: settings.practice.dailyGoal,
  })

  // Step 4: build domain objects
  const observedRatingQuality = buildObservedRatingQuality(
    recentRatings,
    now,
    range,
    presentationTimeFrame.periodStart
      ? {
          periodStart: new Date(presentationTimeFrame.periodStart),
          periodEnd: new Date(presentationTimeFrame.periodEnd),
        }
      : undefined,
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
  const historicalPresentation = buildHistoricalAnalyticsPresentation(
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
  const historicalViewsWithEvidence = attachHistoricalEvidence(
    historicalPresentation.views,
    presentationTimeFrame,
    historicalPresentation.evidenceObservations,
  )
  const baseViews = { ...historicalViewsWithEvidence, ...currentStateViews }

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
  const ratingsMix = buildRatingsMixPoints(analyticsReviewHistory, chartOptions)
  const hardAgain = buildHardAgainSummary(analyticsReviewHistory, chartOptions)
  const topics = buildTopicPoints(analyticsReviewHistory, chartOptions)
  const stability = buildStabilityPoints(analyticsReviewHistory, chartOptions)
  const overdueSnapshots = reconstructOverdueBacklogSnapshots(
    analyticsReviewHistory,
    analyticsCurrentCards,
    { ...chartOptions, timeFrame: workloadTimeFrame },
  )
  const upcomingLoad = buildUpcomingLoadPoints(
    upcomingCards.map((card) => card.dueAt),
    now,
    presentationTimeFrame.timeZone,
  )
  const workloadViews = buildWorkloadAnalyticsViews({
    overdueSnapshots,
    timeFrame: presentationTimeFrame,
    upcomingLoad,
  })
  const views = { ...baseViews, ...workloadViews }
  // Step 5: assemble
  return buildAnalyticsSummary({
    generatedAt: now,
    timeFrame: presentationTimeFrame,
    reviewDays: dayStats.reviewDays,
    totalReviews: dayStats.totalReviews,
    currentStreak: practiceProgress.currentStreak,
    observedRatingQuality,
    range,
    targetRetention: fsrsOptions.targetRetention,
    views,
    predictedRecall,
    recallQuality,
    practiceRhythm,
    ratingsMix,
    hardAgain,
    topics,
    stability,
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

function getEarliestEligibleRatingDate(
  events: readonly AnalyticsReviewEvent[],
  asOf: Date,
): Date | null {
  return events.reduce<Date | null>((earliest, event) => {
    if (
      !hasValidReviewRating(event) ||
      !Number.isFinite(event.reviewedAt.getTime()) ||
      event.reviewedAt > asOf
    ) {
      return earliest
    }

    return earliest === null || event.reviewedAt < earliest
      ? event.reviewedAt
      : earliest
  }, null)
}

function attachHistoricalEvidence(
  views: HistoricalAnalyticsViews,
  timeFrame: SelectedAnalyticsTimeFrame,
  observations: HistoricalAnalyticsEvidenceObservations,
) {
  return {
    ...views,
    observedRecallVsFsrs: {
      ...views.observedRecallVsFsrs,
      evidence: classifyHistoricalViewEvidence(
        timeFrame,
        observations.observedRecallVsFsrs,
      ),
    },
    memoryStrength: {
      ...views.memoryStrength,
      evidence: classifyHistoricalViewEvidence(
        timeFrame,
        observations.memoryStrength,
      ),
    },
    practiceRhythm: {
      ...views.practiceRhythm,
      evidence: classifyHistoricalViewEvidence(
        timeFrame,
        observations.practiceRhythm,
      ),
    },
    ratingsMix: {
      ...views.ratingsMix,
      evidence: classifyHistoricalViewEvidence(
        timeFrame,
        observations.ratingsMix,
      ),
    },
  }
}

function classifyHistoricalViewEvidence(
  timeFrame: SelectedAnalyticsTimeFrame,
  observations: readonly { observedAt: Date; value: number }[],
) {
  const asOf = new Date(timeFrame.asOf)

  return {
    ...classifyAnalyticsEvidence({
      asOf,
      periodStart: timeFrame.periodStart
        ? new Date(timeFrame.periodStart)
        : null,
      timeZone: timeFrame.timeZone,
      buckets: timeFrame.buckets.map((bucket) => {
        const bucketStart = new Date(bucket.start)
        const bucketEnd = new Date(bucket.end)
        return {
          key: bucket.key,
          observations: observations.filter(
            (observation) =>
              observation.observedAt >= bucketStart &&
              (observation.observedAt < bucketEnd ||
                (bucket.isPartial &&
                  observation.observedAt.getTime() === asOf.getTime())),
          ),
        }
      }),
    }),
    selectedBucketCount: timeFrame.buckets.length,
  }
}
