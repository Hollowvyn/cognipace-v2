export type AnalyticsRange = 90 | 120 | 'all'

export type AnalyticsBucketGrain =
  | 'week'
  | 'two-weeks'
  | 'month'
  | 'two-months'
  | 'quarter'
  | 'half-year'
  | 'year'

export interface AnalyticsTimeBucket {
  key: string
  start: string
  end: string
  startKey: string
  endKey: string
  isPartial: boolean
}

export interface AnalyticsTimeFrame {
  asOf: string
  timeZone: string
  timeZoneFallback: boolean
  requestedRange: AnalyticsRange
  periodStart: string | null
  periodEnd: string
  bucketGrain: AnalyticsBucketGrain | null
  allTimeUnsupported: boolean
  buckets: AnalyticsTimeBucket[]
}

interface TimeZoneResolution {
  timeZone: string
  fallback: boolean
}

const analyticsRanges: readonly AnalyticsRange[] = [90, 120, 'all']

export function resolveAnalyticsTimeZone(
  requested: string,
): TimeZoneResolution {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: requested }).format()
    return { timeZone: requested, fallback: false }
  } catch {
    return { timeZone: 'UTC', fallback: true }
  }
}

export function buildAnalyticsTimeFrame(input: {
  asOf: Date
  requestedRange: AnalyticsRange
  allTimeStart: Date | null
  timeZone: string
  bucketGrain?: AnalyticsBucketGrain | null
}): AnalyticsTimeFrame {
  assertValidAsOf(input.asOf)
  assertSelectedRange(input.requestedRange)

  const resolvedTimeZone = resolveAnalyticsTimeZone(input.timeZone)
  const todayKey = getAnalyticsDateKey(input.asOf, resolvedTimeZone.timeZone)
  const periodEndKey = addAnalyticsCalendarDays(todayKey, 1)
  const periodEnd = getAnalyticsLocalDayStart(
    periodEndKey,
    resolvedTimeZone.timeZone,
  )
  const bucketGrain = input.bucketGrain ?? 'week'

  if (
    input.requestedRange === 'all' &&
    input.allTimeStart !== null &&
    input.bucketGrain === null
  ) {
    return {
      asOf: input.asOf.toISOString(),
      timeZone: resolvedTimeZone.timeZone,
      timeZoneFallback: resolvedTimeZone.fallback,
      requestedRange: input.requestedRange,
      periodStart: null,
      periodEnd,
      bucketGrain: null,
      allTimeUnsupported: true,
      buckets: [],
    }
  }

  if (input.requestedRange === 'all' && input.allTimeStart === null) {
    return {
      asOf: input.asOf.toISOString(),
      timeZone: resolvedTimeZone.timeZone,
      timeZoneFallback: resolvedTimeZone.fallback,
      requestedRange: input.requestedRange,
      periodStart: null,
      periodEnd,
      bucketGrain,
      allTimeUnsupported: false,
      buckets: [],
    }
  }

  const firstKey =
    input.requestedRange === 'all'
      ? getAnalyticsDateKey(
          assertValidAllTimeStart(input.allTimeStart),
          resolvedTimeZone.timeZone,
        )
      : addAnalyticsCalendarDays(todayKey, -(input.requestedRange - 1))

  return {
    asOf: input.asOf.toISOString(),
    timeZone: resolvedTimeZone.timeZone,
    timeZoneFallback: resolvedTimeZone.fallback,
    requestedRange: input.requestedRange,
    periodStart: getAnalyticsLocalDayStart(firstKey, resolvedTimeZone.timeZone),
    periodEnd,
    bucketGrain,
    allTimeUnsupported: false,
    buckets: buildRangeBuckets({
      firstKey,
      todayKey,
      timeZone: resolvedTimeZone.timeZone,
      bucketGrain,
    }),
  }
}

export function buildForecastBounds(input: { asOf: Date; timeZone: string }): {
  start: string
  end: string
  todayKey: string
} {
  assertValidAsOf(input.asOf)

  const { timeZone } = resolveAnalyticsTimeZone(input.timeZone)
  const todayKey = getAnalyticsDateKey(input.asOf, timeZone)

  return {
    todayKey,
    start: getAnalyticsLocalDayStart(todayKey, timeZone),
    end: getAnalyticsLocalDayStart(
      addAnalyticsCalendarDays(todayKey, 14),
      timeZone,
    ),
  }
}

function buildMondayWeekBuckets(input: {
  firstKey: string
  todayKey: string
  timeZone: string
}): AnalyticsTimeBucket[] {
  const buckets: AnalyticsTimeBucket[] = []
  let startKey = input.firstKey

  while (startKey <= input.todayKey) {
    const daysUntilSunday = 6 - getMondayWeekday(startKey)
    const endKey = minDateKey(
      addAnalyticsCalendarDays(startKey, daysUntilSunday),
      input.todayKey,
    )
    buckets.push(createBucket(startKey, endKey, input.todayKey, input.timeZone))
    startKey = addAnalyticsCalendarDays(endKey, 1)
  }

  return buckets
}

function buildRangeBuckets(input: {
  firstKey: string
  todayKey: string
  timeZone: string
  bucketGrain: AnalyticsBucketGrain
}): AnalyticsTimeBucket[] {
  if (input.bucketGrain === 'week') return buildMondayWeekBuckets(input)

  const buckets: AnalyticsTimeBucket[] = []
  let startKey = input.firstKey

  while (startKey <= input.todayKey) {
    const endKey = minDateKey(
      getSelectedBucketEndKey(startKey, input.bucketGrain),
      input.todayKey,
    )
    buckets.push(createBucket(startKey, endKey, input.todayKey, input.timeZone))
    startKey = addAnalyticsCalendarDays(endKey, 1)
  }

  return buckets
}

function getSelectedBucketEndKey(
  startKey: string,
  grain: Exclude<AnalyticsBucketGrain, 'week'>,
): string {
  if (grain === 'two-weeks') {
    const epochDay = getEpochDay(startKey)
    const mondayEpochDay = Math.floor(Date.UTC(1970, 0, 5) / 86_400_000)
    const bucketStartEpochDay =
      Math.floor((epochDay - mondayEpochDay) / 14) * 14 + mondayEpochDay
    return addAnalyticsCalendarDays(
      toDateKeyFromEpochDay(bucketStartEpochDay),
      13,
    )
  }

  const [year, month] = parseDateKey(startKey)
  const monthWidth =
    grain === 'month'
      ? 1
      : grain === 'two-months'
        ? 2
        : grain === 'quarter'
          ? 3
          : grain === 'half-year'
            ? 6
            : 12
  const monthIndex = year * 12 + month - 1
  const bucketMonthIndex = Math.floor(monthIndex / monthWidth) * monthWidth
  const nextBucketMonthIndex = bucketMonthIndex + monthWidth
  const nextYear = Math.floor(nextBucketMonthIndex / 12)
  const nextMonth = (nextBucketMonthIndex % 12) + 1

  return addAnalyticsCalendarDays(
    `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01`,
    -1,
  )
}

function createBucket(
  startKey: string,
  endKey: string,
  todayKey: string,
  timeZone: string,
): AnalyticsTimeBucket {
  return {
    key: startKey,
    start: getAnalyticsLocalDayStart(startKey, timeZone),
    end: getAnalyticsLocalDayStart(
      addAnalyticsCalendarDays(endKey, 1),
      timeZone,
    ),
    startKey,
    endKey,
    isPartial: endKey === todayKey,
  }
}

export function getAnalyticsDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => {
      if (
        part.type === 'year' ||
        part.type === 'month' ||
        part.type === 'day'
      ) {
        result[part.type] = part.value
      }
      return result
    }, {})

  return `${parts.year!}-${parts.month!}-${parts.day!}`
}

export function getAnalyticsLocalDayStart(
  dateKey: string,
  timeZone: string,
): string {
  const [year, month, day] = parseDateKey(dateKey)
  const wallTime = Date.UTC(year, month - 1, day)
  let instant = wallTime

  for (let attempts = 0; attempts < 3; attempts += 1) {
    const offset = getTimeZoneOffsetMilliseconds(new Date(instant), timeZone)
    const candidate = wallTime - offset

    if (candidate === instant) return new Date(candidate).toISOString()
    instant = candidate
  }

  return new Date(instant).toISOString()
}

function getTimeZoneOffsetMilliseconds(date: Date, timeZone: string): number {
  const wholeSecondDate = new Date(Math.floor(date.getTime() / 1000) * 1000)
  const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(wholeSecondDate)
    .reduce<Record<string, string>>((result, part) => {
      if (
        part.type === 'year' ||
        part.type === 'month' ||
        part.type === 'day' ||
        part.type === 'hour' ||
        part.type === 'minute' ||
        part.type === 'second'
      ) {
        result[part.type] = part.value
      }
      return result
    }, {})

  return (
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    ) - wholeSecondDate.getTime()
  )
}

export function addAnalyticsCalendarDays(
  dateKey: string,
  days: number,
): string {
  const [year, month, day] = parseDateKey(dateKey)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)

  return toDateKey(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  )
}

export function shiftAnalyticsCalendarDays(
  date: Date,
  days: number,
  timeZone: string,
): Date {
  const localParts = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .reduce<Record<string, number>>((result, part) => {
      if (
        part.type === 'year' ||
        part.type === 'month' ||
        part.type === 'day' ||
        part.type === 'hour' ||
        part.type === 'minute' ||
        part.type === 'second'
      ) {
        result[part.type] = Number(part.value)
      }
      return result
    }, {})
  const targetKey = addAnalyticsCalendarDays(
    getAnalyticsDateKey(date, timeZone),
    days,
  )
  const [year, month, day] = parseDateKey(targetKey)
  const wallTime = Date.UTC(
    year,
    month - 1,
    day,
    localParts.hour,
    localParts.minute,
    localParts.second,
    date.getUTCMilliseconds(),
  )
  let instant = wallTime

  for (let attempts = 0; attempts < 3; attempts += 1) {
    const offset = getTimeZoneOffsetMilliseconds(new Date(instant), timeZone)
    const candidate = wallTime - offset

    if (candidate === instant) return new Date(candidate)
    instant = candidate
  }

  return new Date(instant)
}

function getMondayWeekday(dateKey: string): number {
  const [year, month, day] = parseDateKey(dateKey)
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7
}

function minDateKey(left: string, right: string): string {
  return left <= right ? left : right
}

function parseDateKey(dateKey: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) throw new RangeError('Analytics date keys must use YYYY-MM-DD.')

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const roundTrip = toDateKey(year, month, day)

  if (roundTrip !== dateKey) {
    throw new RangeError('Analytics date keys must be valid calendar dates.')
  }

  return [year, month, day]
}

function getEpochDay(dateKey: string): number {
  const [year, month, day] = parseDateKey(dateKey)
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

function toDateKeyFromEpochDay(epochDay: number): string {
  const date = new Date(epochDay * 86_400_000)
  return toDateKey(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  )
}

function toDateKey(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day))
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function assertSelectedRange(
  requestedRange: AnalyticsRange,
): asserts requestedRange is AnalyticsRange {
  if (!analyticsRanges.includes(requestedRange)) {
    throw new RangeError('Analytics ranges must be 90, 120, or all.')
  }
}

function assertValidAllTimeStart(allTimeStart: Date | null): Date {
  if (allTimeStart === null || !Number.isFinite(allTimeStart.getTime())) {
    throw new RangeError('Analytics all-time start must be a valid date.')
  }

  return allTimeStart
}

function assertValidAsOf(asOf: Date): void {
  if (!Number.isFinite(asOf.getTime())) {
    throw new RangeError('Analytics as-of must be a valid date.')
  }
}
