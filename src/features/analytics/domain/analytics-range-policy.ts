export interface AnalyticsBucket {
  key: string
  start: Date
  end: Date
  label: string
}

export interface AnalyticsRangePolicy {
  requestedDays: number
  bucketDays: number
  maximumGapBuckets: number
}

const bucketCandidates = [2, 3, 7, 14, 30]

export function getAnalyticsRangePolicy(
  requestedDays: number,
): AnalyticsRangePolicy {
  if (!Number.isInteger(requestedDays) || requestedDays < 1) {
    throw new RangeError('Analytics range must be a positive whole day count.')
  }

  const bucketDays =
    requestedDays <= 14
      ? 1
      : (bucketCandidates
          .map((candidate) => ({
            candidate,
            points: Math.ceil(requestedDays / candidate),
          }))
          .filter(({ points }) => points >= 8 && points <= 14)
          .sort(
            (left, right) =>
              Math.abs(left.points - 11) - Math.abs(right.points - 11) ||
              left.candidate - right.candidate,
          )[0]?.candidate ?? 30)

  return {
    requestedDays,
    bucketDays,
    maximumGapBuckets: requestedDays <= 7 ? 1 : 2,
  }
}

export function buildAnalyticsBuckets({
  requestedDays,
  periodEnd,
}: {
  requestedDays: number
  periodEnd: Date
}): AnalyticsBucket[] {
  const { bucketDays } = getAnalyticsRangePolicy(requestedDays)
  if (!Number.isFinite(periodEnd.getTime())) {
    throw new RangeError('Analytics period end must be a valid date.')
  }

  const normalizedEnd = endOfLocalDay(periodEnd)
  const periodStart = startOfLocalDay(
    addLocalDays(normalizedEnd, -(requestedDays - 1)),
  )

  if (bucketDays === 7) {
    return buildWeeklyBuckets(periodStart, normalizedEnd)
  }

  const buckets: AnalyticsBucket[] = []
  let bucketStart = periodStart

  while (bucketStart <= normalizedEnd) {
    const bucketEnd = minDate(
      endOfLocalDay(addLocalDays(bucketStart, bucketDays - 1)),
      normalizedEnd,
    )
    buckets.push(createBucket(bucketStart, bucketEnd))
    bucketStart = startOfLocalDay(addLocalDays(bucketEnd, 1))
  }

  return buckets
}

function buildWeeklyBuckets(periodStart: Date, periodEnd: Date) {
  const firstMonday = startOfLocalDay(
    addLocalDays(periodStart, -((periodStart.getDay() + 6) % 7)),
  )
  const buckets: AnalyticsBucket[] = []
  let bucketStart = firstMonday

  while (bucketStart <= periodEnd) {
    const bucketEnd = endOfLocalDay(addLocalDays(bucketStart, 6))
    const clippedStart = maxDate(bucketStart, periodStart)
    const clippedEnd = minDate(bucketEnd, periodEnd)

    if (clippedStart <= clippedEnd) {
      buckets.push(createBucket(clippedStart, clippedEnd))
    }

    bucketStart = startOfLocalDay(addLocalDays(bucketStart, 7))
  }

  return buckets
}

function createBucket(start: Date, end: Date): AnalyticsBucket {
  const key = toLocalDateKey(start)
  const endKey = toLocalDateKey(end)

  return {
    key,
    start,
    end,
    label: key === endKey ? key : `${key} – ${endKey}`,
  }
}

function startOfLocalDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function endOfLocalDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

function addLocalDays(date: Date, days: number): Date {
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

function minDate(left: Date, right: Date): Date {
  return left <= right ? left : right
}

function maxDate(left: Date, right: Date): Date {
  return left >= right ? left : right
}
