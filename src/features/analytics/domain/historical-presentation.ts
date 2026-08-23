import {
  createInitialFsrsCard,
  getRetrievability,
  isReviewRating,
  replayReviewHistorySequence,
  type NormalizedFsrsSchedulingOptions,
  type ReviewRating,
} from '@/lib/fsrs'

import type { AnalyticsBucket } from './analytics-range-policy'
import {
  buildAdaptiveDurationScale,
  buildAdaptivePercentageDomain,
  buildMagnitudeScale,
  type AnalyticsScale,
} from './analytics-scales'

export interface HistoricalAnalyticsReviewEvent {
  id: string
  cardId: string
  rating: string
  reviewedAt: Date
  fsrsReviewLog: string | null
}

type ValidHistoricalReviewEvent = HistoricalAnalyticsReviewEvent & {
  rating: ReviewRating
}

export interface HistoricalPresentationOptions {
  start: Date
  end: Date
  buckets: readonly AnalyticsBucket[]
  fsrsOptions: NormalizedFsrsSchedulingOptions
  timeZone: string
}

export interface HistoricalPresentationScale {
  domain: readonly [number, number]
  ticks: readonly number[]
}

export interface ObservedRecallVsFsrsRow {
  id: string
  bucketStart: string
  bucketEnd: string
  isPartial: boolean
  recalledCount: number
  pairedReviews: number
  observedRecall: number | null
  fsrsEstimate: number | null
  difference: number | null
  provenance: 'reconstructed'
  evidence: 'measured' | 'not-measured'
}

export interface MemoryStrengthRow {
  id: string
  bucketStart: string
  bucketEnd: string
  isPartial: boolean
  medianStrengthDays: number | null
  q1: number | null
  q3: number | null
  eligibleReviews: number
  medianChangeDays: number | null
  provenance: 'reconstructed'
  evidence: 'measured' | 'not-measured'
}

export interface PracticeRhythmRow {
  id: string
  bucketStart: string
  bucketEnd: string
  isPartial: boolean
  completedReviews: number
  goodEasy: number
  validRatings: number
  reviewSuccess: number | null
  evidence: 'measured' | 'not-measured'
}

export interface HistoricalAnalyticsViews {
  observedRecallVsFsrs: {
    rows: ObservedRecallVsFsrsRow[]
    scale: HistoricalPresentationScale
    targetRetention: number
  }
  memoryStrength: {
    rows: MemoryStrengthRow[]
    scale: HistoricalPresentationScale
  }
  practiceRhythm: {
    rows: PracticeRhythmRow[]
    countScale: HistoricalPresentationScale
    percentageScale: HistoricalPresentationScale
  }
}

export function buildHistoricalAnalyticsViews(
  events: readonly HistoricalAnalyticsReviewEvent[],
  options: HistoricalPresentationOptions,
): HistoricalAnalyticsViews {
  const pairedByEvent = buildPairedReviews(events, options)
  const stabilityByEvent = buildStabilityObservations(events, options)
  const observedRows = options.buckets.map((bucket) => {
    const pairs = pairedByEvent.filter((pair) =>
      inBucket(pair.reviewedAt, bucket),
    )
    const pairedReviews = pairs.length
    const recalledCount = pairs.filter((pair) => pair.rating !== 'again').length
    const observedRecall =
      pairedReviews === 0 ? null : recalledCount / pairedReviews
    const fsrsEstimate =
      pairedReviews === 0 ? null : mean(pairs.map((pair) => pair.estimate))

    return {
      ...bucketRow(bucket, options.end),
      recalledCount,
      pairedReviews,
      observedRecall,
      fsrsEstimate,
      difference:
        observedRecall === null || fsrsEstimate === null
          ? null
          : observedRecall - fsrsEstimate,
      provenance: 'reconstructed' as const,
      evidence:
        pairedReviews === 0 ? ('not-measured' as const) : ('measured' as const),
    }
  })
  const memoryRows = options.buckets.map((bucket) => {
    const observations = stabilityByEvent.filter((sample) =>
      inBucket(sample.reviewedAt, bucket),
    )
    const strengths = observations.map((sample) => sample.postReviewStability)
    const changes = observations.flatMap((sample) =>
      sample.preReviewStability === null
        ? []
        : [sample.postReviewStability - sample.preReviewStability],
    )
    const [q1, q3] =
      strengths.length >= 4 ? tukeyHinges(strengths) : [null, null]

    return {
      ...bucketRow(bucket, options.end),
      medianStrengthDays: median(strengths),
      q1,
      q3,
      eligibleReviews: strengths.length,
      medianChangeDays: median(changes),
      provenance: 'reconstructed' as const,
      evidence:
        strengths.length === 0
          ? ('not-measured' as const)
          : ('measured' as const),
    }
  })
  const rhythmRows = options.buckets.map((bucket) => {
    const ratings = events.filter(
      (event) =>
        event.reviewedAt >= options.start &&
        event.reviewedAt <= options.end &&
        inBucket(event.reviewedAt, bucket) &&
        isReviewRating(event.rating),
    )
    const goodEasy = ratings.filter(
      (event) => event.rating === 'good' || event.rating === 'easy',
    ).length

    return {
      ...bucketRow(bucket, options.end),
      completedReviews: ratings.length,
      goodEasy,
      validRatings: ratings.length,
      reviewSuccess: ratings.length === 0 ? null : goodEasy / ratings.length,
      evidence: 'measured' as const,
    }
  })

  const durationScale = buildAdaptiveDurationScale(
    memoryRows.flatMap((row) =>
      [row.medianStrengthDays, row.q1, row.q3].filter(
        (value): value is number => value !== null,
      ),
    ),
  )
  const countScale = buildMagnitudeScale(
    rhythmRows.map((row) => row.completedReviews),
  )

  return {
    observedRecallVsFsrs: {
      rows: observedRows,
      scale: percentageScale(
        observedRows.flatMap((row) => [row.observedRecall, row.fsrsEstimate]),
        [options.fsrsOptions.targetRetention],
      ),
      targetRetention: options.fsrsOptions.targetRetention,
    },
    memoryStrength: {
      rows: memoryRows,
      scale: toPresentationScale(durationScale),
    },
    practiceRhythm: {
      rows: rhythmRows,
      countScale: toPresentationScale(countScale),
      percentageScale: percentageScale(
        rhythmRows.map((row) => row.reviewSuccess),
      ),
    },
  }
}

function buildPairedReviews(
  events: readonly HistoricalAnalyticsReviewEvent[],
  options: HistoricalPresentationOptions,
) {
  const pairs: Array<{
    reviewedAt: Date
    rating: ReviewRating
    estimate: number
  }> = []
  const byCard = new Map<string, ValidHistoricalReviewEvent[]>()
  for (const event of events) {
    if (!hasValidRating(event)) continue
    const cardEvents = byCard.get(event.cardId) ?? []
    cardEvents.push(event)
    byCard.set(event.cardId, cardEvents)
  }

  for (const cardEvents of byCard.values()) {
    const ordered = [...cardEvents].sort(compareEvents)
    const replayed = replayReviewHistorySequence(
      ordered.map((event) => ({
        rating: event.rating,
        reviewedAt: event.reviewedAt,
      })),
      options.fsrsOptions,
    )
    for (const [index, event] of ordered.entries()) {
      if (event.reviewedAt < options.start || event.reviewedAt > options.end)
        continue
      const previous =
        replayed[index - 1]?.card ?? createInitialFsrsCard(event.reviewedAt)
      const probability = getRetrievability(
        previous,
        event.reviewedAt,
        options.fsrsOptions,
      )
      if (
        Number.isFinite(probability) &&
        probability >= 0 &&
        probability <= 1
      ) {
        pairs.push({
          reviewedAt: event.reviewedAt,
          rating: event.rating,
          estimate: probability,
        })
      }
    }
  }
  return pairs
}

function buildStabilityObservations(
  events: readonly HistoricalAnalyticsReviewEvent[],
  options: HistoricalPresentationOptions,
) {
  const observations: Array<{
    reviewedAt: Date
    postReviewStability: number
    preReviewStability: number | null
  }> = []
  const byCard = new Map<string, ValidHistoricalReviewEvent[]>()
  for (const event of events) {
    if (!hasValidRating(event)) continue
    const cardEvents = byCard.get(event.cardId) ?? []
    cardEvents.push(event)
    byCard.set(event.cardId, cardEvents)
  }
  for (const cardEvents of byCard.values()) {
    const ordered = [...cardEvents].sort(compareEvents)
    const replayed = replayReviewHistorySequence(
      ordered.map((event) => ({
        rating: event.rating,
        reviewedAt: event.reviewedAt,
      })),
      options.fsrsOptions,
    )
    for (const [index, event] of ordered.entries()) {
      if (event.reviewedAt < options.start || event.reviewedAt > options.end)
        continue
      const postReviewStability = replayed[index]?.card.stability
      if (
        postReviewStability === undefined ||
        !Number.isFinite(postReviewStability) ||
        postReviewStability <= 0
      )
        continue
      const preReviewStability = replayed[index - 1]?.card.stability
      observations.push({
        reviewedAt: event.reviewedAt,
        postReviewStability,
        preReviewStability:
          preReviewStability !== undefined &&
          Number.isFinite(preReviewStability) &&
          preReviewStability > 0
            ? preReviewStability
            : null,
      })
    }
  }
  return observations
}

function bucketRow(bucket: AnalyticsBucket, end: Date) {
  return {
    id: bucket.key,
    bucketStart: bucket.startKey ?? bucket.key,
    bucketEnd: bucket.endKey ?? bucket.key,
    isPartial: bucket.end.getTime() >= end.getTime(),
  }
}

function percentageScale(
  values: readonly (number | null)[],
  references: readonly number[] = [],
): HistoricalPresentationScale {
  const domain = buildAdaptivePercentageDomain(
    values.filter((value): value is number => value !== null),
    references,
  )
  const ticks = Array.from(
    { length: Math.round((domain[1] - domain[0]) / 0.05) + 1 },
    (_, index) => Number((domain[0] + index * 0.05).toFixed(2)),
  )
  return { domain, ticks }
}

function toPresentationScale(
  scale: AnalyticsScale,
): HistoricalPresentationScale {
  return { domain: scale.domain, ticks: scale.ticks }
}

function inBucket(date: Date, bucket: AnalyticsBucket): boolean {
  return date >= bucket.start && date <= bucket.end
}

function compareEvents(
  left: HistoricalAnalyticsReviewEvent,
  right: HistoricalAnalyticsReviewEvent,
): number {
  return (
    left.reviewedAt.getTime() - right.reviewedAt.getTime() ||
    left.id.localeCompare(right.id)
  )
}

function hasValidRating(
  event: HistoricalAnalyticsReviewEvent,
): event is ValidHistoricalReviewEvent {
  return isReviewRating(event.rating)
}

function mean(values: readonly number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!
}

function tukeyHinges(values: readonly number[]): [number, number] {
  const sorted = [...values].sort((a, b) => a - b)
  const split = Math.floor(sorted.length / 2)
  const lower = sorted.slice(0, split)
  const upper = sorted.slice(sorted.length % 2 === 0 ? split : split + 1)
  return [median(lower)!, median(upper)!]
}
