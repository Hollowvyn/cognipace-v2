import { describe, expect, it } from 'vitest'

import {
  evaluateLeetCodeAssessment,
  getLeetCodeSolveTimeTargetSeconds,
  type AssessmentTimingSettings,
  type LeetCodeAssessmentInput,
} from './assessment'

type AcceptedAssessment = Extract<
  ReturnType<typeof evaluateLeetCodeAssessment>,
  { status: 'accepted' }
>

const secondsPerMinute = 60
const timing = {
  requireSolveTime: false,
  hardMode: false,
  easyMinutes: 20,
  mediumMinutes: 35,
  hardMinutes: 50,
} as const satisfies AssessmentTimingSettings

describe('assessment policy', () => {
  it.each([
    ['easy', 20 * secondsPerMinute],
    ['medium', 35 * secondsPerMinute],
    ['hard', 50 * secondsPerMinute],
    ['unknown', 50 * secondsPerMinute],
  ] as const)('uses the %s solve-time target', (difficulty, targetSeconds) => {
    expect(getLeetCodeSolveTimeTargetSeconds(difficulty, timing)).toBe(
      targetSeconds,
    )
  })

  it.each([
    {
      name: 'quick-submit without elapsed time defaults to Good when optional',
      input: quickSubmit(null),
      expected: acceptedDecision({
        rating: 'good',
        elapsedSeconds: null,
        reason: 'quick-good',
      }),
    },
    {
      name: 'quick-submit within target returns Good',
      input: quickSubmit(30 * secondsPerMinute),
      expected: acceptedDecision({
        rating: 'good',
        elapsedSeconds: 30 * secondsPerMinute,
        reason: 'quick-good',
      }),
    },
    {
      name: 'quick-submit overtime returns Hard when Hard Mode is off',
      input: quickSubmit(36 * secondsPerMinute),
      expected: acceptedDecision({
        rating: 'hard',
        elapsedSeconds: 36 * secondsPerMinute,
        isOverTarget: true,
        reason: 'quick-hard-overtime',
      }),
    },
    {
      name: 'quick-submit overtime returns Again when Hard Mode is on',
      input: quickSubmit(36 * secondsPerMinute, { hardMode: true }),
      expected: hardModeOvertime(36 * secondsPerMinute),
    },
    {
      name: 'LeetCode accepted under target returns Good',
      input: leetcodeAccepted(30 * secondsPerMinute),
      expected: acceptedDecision({
        rating: 'good',
        elapsedSeconds: 30 * secondsPerMinute,
        reason: 'leetcode-good',
      }),
    },
    {
      name: 'LeetCode accepted overtime returns Hard when Hard Mode is off',
      input: leetcodeAccepted(36 * secondsPerMinute),
      expected: acceptedDecision({
        rating: 'hard',
        elapsedSeconds: 36 * secondsPerMinute,
        isOverTarget: true,
        reason: 'leetcode-hard-overtime',
      }),
    },
    {
      name: 'LeetCode accepted overtime returns Again when Hard Mode is on',
      input: leetcodeAccepted(36 * secondsPerMinute, { hardMode: true }),
      expected: hardModeOvertime(36 * secondsPerMinute),
    },
    {
      name: 'selected rating is preserved outside Hard Mode overtime',
      input: {
        intent: 'selected-rating',
        difficulty: 'hard',
        selectedRating: 'easy',
        elapsedSeconds: 45 * secondsPerMinute,
        timing,
      },
      expected: acceptedDecision({
        rating: 'easy',
        elapsedSeconds: 45 * secondsPerMinute,
        reason: 'selected-rating',
      }),
    },
    {
      name: 'selected rating is forced to Again during Hard Mode overtime',
      input: {
        intent: 'selected-rating',
        difficulty: 'hard',
        selectedRating: 'easy',
        elapsedSeconds: 51 * secondsPerMinute,
        timing: { ...timing, hardMode: true },
      },
      expected: hardModeOvertime(51 * secondsPerMinute),
    },
    {
      name: 'fail always saves Again and bypasses solve-time-required blocking',
      input: {
        intent: 'fail',
        difficulty: 'easy',
        elapsedSeconds: null,
        timing: { ...timing, requireSolveTime: true },
      },
      expected: {
        rating: 'again',
        elapsedSeconds: null,
        isCorrect: false,
        isOverTarget: false,
        lockReason: 'failed',
        reason: 'failed',
      },
    },
    {
      name: 'solve-time-required is warning-only for quick submit',
      input: quickSubmit(null, { requireSolveTime: true }),
      expected: acceptedDecision({
        rating: 'good',
        elapsedSeconds: null,
        reason: 'quick-good',
      }),
    },
  ] satisfies Array<{
    name: string
    input: LeetCodeAssessmentInput
    expected: Partial<AcceptedAssessment>
  }>)('$name', ({ input, expected }) => {
    expect(evaluateLeetCodeAssessment(input)).toMatchObject({
      status: 'accepted',
      targetSeconds: getLeetCodeSolveTimeTargetSeconds(
        input.difficulty,
        input.timing,
      ),
      ...expected,
    })
  })

  it.each([undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'normalizes invalid elapsed seconds %s to null',
    (elapsedSeconds) => {
      expect(quickSubmitDecision(elapsedSeconds)).toMatchObject({
        status: 'accepted',
        elapsedSeconds: null,
      })
    },
  )

  it('normalizes positive decimal elapsed seconds to whole seconds', () => {
    expect(
      evaluateLeetCodeAssessment({
        intent: 'selected-rating',
        difficulty: 'easy',
        selectedRating: 'good',
        elapsedSeconds: 90.8,
        timing,
      }),
    ).toMatchObject({
      status: 'accepted',
      elapsedSeconds: 90,
    })
  })
})

function quickSubmit(
  elapsedSeconds: number | null | undefined,
  timingPatch?: Partial<AssessmentTimingSettings>,
): LeetCodeAssessmentInput {
  return {
    intent: 'quick-submit',
    difficulty: 'medium',
    elapsedSeconds,
    timing: { ...timing, ...timingPatch },
  }
}

function leetcodeAccepted(
  elapsedSeconds: number | null | undefined,
  timingPatch?: Partial<AssessmentTimingSettings>,
): LeetCodeAssessmentInput {
  return {
    intent: 'leetcode-accepted',
    difficulty: 'medium',
    elapsedSeconds,
    timing: { ...timing, ...timingPatch },
  }
}

function quickSubmitDecision(elapsedSeconds: number | null | undefined) {
  return evaluateLeetCodeAssessment({
    ...quickSubmit(elapsedSeconds),
    difficulty: 'easy',
  })
}

function hardModeOvertime(elapsedSeconds: number) {
  return {
    rating: 'again',
    elapsedSeconds,
    isCorrect: false,
    isOverTarget: true,
    lockReason: 'hard-mode-overtime',
    reason: 'hard-mode-overtime',
  } satisfies Partial<AcceptedAssessment>
}

function acceptedDecision(
  overrides: Partial<AcceptedAssessment>,
): Partial<AcceptedAssessment> {
  return {
    isCorrect: true,
    isOverTarget: false,
    lockReason: null,
    ...overrides,
  }
}
