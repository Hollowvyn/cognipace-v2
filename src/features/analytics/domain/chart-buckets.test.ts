import { describe, expect, it } from 'vitest'

import {
  classifyLineContinuity,
  lastBucketValue,
  medianBucketValues,
  recomputeBucketRatio,
  sumBucketValues,
} from './chart-buckets'

describe('chart buckets', () => {
  it('recomputes ratios from totals instead of averaging percentages', () => {
    expect(
      recomputeBucketRatio([
        { numerator: 1, denominator: 1 },
        { numerator: 0, denominator: 9 },
      ]),
    ).toBe(0.1)
  })

  it('aggregates sums, medians, and last values without mutating samples', () => {
    const values = [7, 1, 4]

    expect(sumBucketValues(values)).toBe(12)
    expect(medianBucketValues(values)).toBe(4)
    expect(lastBucketValue(values)).toBe(4)
    expect(values).toEqual([7, 1, 4])
  })

  it('classifies solid adjacency', () => {
    expect(classifyLineContinuity([0.8, 0.84], 2)).toEqual([
      { kind: 'solid', fromIndex: 0, toIndex: 1 },
    ])
  })

  it('classifies a permitted two-bucket hole as a bridge', () => {
    expect(classifyLineContinuity([0.8, null, null, 0.84], 2)).toEqual([
      { kind: 'bridge', fromIndex: 0, toIndex: 3 },
    ])
  })

  it('classifies a gap longer than the range policy permits as unbridgeable', () => {
    expect(classifyLineContinuity([0.8, null, null, null, 0.84], 2)).toEqual([
      { kind: 'unbridgeable', fromIndex: 0, toIndex: 4 },
    ])
  })

  it('ignores leading and trailing nulls without synthesizing points or mutating values', () => {
    const values = [null, 0.8, 0.84, null]

    expect(classifyLineContinuity(values, 2)).toEqual([
      { kind: 'solid', fromIndex: 1, toIndex: 2 },
    ])
    expect(values).toEqual([null, 0.8, 0.84, null])
  })

  it('rejects an invalid maximum gap', () => {
    expect(() => classifyLineContinuity([0.8, 0.84], -1)).toThrow(RangeError)
    expect(() => classifyLineContinuity([0.8, 0.84], 1.5)).toThrow(RangeError)
  })
})
