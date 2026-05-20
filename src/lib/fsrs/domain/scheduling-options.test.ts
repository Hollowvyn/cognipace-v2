import { describe, expect, it } from 'vitest'

import {
  defaultFsrsSchedulingOptions,
  isFsrsStepUnit,
  normalizeFsrsSchedulingOptions,
  parseFsrsStepUnit,
} from './scheduling-options'

describe('FSRS scheduling options', () => {
  it('parses positive whole-number step units', () => {
    for (const value of ['12h', '23h', '30m', '2d'] as const) {
      expect(parseFsrsStepUnit(value)).toBe(value)
    }

    for (const value of ['1.5h', '0h', '12hours']) {
      expect(isFsrsStepUnit(value)).toBe(false)
    }
  })

  it('normalizes scheduler options with LeetCode defaults', () => {
    expect(normalizeFsrsSchedulingOptions({})).toEqual(
      defaultFsrsSchedulingOptions,
    )
    expect(
      normalizeFsrsSchedulingOptions({
        targetRetention: 0.8,
        enableFuzz: true,
        enableShortTerm: false,
        learningSteps: ['30m'],
        relearningSteps: ['12h'],
      }),
    ).toEqual({
      targetRetention: 0.8,
      enableFuzz: true,
      enableShortTerm: false,
      learningSteps: ['30m'],
      relearningSteps: ['12h'],
    })
  })

  it.each([0, 1.1, Number.NaN])(
    'rejects invalid target retention value %s',
    (targetRetention) => {
      expect(() => normalizeFsrsSchedulingOptions({ targetRetention })).toThrow(
        `Invalid FSRS target retention "${targetRetention}".`,
      )
    },
  )

  it('rejects invalid step units', () => {
    expect(() =>
      normalizeFsrsSchedulingOptions({ learningSteps: ['1.5h'] }),
    ).toThrow('Invalid FSRS step unit "1.5h".')
  })
})
