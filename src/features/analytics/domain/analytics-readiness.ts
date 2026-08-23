import { getAnalyticsRangePolicy } from './analytics-range-policy'
import { calculateAnalyticsEvidence } from './analytics-evidence'

export type ReadinessFailure =
  | 'no-evidence'
  | 'insufficient-span'
  | 'insufficient-assessments'
  | 'insufficient-active-buckets'
  | 'gap-too-long'
  | 'too-many-gaps'

export interface AnalyticsReadinessInput {
  requestedDays: number
  evidenceCounts: readonly number[]
  bucketKeys: readonly string[]
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

export function calculateAnalyticsReadiness({
  requestedDays,
  evidenceCounts,
  bucketKeys,
}: AnalyticsReadinessInput): AnalyticsReadiness {
  const { bucketDays, maximumGapBuckets } =
    getAnalyticsRangePolicy(requestedDays)

  const evidence = calculateAnalyticsEvidence({
    requestedDays: requestedDays as 14 | 30 | 90,
    evidenceCounts,
    bucketKeys,
  })
  const firstEvidence = evidenceCounts.findIndex((count) => count > 0)
  const effectiveStart =
    firstEvidence === -1 ? null : (bucketKeys[firstEvidence] ?? null)

  const minimumAssessments = Math.ceil(
    Math.max(12, requestedDays * 0.5, Math.min(requestedDays, 30) * 0.8),
  )
  const minimumActiveBuckets = Math.ceil(
    coverage(requestedDays) * evidence.effectiveBuckets,
  )
  const minimumEffectiveBuckets = getMinimumEffectiveBuckets(bucketKeys.length)
  const maximumGapRuns = Math.max(1, Math.ceil(evidence.effectiveBuckets * 0.2))

  const failingReasons: ReadinessFailure[] = []
  if (evidence.effectiveBuckets === 0) failingReasons.push('no-evidence')
  if (evidence.effectiveBuckets < minimumEffectiveBuckets) {
    failingReasons.push('insufficient-span')
  }
  if (evidence.sampleSize < minimumAssessments) {
    failingReasons.push('insufficient-assessments')
  }
  if (evidence.activeBuckets < minimumActiveBuckets) {
    failingReasons.push('insufficient-active-buckets')
  }
  if (evidence.longestGap > maximumGapBuckets) {
    failingReasons.push('gap-too-long')
  }
  if (evidence.gapRuns > maximumGapRuns) failingReasons.push('too-many-gaps')

  return {
    ready: failingReasons.length === 0,
    requestedDays,
    bucketDays,
    requestedBuckets: bucketKeys.length,
    effectiveBuckets: evidence.effectiveBuckets,
    effectiveStart,
    assessments: evidence.sampleSize,
    minimumAssessments,
    activeBuckets: evidence.activeBuckets,
    minimumActiveBuckets,
    longestGap: evidence.longestGap,
    maximumGap: maximumGapBuckets,
    gapRuns: evidence.gapRuns,
    maximumGapRuns,
    failingReasons,
  }
}

export function findRichestReadyRange(
  ranges: readonly { range: number; ready: boolean }[],
): number | null {
  return (
    ranges
      .filter(({ ready }) => ready)
      .sort((left, right) => right.range - left.range)[0]?.range ?? null
  )
}

export function getMinimumEffectiveBuckets(requestedBuckets: number): number {
  return Math.ceil(requestedBuckets * 0.6)
}

function coverage(requestedDays: number): number {
  return Math.min(
    0.8,
    Math.max(0.55, 0.76 - 0.06 * Math.log2(requestedDays / 7)),
  )
}
