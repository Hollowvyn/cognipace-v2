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
  strictTiming: false,
  timeTargetsMinutes: {
    easy: 20,
    medium: 35,
    hard: 50,
  },
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
      name: 'quick-submit overtime returns Hard when strict timing is off',
      input: quickSubmit(36 * secondsPerMinute),
      expected: acceptedDecision({
        rating: 'hard',
        elapsedSeconds: 36 * secondsPerMinute,
        isOverTarget: true,
        reason: 'quick-hard-overtime',
      }),
    },
    {
      name: 'quick-submit overtime returns Again when strict timing is on',
      input: quickSubmit(36 * secondsPerMinute, { strictTiming: true }),
      expected: strictTimingOvertime(36 * secondsPerMinute),
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
      name: 'LeetCode accepted overtime returns Hard when strict timing is off',
      input: leetcodeAccepted(36 * secondsPerMinute),
      expected: acceptedDecision({
        rating: 'hard',
        elapsedSeconds: 36 * secondsPerMinute,
        isOverTarget: true,
        reason: 'leetcode-hard-overtime',
      }),
    },
    {
      name: 'LeetCode accepted overtime returns Again when strict timing is on',
      input: leetcodeAccepted(36 * secondsPerMinute, { strictTiming: true }),
      expected: strictTimingOvertime(36 * secondsPerMinute),
    },
    {
      name: 'selected rating is preserved outside strict timing overtime',
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
      name: 'selected rating is forced to Again during strict timing overtime',
      input: {
        intent: 'selected-rating',
        difficulty: 'hard',
        selectedRating: 'easy',
        elapsedSeconds: 51 * secondsPerMinute,
        timing: { ...timing, strictTiming: true },
      },
      expected: strictTimingOvertime(51 * secondsPerMinute),
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

describe('assessment confidence, warnings, and practice context', () => {
  const mediumTarget = 35 * secondsPerMinute
  const fastSolveSeconds = 10 * secondsPerMinute
  const moderateSolveSeconds = 25 * secondsPerMinute
  const overtimeSeconds = 40 * secondsPerMinute

  it('locks a failed submission to Again with high confidence', () => {
    expect(
      evaluateLeetCodeAssessment({
        intent: 'fail',
        difficulty: 'medium',
        elapsedSeconds: moderateSolveSeconds,
        timing,
      }),
    ).toMatchObject({
      status: 'accepted',
      rating: 'again',
      isCorrect: false,
      lockReason: 'failed',
      reason: 'failed',
      confidence: 'high',
      warnings: [],
    })
  })

  it('locks a hard-mode overtime accept to Again with high confidence', () => {
    expect(
      evaluateLeetCodeAssessment(
        leetcodeAccepted(overtimeSeconds, { strictTiming: true }),
      ),
    ).toMatchObject({
      status: 'accepted',
      rating: 'again',
      isCorrect: false,
      isOverTarget: true,
      lockReason: 'hard-mode-overtime',
      reason: 'hard-mode-overtime',
      confidence: 'high',
    })
  })

  it('recommends Easy for a clearly fast and clean accept', () => {
    expect(
      evaluateLeetCodeAssessment(leetcodeAccepted(fastSolveSeconds)),
    ).toMatchObject({
      status: 'accepted',
      rating: 'easy',
      reason: 'leetcode-easy-fast',
      confidence: 'high',
      isOverTarget: false,
      targetSeconds: mediumTarget,
    })
  })

  it('keeps a moderately fast accept at Good with medium confidence', () => {
    expect(
      evaluateLeetCodeAssessment(leetcodeAccepted(moderateSolveSeconds)),
    ).toMatchObject({
      status: 'accepted',
      rating: 'good',
      reason: 'leetcode-good',
      confidence: 'medium',
    })
  })

  it('returns Hard for an overtime accept when hard mode is off', () => {
    expect(
      evaluateLeetCodeAssessment(leetcodeAccepted(overtimeSeconds)),
    ).toMatchObject({
      status: 'accepted',
      rating: 'hard',
      reason: 'leetcode-hard-overtime',
      isOverTarget: true,
      confidence: 'high',
    })
  })

  it('allows an untimed accept with low confidence and a missing-solve-time warning', () => {
    expect(evaluateLeetCodeAssessment(leetcodeAccepted(null))).toMatchObject({
      status: 'accepted',
      rating: 'good',
      elapsedSeconds: null,
      confidence: 'low',
      warnings: ['missing-solve-time'],
    })
  })

  it('flags solve-time-required when a timer is required but missing', () => {
    expect(
      evaluateLeetCodeAssessment(
        leetcodeAccepted(null, { requireSolveTime: true }),
      ),
    ).toMatchObject({
      status: 'accepted',
      rating: 'good',
      confidence: 'low',
      warnings: ['missing-solve-time', 'solve-time-required'],
    })
  })

  it('quick-submit also promotes a fast clean solve to Easy', () => {
    expect(
      evaluateLeetCodeAssessment(quickSubmit(fastSolveSeconds)),
    ).toMatchObject({
      status: 'accepted',
      rating: 'easy',
      reason: 'quick-easy-fast',
      confidence: 'high',
    })
  })

  it('promotes a fast clean recall solve to Easy', () => {
    expect(
      evaluateLeetCodeAssessment({
        intent: 'leetcode-accepted',
        difficulty: 'medium',
        elapsedSeconds: fastSolveSeconds,
        timing,
        context: {
          reviewMode: 'recall',
          previousRating: 'good',
          previousBestSeconds: 20 * secondsPerMinute,
          previousElapsedSeconds: 20 * secondsPerMinute,
        },
      }),
    ).toMatchObject({
      status: 'accepted',
      rating: 'easy',
      reason: 'leetcode-easy-fast',
    })
  })

  it('keeps a fast recall solve at Good while recovering from a recent failure', () => {
    expect(
      evaluateLeetCodeAssessment({
        intent: 'leetcode-accepted',
        difficulty: 'medium',
        elapsedSeconds: fastSolveSeconds,
        timing,
        context: {
          reviewMode: 'recall',
          previousRating: 'again',
          previousBestSeconds: null,
          previousElapsedSeconds: null,
        },
      }),
    ).toMatchObject({
      status: 'accepted',
      rating: 'good',
      reason: 'leetcode-good',
    })
  })

  it('preserves a manual rating but warns when it conflicts with overtime', () => {
    expect(
      evaluateLeetCodeAssessment({
        intent: 'selected-rating',
        difficulty: 'medium',
        selectedRating: 'easy',
        elapsedSeconds: overtimeSeconds,
        timing,
      }),
    ).toMatchObject({
      status: 'accepted',
      rating: 'easy',
      reason: 'selected-rating',
      isOverTarget: true,
      confidence: 'high',
      warnings: ['selected-rating-conflict'],
    })
  })

  it('preserves a manual rating without warnings when it matches the timing', () => {
    expect(
      evaluateLeetCodeAssessment({
        intent: 'selected-rating',
        difficulty: 'medium',
        selectedRating: 'hard',
        elapsedSeconds: moderateSolveSeconds,
        timing,
      }),
    ).toMatchObject({
      status: 'accepted',
      rating: 'hard',
      reason: 'selected-rating',
      confidence: 'high',
      warnings: [],
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

function strictTimingOvertime(elapsedSeconds: number) {
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
