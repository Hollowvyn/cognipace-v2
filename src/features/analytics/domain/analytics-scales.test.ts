import { describe, expect, it } from 'vitest'

import {
  buildAdaptiveDurationScale,
  buildAdaptivePercentageDomain,
  buildLogDurationDomain,
  buildMagnitudeScale,
  buildMagnitudeDomain,
} from './analytics-scales'

describe('analytics scales', () => {
  it('creates a deterministic, disclosed percentage domain around visible values', () => {
    expect(buildAdaptivePercentageDomain([0.7, 0.9], [0.8])).toEqual([
      0.65, 0.95,
    ])
  })

  it('keeps a 25-point window for an equal percentage series', () => {
    expect(buildAdaptivePercentageDomain([0.8])).toEqual([0.65, 0.95])
  })

  it('uses a zero baseline and a meaningful domain for zero-only magnitude data', () => {
    expect(buildMagnitudeDomain([0, 0])).toEqual([0, 1])
    expect(buildMagnitudeScale([0, 0]).ticks).toEqual([0, 1])
  })

  it('exposes four or five deterministic nice-number magnitude intervals', () => {
    expect(buildMagnitudeScale([12])).toEqual({
      domain: [0, 20],
      ticks: [0, 5, 10, 15, 20],
    })
    expect(buildMagnitudeScale([46])).toEqual({
      domain: [0, 100],
      ticks: [0, 20, 40, 60, 80, 100],
    })
  })

  it('keeps the approved small-count domain with whole-number ticks', () => {
    expect(buildMagnitudeScale([1])).toEqual({
      domain: [0, 2],
      ticks: [0, 1, 2],
    })
    expect(buildMagnitudeScale([2])).toEqual({
      domain: [0, 5],
      ticks: [0, 1, 2, 3, 4, 5],
    })
  })

  it('builds a centered adaptive-duration scale with deterministic nice ticks', () => {
    expect(buildAdaptiveDurationScale([3, 5])).toEqual({
      domain: [2, 6],
      ticks: [2, 3, 4, 5, 6],
    })
  })

  it('keeps the minimum duration window when values are equal or clamped at zero', () => {
    expect(buildAdaptiveDurationScale([7])).toEqual({
      domain: [6, 8],
      ticks: [6, 6.5, 7, 7.5, 8],
    })
    expect(buildAdaptiveDurationScale([0, 0.2])).toEqual({
      domain: [0, 2],
      ticks: [0, 0.5, 1, 1.5, 2],
    })
  })

  it('falls back to a stable duration scale when no finite value is visible', () => {
    expect(buildAdaptiveDurationScale([Number.NaN, Infinity])).toEqual({
      domain: [0, 2],
      ticks: [0, 0.5, 1, 1.5, 2],
    })
  })

  it('includes the seven-day benchmark in a logarithmic duration domain', () => {
    expect(buildLogDurationDomain([2, 16])).toEqual([1, 100])
  })
})
