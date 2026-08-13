import { describe, expect, it } from 'vitest'

import {
  evaluateAnalyticsReadiness,
  findRichestReadyRange,
  type AnalyticsReadinessInput,
} from './analytics-readiness'

const keys = (count: number) =>
  Array.from({ length: count }, (_, index) => `b${index + 1}`)

describe('analytics readiness', () => {
  it('trims leading empty buckets and reports explainable measurements', () => {
    const readiness = evaluateAnalyticsReadiness({
      requestedDays: 30,
      counts: [0, 0, 4, 2, 0, 3, 0, 0, 5, 1],
      keys: keys(10),
    })

    expect(readiness).toMatchObject({
      requestedDays: 30,
      bucketDays: 3,
      requestedBuckets: 10,
      effectiveBuckets: 8,
      effectiveStart: 'b3',
      assessments: 15,
      activeBuckets: 5,
      longestGap: 2,
      gapRuns: 2,
      maximumGap: 2,
      maximumGapRuns: 2,
    })
    expect(readiness.failingReasons).toEqual([
      'insufficient-assessments',
      'insufficient-active-buckets',
    ])
    expect(readiness.ready).toBe(false)
  })

  it('reports too many gaps for fragmented 14-day evidence', () => {
    const readiness = evaluateAnalyticsReadiness({
      requestedDays: 14,
      counts: [3, 0, 0, 3, 0, 0, 3, 0, 0, 3, 0, 0, 3, 3],
      keys: keys(14),
    })

    expect(readiness.ready).toBe(false)
    expect(readiness.failingReasons).toEqual([
      'insufficient-active-buckets',
      'too-many-gaps',
    ])
  })

  it('accepts a 14-day range with two consecutive empty buckets', () => {
    const readiness = evaluateAnalyticsReadiness({
      requestedDays: 14,
      counts: [2, 2, 2, 2, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2],
      keys: keys(14),
    })

    expect(readiness).toMatchObject({
      ready: true,
      effectiveBuckets: 14,
      longestGap: 2,
      gapRuns: 1,
    })
    expect(readiness.failingReasons).toEqual([])
  })

  it('finds the largest passing range regardless of input order', () => {
    const input: AnalyticsReadinessInput[] = [
      { requestedDays: 90, counts: Array(13).fill(0), keys: keys(13) },
      { requestedDays: 14, counts: Array(14).fill(2), keys: keys(14) },
      { requestedDays: 30, counts: Array(10).fill(3), keys: keys(10) },
    ]
    const originalOrder = input.map(({ requestedDays }) => requestedDays)

    expect(findRichestReadyRange(input)).toBe(30)
    expect(input.map(({ requestedDays }) => requestedDays)).toEqual(
      originalOrder,
    )
  })

  it('returns null when no configured range passes', () => {
    expect(
      findRichestReadyRange([
        { requestedDays: 14, counts: Array(14).fill(0), keys: keys(14) },
        { requestedDays: 30, counts: Array(10).fill(0), keys: keys(10) },
      ]),
    ).toBeNull()
  })

  it('reports no evidence without inventing an effective start', () => {
    const readiness = evaluateAnalyticsReadiness({
      requestedDays: 14,
      counts: Array(14).fill(0),
      keys: keys(14),
    })

    expect(readiness.effectiveStart).toBeNull()
    expect(readiness.effectiveBuckets).toBe(0)
    expect(readiness.failingReasons).toEqual([
      'no-evidence',
      'insufficient-span',
      'insufficient-assessments',
    ])
  })

  it('rejects mismatched keys and counts', () => {
    expect(() =>
      evaluateAnalyticsReadiness({
        requestedDays: 14,
        counts: [1],
        keys: ['b1', 'b2'],
      }),
    ).toThrow(RangeError)
  })

  it('rejects negative and non-integer counts', () => {
    for (const count of [-1, 1.5]) {
      expect(() =>
        evaluateAnalyticsReadiness({
          requestedDays: 14,
          counts: [count],
          keys: ['b1'],
        }),
      ).toThrow(RangeError)
    }
  })
})
