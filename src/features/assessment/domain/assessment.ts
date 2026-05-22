import type { ProblemDifficulty } from '@/features/problems'
import type { UserSettings } from '@/features/settings'
import type { ReviewRating } from '@/lib/fsrs'

export const assessmentSubmissionIntents = [
  'quick-submit',
  'leetcode-accepted',
  'selected-rating',
  'fail',
] as const

export const assessmentDecisionStatuses = ['accepted', 'blocked'] as const
export const assessmentBlockReasons = ['solve-time-required'] as const
export const assessmentLockReasons = ['failed', 'hard-mode-overtime'] as const

export const assessmentAcceptedReasons = [
  'quick-good',
  'quick-hard-overtime',
  'leetcode-good',
  'leetcode-hard-overtime',
  'selected-rating',
  'failed',
  'hard-mode-overtime',
] as const

export type AssessmentSubmissionIntent =
  (typeof assessmentSubmissionIntents)[number]
export type AssessmentDecisionStatus =
  (typeof assessmentDecisionStatuses)[number]
export type AssessmentBlockReason = (typeof assessmentBlockReasons)[number]
export type AssessmentLockReason = (typeof assessmentLockReasons)[number]
export type AssessmentAcceptedReason =
  (typeof assessmentAcceptedReasons)[number]

export type AssessmentTimingSettings = UserSettings['timing']

export type LeetCodeAssessmentInput =
  | {
      intent: 'quick-submit'
      difficulty: ProblemDifficulty
      timing: AssessmentTimingSettings
      elapsedSeconds?: number | null | undefined
    }
  | {
      intent: 'leetcode-accepted'
      difficulty: ProblemDifficulty
      timing: AssessmentTimingSettings
      elapsedSeconds?: number | null | undefined
    }
  | {
      intent: 'selected-rating'
      difficulty: ProblemDifficulty
      timing: AssessmentTimingSettings
      selectedRating: ReviewRating
      elapsedSeconds?: number | null | undefined
    }
  | {
      intent: 'fail'
      difficulty: ProblemDifficulty
      timing: AssessmentTimingSettings
      elapsedSeconds?: number | null | undefined
    }

export type LeetCodeAssessmentDecision =
  | {
      status: 'accepted'
      rating: ReviewRating
      elapsedSeconds: number | null
      isCorrect: boolean
      targetSeconds: number
      isOverTarget: boolean
      lockReason: AssessmentLockReason | null
      reason: AssessmentAcceptedReason
    }
  | {
      status: 'blocked'
      reason: AssessmentBlockReason
      targetSeconds: number
      elapsedSeconds: null
    }

type TimingGoalKey = 'easyMinutes' | 'mediumMinutes' | 'hardMinutes'

const timingGoalKeyByDifficulty = {
  easy: 'easyMinutes',
  medium: 'mediumMinutes',
  hard: 'hardMinutes',
  unknown: 'hardMinutes',
} as const satisfies Record<ProblemDifficulty, TimingGoalKey>

export function getLeetCodeSolveTimeTargetSeconds(
  difficulty: ProblemDifficulty,
  timing: AssessmentTimingSettings,
): number {
  const minutes = timing[timingGoalKeyByDifficulty[difficulty]]

  return normalizePositiveInteger(minutes) * secondsPerMinute
}

export function evaluateLeetCodeAssessment(
  input: LeetCodeAssessmentInput,
): LeetCodeAssessmentDecision {
  const targetSeconds = getLeetCodeSolveTimeTargetSeconds(
    input.difficulty,
    input.timing,
  )
  const elapsedSeconds = normalizeElapsedSeconds(input.elapsedSeconds)
  const isOverTarget = elapsedSeconds !== null && elapsedSeconds > targetSeconds

  if (input.intent === 'fail') {
    return acceptAssessment({
      rating: 'again',
      elapsedSeconds,
      targetSeconds,
      isOverTarget,
      lockReason: 'failed',
      reason: 'failed',
    })
  }

  if (isOverTarget && input.timing.hardMode) {
    return acceptAssessment({
      rating: 'again',
      elapsedSeconds,
      targetSeconds,
      isOverTarget,
      lockReason: 'hard-mode-overtime',
      reason: 'hard-mode-overtime',
    })
  }

  switch (input.intent) {
    case 'quick-submit':
      return acceptAssessment({
        rating: isOverTarget ? 'hard' : 'good',
        elapsedSeconds,
        targetSeconds,
        isOverTarget,
        lockReason: null,
        reason: isOverTarget ? 'quick-hard-overtime' : 'quick-good',
      })
    case 'leetcode-accepted':
      return acceptAssessment({
        rating: isOverTarget ? 'hard' : 'good',
        elapsedSeconds,
        targetSeconds,
        isOverTarget,
        lockReason: null,
        reason: isOverTarget ? 'leetcode-hard-overtime' : 'leetcode-good',
      })
    case 'selected-rating':
      return acceptAssessment({
        rating: input.selectedRating,
        elapsedSeconds,
        targetSeconds,
        isOverTarget,
        lockReason: null,
        reason: 'selected-rating',
      })
    default:
      return assertNever(input)
  }
}

function acceptAssessment(input: {
  rating: ReviewRating
  elapsedSeconds: number | null
  targetSeconds: number
  isOverTarget: boolean
  lockReason: AssessmentLockReason | null
  reason: AssessmentAcceptedReason
}): LeetCodeAssessmentDecision {
  return {
    status: 'accepted',
    rating: input.rating,
    elapsedSeconds: input.elapsedSeconds,
    isCorrect: input.rating !== 'again',
    targetSeconds: input.targetSeconds,
    isOverTarget: input.isOverTarget,
    lockReason: input.lockReason,
    reason: input.reason,
  }
}

function normalizeElapsedSeconds(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  const elapsedSeconds = Math.floor(value)

  return elapsedSeconds > 0 ? elapsedSeconds : null
}

function normalizePositiveInteger(value: number) {
  if (!Number.isFinite(value) || value < 1) {
    return 1
  }

  return Math.floor(value)
}

function assertNever(value: never): never {
  void value
  throw new Error('Unhandled assessment input')
}

const secondsPerMinute = 60
