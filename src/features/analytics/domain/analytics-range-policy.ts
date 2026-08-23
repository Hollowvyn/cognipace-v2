import type { AnalyticsTimeFrame } from './analytics-time'

export interface AnalyticsBucket {
  key: string
  start: Date
  end: Date
  label: string
  startKey?: string
  endKey?: string
}

export interface AnalyticsRangePolicy {
  bucketDays: number
  maximumGapBuckets: number
}

const policies: Record<14 | 30 | 90, AnalyticsRangePolicy> = {
  14: { bucketDays: 1, maximumGapBuckets: 2 },
  30: { bucketDays: 3, maximumGapBuckets: 2 },
  90: { bucketDays: 7, maximumGapBuckets: 2 },
}

export function getAnalyticsRangePolicy(
  requestedDays: number,
): AnalyticsRangePolicy {
  const policy = policies[requestedDays as 14 | 30 | 90]
  if (!policy) {
    throw new RangeError('Analytics range must be one of 14, 30, or 90 days.')
  }

  return policy
}

export function buildAnalyticsBucketsFromTimeFrame(
  timeFrame: AnalyticsTimeFrame,
): AnalyticsBucket[] {
  const asOf = new Date(timeFrame.asOf)

  return timeFrame.buckets.map((bucket) => {
    const start = new Date(bucket.start)
    const endExclusive = new Date(bucket.end)
    const end = new Date(Math.min(endExclusive.getTime() - 1, asOf.getTime()))

    return {
      key: bucket.key,
      start,
      end,
      label:
        bucket.startKey === bucket.endKey
          ? bucket.startKey
          : `${bucket.startKey} – ${bucket.endKey}`,
      startKey: bucket.startKey,
      endKey: bucket.endKey,
    }
  })
}
