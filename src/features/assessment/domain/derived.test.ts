import { describe, expect, it } from 'vitest'

import type {
  AssessmentTimingSettings,
  LeetCodeAssessmentInput,
} from './assessment-types'
import { deriveAssessmentSignals } from './derived'

const timing = {
  requireSolveTime: false,
  strictTiming: false,
  timeTargetsMinutes: { easy: 20, medium: 35, hard: 50 },
} satisfies AssessmentTimingSettings

function quickSubmit(
  patch: Partial<LeetCodeAssessmentInput> = {},
): LeetCodeAssessmentInput {
  return {
    intent: 'quick-submit',
    difficulty: 'medium',
    timing,
    elapsedSeconds: 600,
    ...patch,
  } as LeetCodeAssessmentInput
}

describe('deriveAssessmentSignals', () => {
  it('computes targetSeconds from difficulty + timing', () => {
    expect(deriveAssessmentSignals(quickSubmit()).targetSeconds).toBe(35 * 60)
  })

  it('normalizes elapsed seconds to a positive integer', () => {
    expect(
      deriveAssessmentSignals(quickSubmit({ elapsedSeconds: 90.8 }))
        .elapsedSeconds,
    ).toBe(90)
  })

  it.each([null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'maps invalid elapsed seconds (%s) to null',
    (value) => {
      expect(
        deriveAssessmentSignals(quickSubmit({ elapsedSeconds: value })),
      ).toMatchObject({ elapsedSeconds: null, isUntimed: true })
    },
  )

  it('treats timerUsed:false as untimed even when elapsedSeconds is set', () => {
    expect(
      deriveAssessmentSignals(
        quickSubmit({ elapsedSeconds: 600, timerUsed: false }),
      ),
    ).toMatchObject({ elapsedSeconds: 600, isUntimed: true })
  })

  it('computes isOverTarget and ratioOfTarget', () => {
    const derived = deriveAssessmentSignals(
      quickSubmit({ elapsedSeconds: 42 * 60 }),
    )
    expect(derived.isOverTarget).toBe(true)
    expect(derived.ratioOfTarget).toBeCloseTo(1.2)
  })

  it('returns null ratioOfTarget when untimed', () => {
    expect(
      deriveAssessmentSignals(quickSubmit({ elapsedSeconds: null })),
    ).toMatchObject({ ratioOfTarget: null, isOverTarget: false })
  })

  it('returns null isRecallReview when practiceContext is absent', () => {
    expect(deriveAssessmentSignals(quickSubmit()).isRecallReview).toBeNull()
  })

  it('marks recall review when practiceContext.isFirstSolve is false', () => {
    expect(
      deriveAssessmentSignals(
        quickSubmit({
          practiceContext: {
            isFirstSolve: false,
            previousRating: 'good',
            previousBestSeconds: 1800,
            latestAttempt: null,
          },
        }),
      ).isRecallReview,
    ).toBe(true)
  })

  it('marks non-recall when practiceContext.isFirstSolve is true', () => {
    expect(
      deriveAssessmentSignals(
        quickSubmit({
          practiceContext: {
            isFirstSolve: true,
            previousRating: null,
            previousBestSeconds: null,
            latestAttempt: null,
          },
        }),
      ).isRecallReview,
    ).toBe(false)
  })

  it('returns null beatsPreviousBest when no prior best exists', () => {
    expect(
      deriveAssessmentSignals(
        quickSubmit({
          practiceContext: {
            isFirstSolve: false,
            previousRating: 'good',
            previousBestSeconds: null,
            latestAttempt: null,
          },
        }),
      ).beatsPreviousBest,
    ).toBeNull()
  })

  it('returns false beatsPreviousBest when untimed', () => {
    expect(
      deriveAssessmentSignals(
        quickSubmit({
          elapsedSeconds: null,
          practiceContext: {
            isFirstSolve: false,
            previousRating: 'good',
            previousBestSeconds: 1800,
            latestAttempt: null,
          },
        }),
      ).beatsPreviousBest,
    ).toBe(false)
  })

  it('returns true beatsPreviousBest when elapsed < previousBest', () => {
    expect(
      deriveAssessmentSignals(
        quickSubmit({
          elapsedSeconds: 1200,
          practiceContext: {
            isFirstSolve: false,
            previousRating: 'good',
            previousBestSeconds: 1800,
            latestAttempt: null,
          },
        }),
      ).beatsPreviousBest,
    ).toBe(true)
  })

  it('returns false beatsPreviousBest when elapsed equals previousBest (strict comparison)', () => {
    expect(
      deriveAssessmentSignals(
        quickSubmit({
          elapsedSeconds: 1800,
          practiceContext: {
            isFirstSolve: false,
            previousRating: 'good',
            previousBestSeconds: 1800,
            latestAttempt: null,
          },
        }),
      ).beatsPreviousBest,
    ).toBe(false)
  })
})
