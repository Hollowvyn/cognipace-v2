import { describe, expect, it } from 'vitest'

import type {
  AssessmentTimingSettings,
  LeetCodeAssessmentInput,
} from '../assessment-types'
import { deriveAssessmentSignals } from '../derived'
import { proposeBaseRating } from './base-rating'

const timing = {
  requireSolveTime: false,
  strictTiming: false,
  timeTargetsMinutes: { easy: 20, medium: 35, hard: 50 },
} satisfies AssessmentTimingSettings

function build(input: Partial<LeetCodeAssessmentInput>) {
  const merged = {
    intent: 'quick-submit',
    difficulty: 'medium',
    timing,
    elapsedSeconds: 600,
    ...input,
  } as LeetCodeAssessmentInput
  return { input: merged, derived: deriveAssessmentSignals(merged) }
}

describe('proposeBaseRating', () => {
  it('quick-submit under target -> good', () => {
    const { input, derived } = build({
      intent: 'quick-submit',
      elapsedSeconds: 30 * 60,
    })
    expect(proposeBaseRating(input, derived)).toEqual({
      rating: 'good',
      reasonCode: 'quick-good',
    })
  })

  it('quick-submit over target -> hard', () => {
    const { input, derived } = build({
      intent: 'quick-submit',
      elapsedSeconds: 36 * 60,
    })
    expect(proposeBaseRating(input, derived)).toEqual({
      rating: 'hard',
      reasonCode: 'quick-hard-overtime',
    })
  })

  it('leetcode-accepted under target -> good', () => {
    const { input, derived } = build({
      intent: 'leetcode-accepted',
      elapsedSeconds: 30 * 60,
    })
    expect(proposeBaseRating(input, derived)).toEqual({
      rating: 'good',
      reasonCode: 'leetcode-good',
    })
  })

  it('leetcode-accepted over target -> hard', () => {
    const { input, derived } = build({
      intent: 'leetcode-accepted',
      elapsedSeconds: 36 * 60,
    })
    expect(proposeBaseRating(input, derived)).toEqual({
      rating: 'hard',
      reasonCode: 'leetcode-hard-overtime',
    })
  })

  it('selected-rating passes the selectedRating through unchanged', () => {
    const { input, derived } = build({
      intent: 'selected-rating',
      selectedRating: 'easy',
      elapsedSeconds: 45 * 60,
    })
    expect(proposeBaseRating(input, derived)).toEqual({
      rating: 'easy',
      reasonCode: 'selected-rating',
    })
  })
})
