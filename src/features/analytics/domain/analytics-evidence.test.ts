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

  it.each([
    {
      requestedDays: 14 as const,
      belowMinimum: [1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1],
      atMinimum: [1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    },
    {
      requestedDays: 30 as const,
      belowMinimum: [2, 2, 2, 2, 2, 2, 2, 2, 2, 5],
      atMinimum: [2, 2, 2, 2, 2, 2, 2, 2, 2, 6],
    },
    {
      requestedDays: 90 as const,
      belowMinimum: [32, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      atMinimum: [33, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    },
  ])(
    'uses the locked $requestedDays-day minimum sample threshold',
    ({ requestedDays, belowMinimum, atMinimum }) => {
      expect(
        calculateAnalyticsEvidence({
          requestedDays,
          evidenceCounts: belowMinimum,
          bucketKeys: keys(belowMinimum.length),
        }).trendSupported,
      ).toBe(false)

      expect(
        calculateAnalyticsEvidence({
          requestedDays,
          evidenceCounts: atMinimum,
          bucketKeys: keys(atMinimum.length),
        }).trendSupported,
      ).toBe(true)
    },
  )

  it('requires the clamped 90-day active-bucket coverage threshold', () => {
    const belowCoverage = [10, 0, 0, 10, 0, 0, 10, 0, 0, 10, 1, 2, 2]
    const atCoverage = [10, 1, 0, 10, 0, 0, 10, 0, 0, 10, 1, 2, 1]

    expect(
      calculateAnalyticsEvidence({
        requestedDays: 90,
        evidenceCounts: belowCoverage,
        bucketKeys: keys(13),
      }).trendSupported,
    ).toBe(false)
    expect(
      calculateAnalyticsEvidence({
        requestedDays: 90,
        evidenceCounts: atCoverage,
        bucketKeys: keys(13),
      }).trendSupported,
    ).toBe(true)
  })

  it('requires the effective bucket span before supporting a trend', () => {
    const belowMinimumSpan = [0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2]
    const atMinimumSpan = [0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2]

    expect(
      calculateAnalyticsEvidence({
        requestedDays: 14,
        evidenceCounts: belowMinimumSpan,
        bucketKeys: keys(14),
      }).trendSupported,
    ).toBe(false)
    expect(
      calculateAnalyticsEvidence({
        requestedDays: 14,
        evidenceCounts: atMinimumSpan,
        bucketKeys: keys(14),
      }).trendSupported,
    ).toBe(true)
  })

  it('enforces the longest-gap and gap-run thresholds independently', () => {
    const longestGapTooLong = [2, 2, 2, 2, 2, 0, 0, 0, 2, 2, 2, 2, 2, 2]
    const atLongestGap = [2, 2, 2, 2, 2, 0, 0, 2, 2, 2, 2, 2, 2, 2]
    const tooManyGapRuns = [2, 0, 2, 0, 2, 0, 2, 0, 2, 2, 2, 2, 2, 2]
    const atGapRuns = [2, 0, 2, 0, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2]

    expect(
      calculateAnalyticsEvidence({
        requestedDays: 14,
        evidenceCounts: longestGapTooLong,
        bucketKeys: keys(14),
      }).trendSupported,
    ).toBe(false)
    expect(
      calculateAnalyticsEvidence({
        requestedDays: 14,
        evidenceCounts: atLongestGap,
        bucketKeys: keys(14),
      }).trendSupported,
    ).toBe(true)
    expect(
      calculateAnalyticsEvidence({
        requestedDays: 14,
        evidenceCounts: tooManyGapRuns,
        bucketKeys: keys(14),
      }).trendSupported,
    ).toBe(false)
    expect(
      calculateAnalyticsEvidence({
        requestedDays: 14,
        evidenceCounts: atGapRuns,
        bucketKeys: keys(14),
      }).trendSupported,
    ).toBe(true)
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
