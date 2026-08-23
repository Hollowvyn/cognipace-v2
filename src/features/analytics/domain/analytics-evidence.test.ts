import { describe, expect, it } from 'vitest'

import {
  buildEvidenceStatus,
  calculateAnalyticsEvidence,
} from './analytics-evidence'

const keys = (count: number) =>
  Array.from(
    { length: count },
    (_, index) => `2026-08-${String(index + 1).padStart(2, '0')}`,
  )

describe('analytics evidence', () => {
  it('distinguishes measured, reconstructed, partial, and unsupported trend', () => {
    expect(
      buildEvidenceStatus({
        measured: true,
        reconstructed: true,
        partial: true,
        trendSupported: false,
      }),
    ).toEqual([
      'measured',
      'reconstructed',
      'in-progress',
      'insufficient-evidence',
    ])
  })

  it('labels an unknown value as not measured', () => {
    expect(
      buildEvidenceStatus({
        measured: false,
        reconstructed: false,
        partial: false,
        trendSupported: false,
      }),
    ).toEqual(['not-measured', 'insufficient-evidence'])
  })

  it('calculates the shared evidence gate after leading empty buckets', () => {
    expect(
      calculateAnalyticsEvidence({
        requestedDays: 30,
        evidenceCounts: [0, 0, 4, 2, 0, 3, 0, 0, 5, 1],
        bucketKeys: keys(10),
      }),
    ).toEqual({
      labels: ['measured', 'insufficient-evidence'],
      sampleSize: 15,
      activeBuckets: 5,
      requestedBuckets: 10,
      effectiveBuckets: 8,
      longestGap: 2,
      gapRuns: 2,
      trendSupported: false,
    })
  })

  it('supports a sufficiently broad 14-day trend with a short gap', () => {
    expect(
      calculateAnalyticsEvidence({
        requestedDays: 14,
        evidenceCounts: [2, 2, 2, 2, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2],
        bucketKeys: keys(14),
      }),
    ).toMatchObject({
      labels: ['measured'],
      effectiveBuckets: 14,
      longestGap: 2,
      gapRuns: 1,
      trendSupported: true,
    })
  })

  it('rejects invalid and misaligned evidence', () => {
    expect(() =>
      calculateAnalyticsEvidence({
        requestedDays: 14,
        evidenceCounts: [1],
        bucketKeys: [],
      }),
    ).toThrow(RangeError)

    expect(() =>
      calculateAnalyticsEvidence({
        requestedDays: 30,
        evidenceCounts: [1.5],
        bucketKeys: keys(1),
      }),
    ).toThrow(RangeError)
  })
})
