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
