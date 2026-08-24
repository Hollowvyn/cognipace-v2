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

  it('coarsens ratios from raw numerators and denominators, including unequal daily samples', () => {
    const dailyRatios = [1, 0]

    expect(
      recomputeBucketRatio([
        { numerator: 1, denominator: 1 },
        { numerator: 0, denominator: 99 },
      ]),
    ).toBe(0.01)
    expect(dailyRatios.reduce((sum, ratio) => sum + ratio, 0) / 2).toBe(0.5)
  })

  it('aggregates sums, medians, and last values without mutating samples', () => {
    const values = [7, 1, 4]

    expect(sumBucketValues(values)).toBe(12)
    expect(medianBucketValues(values)).toBe(4)
    expect(lastBucketValue(values)).toBe(4)
    expect(values).toEqual([7, 1, 4])
  })

  it('derives a coarsened median from every raw sample rather than bucket medians', () => {
    const rawSamples = [1, 1, 1, 100]
    const dailyMedians = [1, 100]

    expect(medianBucketValues(rawSamples)).toBe(1)
    expect(medianBucketValues(dailyMedians)).toBe(50.5)
  })

  it('classifies solid adjacency', () => {
    expect(classifyLineContinuity([0.8, 0.84])).toEqual([
      { kind: 'solid', fromIndex: 0, toIndex: 1 },
    ])
  })

  it('classifies a permitted two-bucket hole as a bridge', () => {
    expect(classifyLineContinuity([0.8, null, null, 0.84])).toEqual([
      { kind: 'bridge', fromIndex: 0, toIndex: 3 },
    ])
  })

  it('bridges any gap between measured points', () => {
    expect(classifyLineContinuity([0.8, null, null, null, 0.84])).toEqual([
      { kind: 'bridge', fromIndex: 0, toIndex: 4 },
    ])
  })

  it('ignores leading and trailing nulls without synthesizing points or mutating values', () => {
    const values = [null, 0.8, 0.84, null]

    expect(classifyLineContinuity(values)).toEqual([
      { kind: 'solid', fromIndex: 1, toIndex: 2 },
    ])
    expect(values).toEqual([null, 0.8, 0.84, null])
  })
})
