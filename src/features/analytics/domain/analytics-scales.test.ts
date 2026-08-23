import { describe, expect, it } from 'vitest'

import {
  buildAdaptiveDurationDomain,
  buildAdaptivePercentageDomain,
  buildCountDomain,
  buildLogDurationDomain,
} from './analytics-scales'

describe('analytics scales', () => {
  it('builds the locked adaptive percentage domain', () => {
    expect(buildAdaptivePercentageDomain([0.75, 0.94], [0.9])).toEqual([0.7, 1])
  })

  it('keeps an all-equal percentage series visible', () => {
    expect(buildAdaptivePercentageDomain([0.8], [])).toEqual([0.65, 0.95])
  })

  it('shifts percentage domains before clamping to the valid range', () => {
    expect(buildAdaptivePercentageDomain([0.04], [])).toEqual([0, 0.25])
    expect(buildAdaptivePercentageDomain([0.98], [])).toEqual([0.75, 1])
  })

  it('clamps an out-of-range percentage domain to zero through one', () => {
    expect(buildAdaptivePercentageDomain([-0.2, 1.2], [])).toEqual([0, 1])
  })

  it('builds a zero-clamped duration domain with a two-day minimum', () => {
    expect(buildAdaptiveDurationDomain([0.2])).toEqual([0, 2])
    expect(buildAdaptiveDurationDomain([3.2, 4.1])).toEqual([2, 5])
  })

  it('keeps a high-baseline all-equal duration series near its movement window', () => {
    expect(buildAdaptiveDurationDomain([80])).toEqual([79, 81])
    expect(buildAdaptiveDurationDomain([80, 80.4])).toEqual([79, 82])
  })

  it('builds a zero-based count domain with a nice upper bound', () => {
    expect(buildCountDomain([0, 7], [5])).toEqual([0, 10])
    expect(buildCountDomain([])).toEqual([0, 1])
  })

  it('uses powers of ten and always includes the seven-day benchmark', () => {
    expect(buildLogDurationDomain([20, 80])).toEqual([1, 100])
    expect(buildLogDurationDomain([0, Number.NaN])).toEqual([1, 10])
  })

  it('keeps the seven-day benchmark when a custom reference is valid', () => {
    expect(buildLogDurationDomain([20, 80], 1_000)).toEqual([1, 1_000])
  })

  it('ignores invalid custom log references instead of producing a NaN domain', () => {
    expect(buildLogDurationDomain([], 0)).toEqual([1, 10])
    expect(buildLogDurationDomain([], Number.NaN)).toEqual([1, 10])
  })
})
