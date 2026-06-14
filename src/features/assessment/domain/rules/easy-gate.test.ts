import { describe, expect, it } from 'vitest'

import type {
  AssessmentPracticeContext,
  AssessmentTimingSettings,
  LeetCodeAssessmentInput,
} from '../assessment-types'
import { deriveAssessmentSignals } from '../derived'
import type { BaseRatingOutcome } from './base-rating'
import { proposeBaseRating } from './base-rating'
import { applyEasyGate, EASY_GATE_RATIO } from './easy-gate'

const timing = {
  autoAssessmentEnabled: false,
  requireSolveTime: false,
  strictTiming: false,
  timeTargetsMinutes: { easy: 20, medium: 35, hard: 50 },
} satisfies AssessmentTimingSettings

const recallContext: AssessmentPracticeContext = {
  isFirstSolve: false,
  previousRating: 'good',
  previousBestSeconds: 30 * 60,
  latestAttempt: null,
}

function build(input: Partial<LeetCodeAssessmentInput>) {
  const merged = {
    intent: 'leetcode-accepted',
    difficulty: 'medium',
    timing,
    elapsedSeconds: 14 * 60, // 40% of medium target
    practiceContext: recallContext,
    ...input,
  } as LeetCodeAssessmentInput
  const derived = deriveAssessmentSignals(merged)
  const base: BaseRatingOutcome = proposeBaseRating(merged, derived)
  return { input: merged, derived, base }
}

describe('applyEasyGate', () => {
  it('fires for leetcode-accepted recall review at <=50% target beating prior best', () => {
    const { input, derived, base } = build({})
    expect(applyEasyGate(input, derived, base)).toEqual({
      rating: 'easy',
      reasonCode: 'leetcode-easy-fast',
    })
  })

  it('fires for quick-submit when all gates pass', () => {
    const { input, derived, base } = build({ intent: 'quick-submit' })
    expect(applyEasyGate(input, derived, base)).toEqual({
      rating: 'easy',
      reasonCode: 'quick-easy-fast',
    })
  })

  it('does not fire on first solve (no recall)', () => {
    const { input, derived, base } = build({
      practiceContext: { ...recallContext, isFirstSolve: true },
    })
    expect(applyEasyGate(input, derived, base)).toBe(base)
  })

  it('does not fire when practiceContext is absent', () => {
    const { input, derived, base } = build({ practiceContext: undefined })
    expect(applyEasyGate(input, derived, base)).toBe(base)
  })

  it('does not fire when previousBestSeconds is null', () => {
    const { input, derived, base } = build({
      practiceContext: { ...recallContext, previousBestSeconds: null },
    })
    expect(applyEasyGate(input, derived, base)).toBe(base)
  })

  it('does not fire when slower than previousBest', () => {
    const { input, derived, base } = build({
      practiceContext: { ...recallContext, previousBestSeconds: 10 * 60 },
    })
    expect(applyEasyGate(input, derived, base)).toBe(base)
  })

  it('does not fire when ratioOfTarget is above EASY_GATE_RATIO', () => {
    const { input, derived, base } = build({ elapsedSeconds: 21 * 60 }) // 60%
    expect(applyEasyGate(input, derived, base)).toBe(base)
  })

  it('fires when ratioOfTarget equals EASY_GATE_RATIO exactly (inclusive)', () => {
    // Medium target = 35 * 60 = 2100s; half = 1050s → ratioOfTarget === 0.5
    const { input, derived, base } = build({ elapsedSeconds: 1050 })
    expect(derived.ratioOfTarget).toBe(0.5)
    expect(applyEasyGate(input, derived, base)).toEqual({
      rating: 'easy',
      reasonCode: 'leetcode-easy-fast',
    })
  })

  it('does not fire for selected-rating intent', () => {
    const { input, derived, base } = build({
      intent: 'selected-rating',
      selectedRating: 'good',
    })
    expect(applyEasyGate(input, derived, base)).toBe(base)
  })

  it('does not fire when base rating is hard (would only upgrade good)', () => {
    const overTarget = build({ elapsedSeconds: 36 * 60 })
    expect(overTarget.base.rating).toBe('hard')
    expect(applyEasyGate(overTarget.input, overTarget.derived, overTarget.base))
      .toBe(overTarget.base)
  })

  it('exposes EASY_GATE_RATIO as 0.5', () => {
    expect(EASY_GATE_RATIO).toBe(0.5)
  })
})
