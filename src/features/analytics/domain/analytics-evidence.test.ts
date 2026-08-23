import { describe, expect, it } from 'vitest'

import {
  buildEvidenceStates,
  type AnalyticsEvidenceInput,
} from './analytics-evidence'

const baseInput: AnalyticsEvidenceInput = {
  hasMeasurement: true,
  isPartial: true,
  isReconstructed: true,
  trendSupported: false,
}

describe('analytics evidence', () => {
  it('keeps measured, in-progress, reconstructed, and insufficient evidence distinct', () => {
    expect(buildEvidenceStates(baseInput)).toEqual([
      'measured',
      'in-progress',
      'reconstructed',
      'insufficient-evidence',
    ])
  })

  it('uses not-measured instead of a fabricated zero and does not add trend status', () => {
    expect(
      buildEvidenceStates({
        hasMeasurement: false,
        isPartial: false,
        isReconstructed: false,
        trendSupported: false,
      }),
    ).toEqual(['not-measured'])
  })
})
