export type AnalyticsEvidenceLabel =
  | 'measured'
  | 'in-progress'
  | 'reconstructed'
  | 'not-measured'
  | 'insufficient-evidence'

export interface AnalyticsEvidence {
  labels: AnalyticsEvidenceLabel[]
  sampleSize: number
  activeBuckets: number
  requestedBuckets: number
  effectiveBuckets: number
  longestGap: number
  gapRuns: number
  trendSupported: boolean
}

export function buildEvidenceStatus(input: {
  measured: boolean
  reconstructed: boolean
  partial: boolean
  trendSupported: boolean
}): AnalyticsEvidenceLabel[] {
  const labels: AnalyticsEvidenceLabel[] = [
    input.measured ? 'measured' : 'not-measured',
  ]

  if (input.reconstructed) labels.push('reconstructed')
  if (input.partial) labels.push('in-progress')
  if (!input.trendSupported) labels.push('insufficient-evidence')

  return labels
}

export function calculateAnalyticsEvidence(input: {
  requestedDays: 14 | 30 | 90
  evidenceCounts: readonly number[]
  bucketKeys: readonly string[]
}): AnalyticsEvidence {
  validateEvidenceInput(input)

  const firstEvidence = input.evidenceCounts.findIndex((count) => count > 0)
  const effectiveCounts =
    firstEvidence === -1 ? [] : input.evidenceCounts.slice(firstEvidence)
  const effectiveBuckets = effectiveCounts.length
  const sampleSize = effectiveCounts.reduce((sum, count) => sum + count, 0)
  const activeBuckets = effectiveCounts.filter((count) => count > 0).length
  const { longestGap, gapRuns } = measureGaps(effectiveCounts)

  const trendSupported =
    effectiveBuckets >= Math.ceil(input.bucketKeys.length * 0.6) &&
    sampleSize >= minimumSampleSize(input.requestedDays) &&
    activeBuckets >=
      Math.ceil(activeBucketCoverage(input.requestedDays) * effectiveBuckets) &&
    longestGap <= 2 &&
    gapRuns <= Math.max(1, Math.ceil(effectiveBuckets * 0.2))

  return {
    labels: buildEvidenceStatus({
      measured: sampleSize > 0,
      reconstructed: false,
      partial: false,
      trendSupported,
    }),
    sampleSize,
    activeBuckets,
    requestedBuckets: input.bucketKeys.length,
    effectiveBuckets,
    longestGap,
    gapRuns,
    trendSupported,
  }
}

function validateEvidenceInput(input: {
  requestedDays: 14 | 30 | 90
  evidenceCounts: readonly number[]
  bucketKeys: readonly string[]
}): void {
  if (input.evidenceCounts.length !== input.bucketKeys.length) {
    throw new RangeError('Analytics evidence keys and counts must align.')
  }
  if (input.evidenceCounts.length === 0) {
    throw new RangeError('Analytics evidence requires at least one bucket.')
  }
  if (
    input.evidenceCounts.some(
      (count) => !Number.isSafeInteger(count) || count < 0,
    )
  ) {
    throw new RangeError(
      'Analytics evidence counts must be non-negative integers.',
    )
  }
}

function minimumSampleSize(requestedDays: 14 | 30 | 90): number {
  return Math.ceil(
    Math.max(12, requestedDays * 0.5, Math.min(requestedDays, 30) * 0.8),
  )
}

function activeBucketCoverage(requestedDays: 14 | 30 | 90): number {
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
