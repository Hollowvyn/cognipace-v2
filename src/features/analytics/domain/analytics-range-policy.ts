import type {
  AnalyticsBucketGrain,
  AnalyticsRange,
  AnalyticsTimeFrame,
  SelectedAnalyticsTimeFrame,
} from './analytics-time'
import { getAnalyticsDateKey } from './analytics-time'

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

export interface AnalyticsLongRangePolicy {
  bucketGrain: AnalyticsBucketGrain | null
  calendarAnchor: 'monday' | null
}

export interface AnalyticsLongRangePolicyInput {
  requestedRange: AnalyticsRange
  allTimeStart: Date | null
  asOf: Date
  timeZone: string
}

const policies: Record<14 | 30 | 90, AnalyticsRangePolicy> = {
  14: { bucketDays: 1, maximumGapBuckets: 2 },
  30: { bucketDays: 3, maximumGapBuckets: 2 },
  90: { bucketDays: 7, maximumGapBuckets: 2 },
}

const maxLongRangeBuckets = 48
const mondayAnchorEpochDay = Math.floor(Date.UTC(1970, 0, 5) / 86_400_000)
const longRangeGrains: readonly AnalyticsBucketGrain[] = [
  'week',
  'two-weeks',
  'month',
  'two-months',
  'quarter',
  'half-year',
  'year',
]

export function getAnalyticsRangePolicy(
  requestedDays: number,
): AnalyticsRangePolicy {
  const policy = policies[requestedDays as 14 | 30 | 90]
  if (!policy) {
    throw new RangeError('Analytics range must be one of 14, 30, or 90 days.')
  }

  return policy
}

export function selectAnalyticsLongRangePolicy(
  input: AnalyticsLongRangePolicyInput,
): AnalyticsLongRangePolicy {
  if (input.requestedRange === 90 || input.requestedRange === 120) {
    return { bucketGrain: 'week', calendarAnchor: 'monday' }
  }

  if (input.allTimeStart === null) {
    return { bucketGrain: null, calendarAnchor: null }
  }

  const startKey = getAnalyticsDateKey(input.allTimeStart, input.timeZone)
  const endKey = getAnalyticsDateKey(input.asOf, input.timeZone)
  const bucketGrain =
    longRangeGrains.find(
      (grain) =>
        countCalendarBuckets(startKey, endKey, grain) <= maxLongRangeBuckets,
    ) ?? null

  if (bucketGrain === null) {
    return { bucketGrain: null, calendarAnchor: null }
  }

  return {
    bucketGrain,
    calendarAnchor:
      bucketGrain === 'week' || bucketGrain === 'two-weeks' ? 'monday' : null,
  }
}

function countCalendarBuckets(
  startKey: string,
  endKey: string,
  grain: AnalyticsBucketGrain,
): number {
  return (
    getCalendarBucketIndex(endKey, grain) -
    getCalendarBucketIndex(startKey, grain) +
    1
  )
}

function getCalendarBucketIndex(
  dateKey: string,
  grain: AnalyticsBucketGrain,
): number {
  const [year, month] = dateKey.split('-').map(Number) as [number, number]
  const monthIndex = year * 12 + month - 1

  switch (grain) {
    case 'week':
      return getMondayWeekIndex(dateKey)
    case 'two-weeks':
      return Math.floor((getEpochDay(dateKey) - mondayAnchorEpochDay) / 14)
    case 'month':
      return monthIndex
    case 'two-months':
      return Math.floor(monthIndex / 2)
    case 'quarter':
      return Math.floor(monthIndex / 3)
    case 'half-year':
      return Math.floor(monthIndex / 6)
    case 'year':
      return year
  }
}

function getMondayWeekIndex(dateKey: string): number {
  return Math.floor((getEpochDay(dateKey) + 3) / 7)
}

function getEpochDay(dateKey: string): number {
  const [year, month, day] = dateKey
    .split('-')
    .map(Number) as [number, number, number]

  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

export function buildAnalyticsBucketsFromTimeFrame(
  timeFrame: AnalyticsTimeFrame | SelectedAnalyticsTimeFrame,
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
