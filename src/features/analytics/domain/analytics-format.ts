const NOT_MEASURED = 'Not measured'
const dateKeyPattern = /^(\d{4})-(\d{2})-(\d{2})$/

export type AnalyticsPercentagePrecision = 'compact' | 'one-decimal'

export interface AnalyticsFormatOptions {
  precision?: AnalyticsPercentagePrecision
}

export function formatAnalyticsPercent(
  value: number | null,
  options: AnalyticsFormatOptions = {},
): string {
  if (value === null || !Number.isFinite(value)) return NOT_MEASURED
  return `${formatPercentageValue(value, options.precision)}%`
}

export function formatAnalyticsPercentagePoints(
  value: number | null,
  options: AnalyticsFormatOptions = {},
): string {
  if (value === null || !Number.isFinite(value)) return NOT_MEASURED

  const points = formatPercentageValue(Math.abs(value), options.precision)
  return `${value >= 0 ? '+' : '−'}${points} pp`
}

export function selectAnalyticsPercentagePrecision(
  values: readonly (number | null)[],
): AnalyticsPercentagePrecision {
  const compactValues = new Map<number, number>()

  for (const value of values) {
    if (value === null || !Number.isFinite(value)) continue

    const compactValue = Math.round(value * 100)
    const previousExactValue = compactValues.get(compactValue)
    if (previousExactValue !== undefined && previousExactValue !== value) {
      return 'one-decimal'
    }
    compactValues.set(compactValue, value)
  }

  return 'compact'
}

export function formatAnalyticsDays(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return NOT_MEASURED
  if (value > 0 && value < 0.05) return '<0.1d'
  if (Math.abs(value) < 10) return `${value.toFixed(1)}d`
  return `${Math.round(value)}d`
}

export function formatAnalyticsCount(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatAnalyticsDateKey(key: string): string {
  const { year, month, day } = parseDateKey(key)
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${String(year).slice(-2)}`
}

export function formatAnalyticsBucket(
  startKey: string,
  endKey: string,
): string {
  const start = formatAnalyticsDateKey(startKey)
  const end = formatAnalyticsDateKey(endKey)
  return startKey === endKey ? start : `${start}–${end}`
}

function parseDateKey(key: string): {
  year: number
  month: number
  day: number
} {
  const match = dateKeyPattern.exec(key)
  if (!match) throw new RangeError('Analytics date keys must use YYYY-MM-DD.')

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError('Analytics date key must be a valid calendar date.')
  }

  return { year, month, day }
}

function formatPercentageValue(
  value: number,
  precision: AnalyticsPercentagePrecision | undefined,
): string {
  const percentage = value * 100
  return precision === 'one-decimal'
    ? percentage.toFixed(1)
    : String(Math.round(percentage))
}
