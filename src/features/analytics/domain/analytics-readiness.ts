import { getAnalyticsRangePolicy } from './analytics-range-policy'

export type ReadinessFailure =
  | 'no-evidence'
  | 'insufficient-span'
  | 'insufficient-assessments'
  | 'insufficient-active-buckets'
  | 'gap-too-long'
  | 'too-many-gaps'

export interface AnalyticsReadinessInput {
  requestedDays: number
  counts: readonly number[]
  keys: readonly string[]
}

export interface AnalyticsReadiness {
  ready: boolean
  requestedDays: number
  bucketDays: number
  requestedBuckets: number
  effectiveBuckets: number
  effectiveStart: string | null
  assessments: number
  minimumAssessments: number
  activeBuckets: number
  minimumActiveBuckets: number
  longestGap: number
  maximumGap: number
  gapRuns: number
  maximumGapRuns: number
  failingReasons: ReadinessFailure[]
}

export function evaluateAnalyticsReadiness({
  requestedDays,
  counts,
  keys,
}: AnalyticsReadinessInput): AnalyticsReadiness {
  const { bucketDays, maximumGapBuckets } =
    getAnalyticsRangePolicy(requestedDays)

  if (counts.length !== keys.length) {
    throw new RangeError('Analytics readiness keys and counts must align.')
  }
  if (
    counts.some(
      (count) =>
        !Number.isInteger(count) || count < 0 || !Number.isFinite(count),
    )
  ) {
    throw new RangeError(
      'Analytics readiness counts must be non-negative integers.',
    )
  }

  const firstEvidence = counts.findIndex((count) => count > 0)
  const effectiveCounts =
    firstEvidence === -1 ? [] : counts.slice(firstEvidence)
  const effectiveKeys = firstEvidence === -1 ? [] : keys.slice(firstEvidence)
  const effectiveBuckets = effectiveCounts.length
  const assessments = effectiveCounts.reduce((sum, count) => sum + count, 0)
  const activeBuckets = effectiveCounts.filter((count) => count > 0).length
  const { longestGap, gapRuns } = measureGaps(effectiveCounts)

  const minimumAssessments = Math.ceil(
    Math.max(12, requestedDays * 0.5, Math.min(requestedDays, 30) * 0.8),
  )
  const minimumActiveBuckets = Math.ceil(
    coverage(requestedDays) * effectiveBuckets,
  )
  const minimumEffectiveBuckets = Math.ceil((keys.length || 0) * 0.6)
  const maximumGapRuns = Math.max(1, Math.ceil(effectiveBuckets * 0.2))

  const failingReasons: ReadinessFailure[] = []
  if (effectiveBuckets === 0) failingReasons.push('no-evidence')
  if (effectiveBuckets < minimumEffectiveBuckets) {
    failingReasons.push('insufficient-span')
  }
  if (assessments < minimumAssessments) {
    failingReasons.push('insufficient-assessments')
  }
  if (activeBuckets < minimumActiveBuckets) {
    failingReasons.push('insufficient-active-buckets')
  }
  if (longestGap > maximumGapBuckets) failingReasons.push('gap-too-long')
  if (gapRuns > maximumGapRuns) failingReasons.push('too-many-gaps')

  return {
    ready: failingReasons.length === 0,
    requestedDays,
    bucketDays,
    requestedBuckets: keys.length,
    effectiveBuckets,
    effectiveStart: effectiveKeys[0] ?? null,
    assessments,
    minimumAssessments,
    activeBuckets,
    minimumActiveBuckets,
    longestGap,
    maximumGap: maximumGapBuckets,
    gapRuns,
    maximumGapRuns,
    failingReasons,
  }
}

export function findRichestReadyRange(
  ranges: readonly AnalyticsReadinessInput[],
): number | null {
  return (
    ranges
      .map(evaluateAnalyticsReadiness)
      .filter(({ ready }) => ready)
      .sort((left, right) => right.requestedDays - left.requestedDays)[0]
      ?.requestedDays ?? null
  )
}

function coverage(requestedDays: number): number {
  return Math.min(
    0.8,
    Math.max(0.55, 0.76 - 0.06 * Math.log2(requestedDays / 7)),
  )
}

function measureGaps(counts: readonly number[]): {
  longestGap: number
  gapRuns: number
} {
  let longestGap = 0
  let gapRuns = 0
  let currentGap = 0

  for (const count of counts) {
    if (count === 0) {
      currentGap += 1
      continue
    }
    if (currentGap > 0) {
      gapRuns += 1
      longestGap = Math.max(longestGap, currentGap)
      currentGap = 0
    }
  }

  if (currentGap > 0) {
    gapRuns += 1
    longestGap = Math.max(longestGap, currentGap)
  }

  return { longestGap, gapRuns }
}
