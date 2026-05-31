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

type ExpectedAccepted = Omit<Partial<AcceptedAssessment>, 'reason'> & {
  reason?: { code: AcceptedAssessment['reason']['code'] }
}

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
        reason: { code: 'quick-good' },
      }),
    },
    {
      name: 'quick-submit within target returns Good',
      input: quickSubmit(30 * secondsPerMinute),
      expected: acceptedDecision({
        rating: 'good',
        elapsedSeconds: 30 * secondsPerMinute,
        reason: { code: 'quick-good' },
      }),
    },
    {
      name: 'quick-submit overtime returns Hard when strict timing is off',
      input: quickSubmit(36 * secondsPerMinute),
      expected: acceptedDecision({
        rating: 'hard',
        elapsedSeconds: 36 * secondsPerMinute,
        isOverTarget: true,
        reason: { code: 'quick-hard-overtime' },
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
        reason: { code: 'leetcode-good' },
      }),
    },
    {
      name: 'LeetCode accepted overtime returns Hard when strict timing is off',
      input: leetcodeAccepted(36 * secondsPerMinute),
      expected: acceptedDecision({
        rating: 'hard',
        elapsedSeconds: 36 * secondsPerMinute,
        isOverTarget: true,
        reason: { code: 'leetcode-hard-overtime' },
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
        reason: { code: 'selected-rating' },
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
        reason: { code: 'failed' },
      },
    },
    {
      name: 'solve-time-required is warning-only for quick submit',
      input: quickSubmit(null, { requireSolveTime: true }),
      expected: acceptedDecision({
        rating: 'good',
        elapsedSeconds: null,
        reason: { code: 'quick-good' },
      }),
    },
  ] satisfies Array<{
    name: string
    input: LeetCodeAssessmentInput
    expected: ExpectedAccepted
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

  it('returns easy with leetcode-easy-fast on fast recall solve beating prior best', () => {
    const decision = evaluateLeetCodeAssessment({
      intent: 'leetcode-accepted',
      difficulty: 'medium',
      elapsedSeconds: 14 * 60,
      timing,
      practiceContext: {
        isFirstSolve: false,
        previousRating: 'good',
        previousBestSeconds: 30 * 60,
        latestAttempt: null,
      },
    })
    expect(decision).toMatchObject({
      status: 'accepted',
      rating: 'easy',
      reason: { code: 'leetcode-easy-fast' },
      confidence: 1,
    })
    expect(
      decision.status === 'accepted' ? decision.warnings.map((w) => w.code) : [],
    ).toEqual([])
  })

  it('keeps fast first-solve at good and emits first-solve warning', () => {
    const decision = evaluateLeetCodeAssessment({
      intent: 'leetcode-accepted',
      difficulty: 'medium',
      elapsedSeconds: 14 * 60,
      timing,
      practiceContext: {
        isFirstSolve: true,
        previousRating: null,
        previousBestSeconds: null,
        latestAttempt: null,
      },
    })
    expect(decision).toMatchObject({
      status: 'accepted',
      rating: 'good',
      reason: { code: 'leetcode-good' },
    })
    expect(
      decision.status === 'accepted' ? decision.warnings.map((w) => w.code) : [],
    ).toEqual(expect.arrayContaining(['first-solve', 'no-previous-best']))
  })

  it('reports confidence 0.48 for untimed quick-submit with no practice context', () => {
    expect(
      evaluateLeetCodeAssessment({
        intent: 'quick-submit',
        difficulty: 'medium',
        elapsedSeconds: null,
        timing,
      }),
    ).toMatchObject({
      status: 'accepted',
      rating: 'good',
      confidence: 0.48,
    })
  })

  it('sets confidence to 1 for locked fail decisions', () => {
    expect(
      evaluateLeetCodeAssessment({
        intent: 'fail',
        difficulty: 'medium',
        elapsedSeconds: null,
        timing,
      }),
    ).toMatchObject({
      status: 'accepted',
      rating: 'again',
      lockReason: 'failed',
      confidence: 1,
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

function strictTimingOvertime(elapsedSeconds: number): ExpectedAccepted {
  return {
    rating: 'again',
    elapsedSeconds,
    isCorrect: false,
    isOverTarget: true,
    lockReason: 'hard-mode-overtime',
    reason: { code: 'hard-mode-overtime' },
  } satisfies ExpectedAccepted
}

function acceptedDecision(overrides: ExpectedAccepted): ExpectedAccepted {
  return {
    isCorrect: true,
    isOverTarget: false,
    lockReason: null,
    ...overrides,
  }
}
