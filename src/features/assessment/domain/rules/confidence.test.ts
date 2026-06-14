import { describe, expect, it } from 'vitest'

import type {
  AssessmentPracticeContext,
  AssessmentTimingSettings,
  LeetCodeAssessmentInput,
} from '../assessment-types'
import { deriveAssessmentSignals } from '../derived'
import { CONFIDENCE_FACTORS, scoreConfidence } from './confidence'

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
    elapsedSeconds: 30 * 60,
    ...input,
  } as LeetCodeAssessmentInput
  return { input: merged, derived: deriveAssessmentSignals(merged) }
}

describe('scoreConfidence', () => {
  it('returns 1 when locked', () => {
    const { input, derived } = build({})
    expect(
      scoreConfidence(input, derived, {
        lockReason: 'failed',
        downgradedFromPrevious: false,
        selectedRatingConflicts: false,
      }),
    ).toBe(1)
  })

  it('returns 1 for the fully-confident recall path', () => {
    const { input, derived } = build({
      elapsedSeconds: 14 * 60,
      practiceContext: recallContext,
    })
    expect(
      scoreConfidence(input, derived, {
        lockReason: null,
        downgradedFromPrevious: false,
        selectedRatingConflicts: false,
      }),
    ).toBe(1)
  })

  it('returns 0.80 when timed but no practice context', () => {
    const { input, derived } = build({})
    expect(
      scoreConfidence(input, derived, {
        lockReason: null,
        downgradedFromPrevious: false,
        selectedRatingConflicts: false,
      }),
    ).toBe(0.8)
  })

  it('returns 0.48 for quick-submit untimed with no context', () => {
    const { input, derived } = build({
      intent: 'quick-submit',
      elapsedSeconds: null,
    })
    // 1 * 0.60 (untimed) * 0.80 (noPracticeContext) = 0.48
    expect(
      scoreConfidence(input, derived, {
        lockReason: null,
        downgradedFromPrevious: false,
        selectedRatingConflicts: false,
      }),
    ).toBe(0.48)
  })

  it('returns 0.34 for quick-submit untimed, no context, requireSolveTime on', () => {
    const { input, derived } = build({
      intent: 'quick-submit',
      elapsedSeconds: null,
      timing: { ...timing, requireSolveTime: true },
    })
    // 1 * 0.60 * 0.80 * 0.70 = 0.336 -> 0.34
    expect(
      scoreConfidence(input, derived, {
        lockReason: null,
        downgradedFromPrevious: false,
        selectedRatingConflicts: false,
      }),
    ).toBe(0.34)
  })

  it('exposes CONFIDENCE_FACTORS for inspection', () => {
    expect(CONFIDENCE_FACTORS).toMatchObject({
      untimed: 0.6,
      noPracticeContext: 0.8,
      firstSolve: 0.85,
      noPreviousBest: 0.9,
      retryAfterFail: 0.85,
      downgradeFromPrevious: 0.9,
      selectedRatingConflict: 0.85,
      solveTimeRequiredMissing: 0.7,
    })
  })
})
