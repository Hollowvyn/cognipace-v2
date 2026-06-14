import { describe, expect, it } from 'vitest'

import type {
  AssessmentTimingSettings,
  LeetCodeAssessmentInput,
} from '../assessment-types'
import { deriveAssessmentSignals } from '../derived'
import { applyHardLocks } from './hard-locks'

const timing = {
  autoAssessmentEnabled: false,
  requireSolveTime: false,
  strictTiming: false,
  timeTargetsMinutes: { easy: 20, medium: 35, hard: 50 },
} satisfies AssessmentTimingSettings

function build(input: Partial<LeetCodeAssessmentInput> = {}) {
  const merged = {
    intent: 'leetcode-accepted',
    difficulty: 'medium',
    timing,
    elapsedSeconds: 600,
    ...input,
  } as LeetCodeAssessmentInput
  return { input: merged, derived: deriveAssessmentSignals(merged) }
}

describe('applyHardLocks', () => {
  it('locks Again on fail intent even when strict-timing overtime would also fire', () => {
    const { input, derived } = build({
      intent: 'fail',
      timing: { ...timing, strictTiming: true },
      elapsedSeconds: 36 * 60,
    })
    expect(applyHardLocks(input, derived)).toEqual({
      lockReason: 'failed',
      reasonCode: 'failed',
    })
  })

  it('locks Again when strict timing is on and over target', () => {
    const { input, derived } = build({
      timing: { ...timing, strictTiming: true },
      elapsedSeconds: 36 * 60,
    })
    expect(applyHardLocks(input, derived)).toEqual({
      lockReason: 'hard-mode-overtime',
      reasonCode: 'hard-mode-overtime',
    })
  })

  it('locks Again when strict timing overrides a selected easy rating', () => {
    const { input, derived } = build({
      intent: 'selected-rating',
      selectedRating: 'easy',
      timing: { ...timing, strictTiming: true },
      elapsedSeconds: 51 * 60,
      difficulty: 'hard',
    })
    expect(applyHardLocks(input, derived)).toEqual({
      lockReason: 'hard-mode-overtime',
      reasonCode: 'hard-mode-overtime',
    })
  })

  it('does not lock when strict timing is off, even over target', () => {
    const { input, derived } = build({ elapsedSeconds: 36 * 60 })
    expect(applyHardLocks(input, derived)).toBeNull()
  })

  it('does not lock when under target with strict timing on', () => {
    const { input, derived } = build({
      timing: { ...timing, strictTiming: true },
      elapsedSeconds: 20 * 60,
    })
    expect(applyHardLocks(input, derived)).toBeNull()
  })
})
