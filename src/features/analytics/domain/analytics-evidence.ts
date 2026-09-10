import type { AnalyticsTimeBucket } from './analytics-time'
import {
  addAnalyticsCalendarDays,
  getAnalyticsDateKey,
  resolveAnalyticsTimeZone,
} from './analytics-time'

export const analyticsEvidenceStateValues = [
  'measured',
  'in-progress',
  'reconstructed',
  'not-measured',
  'insufficient-evidence',
] as const

export type AnalyticsEvidenceState =
  (typeof analyticsEvidenceStateValues)[number]

export interface AnalyticsEvidenceInput {
  hasMeasurement: boolean
  isPartial: boolean
  isReconstructed: boolean
  trendSupported: boolean
}

/**
 * Returns only presentation states that are truthful for one metric row.
 * A missing measurement is always unknown, never a zero or a trend failure.
 */
export function buildEvidenceStates(
  input: AnalyticsEvidenceInput,
): AnalyticsEvidenceState[] {
  if (!input.hasMeasurement) return ['not-measured']

  const states: AnalyticsEvidenceState[] = ['measured']

  if (input.isPartial) states.push('in-progress')
  if (input.isReconstructed) states.push('reconstructed')
  if (!input.trendSupported) states.push('insufficient-evidence')

  return states
}

export type AnalyticsEvidenceDisplayMode =
  'table' | 'single' | 'marks' | 'trend'

/** One raw metric value associated with a selected presentation bucket. */
export interface AnalyticsEvidenceObservation {
  observedAt: Date
  value: number | null
}

/**
 * Selected buckets remain intact even when their metric observations are empty
 * or unknown. The classifier counts only eligible observations within them.
 */
export interface AnalyticsEvidenceBucket extends Pick<
  AnalyticsTimeBucket,
  'key'
> {
  observations: readonly AnalyticsEvidenceObservation[]
}

export interface AnalyticsEvidenceClassificationInput {
  asOf: Date
  periodStart: Date | null
  timeZone: string
  buckets: readonly AnalyticsEvidenceBucket[]
}

/**
 * Presentation support for a metric: H is local calendar history days, M is
 * measured selected buckets, and S is eligible metric observations.
 */
export interface AnalyticsEvidenceClassification {
  historyDays: number
  measuredBuckets: number
  observations: number
  tableOnly: boolean
  displayMode: AnalyticsEvidenceDisplayMode
  supportsLine: boolean
  supportsDirection: boolean
}

/**
 * Classifies the truthful chart presentation for one metric without filling
 * unknown bucket values or mutating the selected bucket sequence.
 */
export function classifyAnalyticsEvidence(
  input: AnalyticsEvidenceClassificationInput,
): AnalyticsEvidenceClassification {
  if (!isValidDate(input.asOf) || !isValidDate(input.periodStart)) {
    return createTableOnlyClassification()
  }

  const periodStart = input.periodStart
  const { timeZone } = resolveAnalyticsTimeZone(input.timeZone)
  const eligibleBuckets = input.buckets.map((bucket) =>
    bucket.observations.filter((observation) =>
      isEligibleObservation(observation, periodStart, input.asOf),
    ),
  )
  const observations = eligibleBuckets.flat()
  const earliestObservation = observations.reduce<Date | null>(
    (earliest, observation) =>
      earliest === null || observation.observedAt < earliest
        ? observation.observedAt
        : earliest,
    null,
  )

  const historyDays =
    earliestObservation === null
      ? 0
      : countLocalCalendarDaysInclusive(
          periodStart,
          earliestObservation,
          input.asOf,
          timeZone,
        )
  const measuredBuckets = eligibleBuckets.filter(
    (bucket) => bucket.length > 0,
  ).length
  const displayMode = getDisplayMode({
    historyDays,
    measuredBuckets,
    observations: observations.length,
  })

  return {
    historyDays,
    measuredBuckets,
    observations: observations.length,
    tableOnly: displayMode === 'table',
    displayMode,
    supportsLine: displayMode === 'trend',
    supportsDirection: displayMode === 'trend',
  }
}

function isEligibleObservation(
  observation: AnalyticsEvidenceObservation,
  periodStart: Date,
  asOf: Date,
): boolean {
  return (
    Number.isFinite(observation.value) &&
    isValidDate(observation.observedAt) &&
    observation.observedAt >= periodStart &&
    observation.observedAt <= asOf
  )
}

function countLocalCalendarDaysInclusive(
  periodStart: Date,
  firstObservation: Date,
  asOf: Date,
  timeZone: string,
): number {
  const periodStartKey = getAnalyticsDateKey(periodStart, timeZone)
  const firstObservationKey = getAnalyticsDateKey(firstObservation, timeZone)
  const asOfKey = getAnalyticsDateKey(asOf, timeZone)
  const effectiveStartKey =
    firstObservationKey > periodStartKey ? firstObservationKey : periodStartKey

  if (effectiveStartKey > asOfKey) return 0

  let days = 1
  let dateKey = effectiveStartKey
  while (dateKey < asOfKey) {
    dateKey = addAnalyticsCalendarDays(dateKey, 1)
    days += 1
  }

  return days
}

function getDisplayMode(input: {
  historyDays: number
  measuredBuckets: number
  observations: number
}): AnalyticsEvidenceDisplayMode {
  if (input.historyDays < 30) return 'table'
  if (input.measuredBuckets === 1) return 'single'
  if (input.measuredBuckets < 6 || input.observations < 30) return 'marks'

  return 'trend'
}

function createTableOnlyClassification(): AnalyticsEvidenceClassification {
  return {
    historyDays: 0,
    measuredBuckets: 0,
    observations: 0,
    tableOnly: true,
    displayMode: 'table',
    supportsLine: false,
    supportsDirection: false,
  }
}

function isValidDate(date: Date | null): date is Date {
  return date instanceof Date && Number.isFinite(date.getTime())
}
