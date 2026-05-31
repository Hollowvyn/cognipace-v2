import { describe, expect, it } from 'vitest'

import type {
  AssessmentPracticeContext,
  AssessmentTimingSettings,
  AssessmentWarningCode,
  LeetCodeAssessmentInput,
} from '../assessment-types'
import { deriveAssessmentSignals } from '../derived'
import { collectWarnings, isDowngrade } from './warnings'

const timing = {
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

function codes(
  warnings: { code: AssessmentWarningCode }[],
): AssessmentWarningCode[] {
  return warnings.map((w) => w.code)
}

describe('collectWarnings', () => {
  it('emits untimed when timer was not used', () => {
    const { input, derived } = build({ elapsedSeconds: null })
    expect(
      codes(
        collectWarnings(input, derived, {
          proposedRating: 'good',
              lockReason: null,
          selectedRatingConflicts: false,
        }),
      ),
    ).toContain('untimed')
  })

  it('emits solve-time-required-missing when requireSolveTime + untimed', () => {
    const { input, derived } = build({
      elapsedSeconds: null,
      timing: { ...timing, requireSolveTime: true },
    })
    const result = collectWarnings(input, derived, {
      proposedRating: 'good',
      lockReason: null,
      selectedRatingConflicts: false,
    })
    const required = result.find(
      (w) => w.code === 'solve-time-required-missing',
    )
    expect(required).toBeDefined()
    expect(required?.signals).toMatchObject({ targetSeconds: 35 * 60 })
  })

  it('emits no-practice-context when context is absent', () => {
    const { input, derived } = build({})
    expect(
      codes(
        collectWarnings(input, derived, {
          proposedRating: 'good',
              lockReason: null,
          selectedRatingConflicts: false,
        }),
      ),
    ).toContain('no-practice-context')
  })

  it('emits first-solve when context isFirstSolve is true', () => {
    const { input, derived } = build({
      practiceContext: { ...recallContext, isFirstSolve: true },
    })
    expect(
      codes(
        collectWarnings(input, derived, {
          proposedRating: 'good',
              lockReason: null,
          selectedRatingConflicts: false,
        }),
      ),
    ).toContain('first-solve')
  })

  it('emits no-previous-best when context exists with no prior best', () => {
    const { input, derived } = build({
      practiceContext: { ...recallContext, previousBestSeconds: null },
    })
    expect(
      codes(
        collectWarnings(input, derived, {
          proposedRating: 'good',
              lockReason: null,
          selectedRatingConflicts: false,
        }),
      ),
    ).toContain('no-previous-best')
  })

  it('emits retry-after-fail with previous attempt signals', () => {
    const { input, derived } = build({
      practiceContext: {
        ...recallContext,
        latestAttempt: {
          rating: 'again',
          isCorrect: false,
          elapsedSeconds: 25 * 60,
          occurredAt: 1_700_000_000_000,
        },
      },
    })
    const warning = collectWarnings(input, derived, {
      proposedRating: 'good',
      lockReason: null,
      selectedRatingConflicts: false,
    }).find((w) => w.code === 'retry-after-fail')
    expect(warning).toBeDefined()
    expect(warning?.signals).toMatchObject({
      previousElapsedSeconds: 25 * 60,
      occurredAt: 1_700_000_000_000,
    })
  })

  it('emits downgrade-from-previous when proposed rating ranks below previous', () => {
    const { input, derived } = build({
      practiceContext: { ...recallContext, previousRating: 'good' },
    })
    const warning = collectWarnings(input, derived, {
      proposedRating: 'hard',
      lockReason: null,
      selectedRatingConflicts: false,
    }).find((w) => w.code === 'downgrade-from-previous')
    expect(warning).toBeDefined()
    expect(warning?.signals).toMatchObject({
      previousRating: 'good',
      proposedRating: 'hard',
    })
  })

  it('emits selected-rating-conflict when caller flags conflict and no lock', () => {
    const { input, derived } = build({
      intent: 'selected-rating',
      selectedRating: 'easy',
      practiceContext: recallContext,
    })
    const result = collectWarnings(input, derived, {
      proposedRating: 'easy',
      lockReason: null,
      selectedRatingConflicts: true,
      policyBaseRating: 'good',
    })
    const conflict = result.find((w) => w.code === 'selected-rating-conflict')
    expect(conflict).toBeDefined()
    expect(conflict?.signals).toMatchObject({
      selectedRating: 'easy',
      policyRating: 'good',
    })
  })

  it('suppresses selected-rating-conflict under a lock', () => {
    const { input, derived } = build({
      intent: 'selected-rating',
      selectedRating: 'easy',
    })
    const result = collectWarnings(input, derived, {
      proposedRating: 'again',
      lockReason: 'hard-mode-overtime',
      selectedRatingConflicts: true,
      policyBaseRating: 'hard',
    })
    expect(codes(result)).not.toContain('selected-rating-conflict')
  })

  it('combines warnings in stable order: untimed before no-practice-context', () => {
    const { input, derived } = build({ elapsedSeconds: null })
    const result = collectWarnings(input, derived, {
      proposedRating: 'good',
      lockReason: null,
      selectedRatingConflicts: false,
    })
    const list = codes(result)
    expect(list.indexOf('untimed')).toBeLessThan(
      list.indexOf('no-practice-context'),
    )
  })

  it('isDowngrade ranks again < hard < good < easy', () => {
    expect(isDowngrade('hard', 'good')).toBe(true)
    expect(isDowngrade('good', 'hard')).toBe(false)
    expect(isDowngrade('again', 'easy')).toBe(true)
    expect(isDowngrade('easy', 'easy')).toBe(false)
  })
})
