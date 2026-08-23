import { describe, expect, it } from 'vitest'

import {
  buildAdaptivePercentageDomain,
  buildLogDurationDomain,
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
  })

  it('includes the seven-day benchmark in a logarithmic duration domain', () => {
    expect(buildLogDurationDomain([2, 16])).toEqual([1, 100])
  })
})
