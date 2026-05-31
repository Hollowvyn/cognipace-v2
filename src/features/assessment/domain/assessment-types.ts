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

export const assessmentReasonCodes = [
  'failed',
  'hard-mode-overtime',
  'quick-good',
  'quick-hard-overtime',
  'leetcode-good',
  'leetcode-hard-overtime',
  'leetcode-easy-fast',
  'quick-easy-fast',
  'selected-rating',
] as const

export const assessmentWarningCodes = [
  'untimed',
  'solve-time-required-missing',
  'no-practice-context',
  'first-solve',
  'no-previous-best',
  'retry-after-fail',
  'downgrade-from-previous',
  'selected-rating-conflict',
] as const

export type AssessmentSubmissionIntent =
  (typeof assessmentSubmissionIntents)[number]
export type AssessmentDecisionStatus =
  (typeof assessmentDecisionStatuses)[number]
export type AssessmentBlockReason = (typeof assessmentBlockReasons)[number]
export type AssessmentLockReason = (typeof assessmentLockReasons)[number]
export type AssessmentReasonCode = (typeof assessmentReasonCodes)[number]
export type AssessmentWarningCode = (typeof assessmentWarningCodes)[number]

export type AssessmentTimingSettings = UserSettings['assessment']

export type AssessmentPracticeContext = {
  isFirstSolve: boolean
  previousRating: ReviewRating | null
  previousBestSeconds: number | null
  latestAttempt: {
    rating: ReviewRating
    isCorrect: boolean
    elapsedSeconds: number | null
    occurredAt: number
  } | null
}

type BaseAssessmentInput = {
  difficulty: ProblemDifficulty
  timing: AssessmentTimingSettings
  elapsedSeconds?: number | null | undefined
  timerUsed?: boolean | undefined
  practiceContext?: AssessmentPracticeContext | undefined
}

export type LeetCodeAssessmentInput =
  | ({ intent: 'quick-submit' } & BaseAssessmentInput)
  | ({ intent: 'leetcode-accepted' } & BaseAssessmentInput)
  | ({
      intent: 'selected-rating'
      selectedRating: ReviewRating
    } & BaseAssessmentInput)
  | ({ intent: 'fail' } & BaseAssessmentInput)

export type AssessmentReasonSignals = {
  elapsedSeconds: number | null
  targetSeconds: number
  ratioOfTarget: number | null
  previousBestSeconds: number | null
  beatsPreviousBest: boolean | null
  isRecallReview: boolean | null
}

export type AssessmentReason = {
  code: AssessmentReasonCode
  signals: AssessmentReasonSignals
}

export type AssessmentWarning = {
  code: AssessmentWarningCode
  signals: Record<string, number | string | boolean | null>
}

export type AssessmentBlockedReason = {
  code: AssessmentBlockReason
  signals: { targetSeconds: number }
}

export type LeetCodeAssessmentDecision =
  | {
      status: 'accepted'
      rating: ReviewRating
      isCorrect: boolean
      elapsedSeconds: number | null
      targetSeconds: number
      isOverTarget: boolean
      lockReason: AssessmentLockReason | null
      reason: AssessmentReason
      warnings: AssessmentWarning[]
      confidence: number
    }
  | {
      status: 'blocked'
      reason: AssessmentBlockedReason
      targetSeconds: number
      elapsedSeconds: null
    }

/**
 * @deprecated re-exported here so the domain barrel can satisfy the feature
 * barrel's existing contract without touching `assessment.ts`. The same `const`
 * and type live in `assessment.ts`; the domain barrel sources them from this
 * file. Remove after Task 8 replaces `assessment.ts` and the feature barrel is
 * updated.
 */
export const assessmentAcceptedReasons = [
  'quick-good',
  'quick-hard-overtime',
  'leetcode-good',
  'leetcode-hard-overtime',
  'selected-rating',
  'failed',
  'hard-mode-overtime',
] as const

/** @deprecated Use {@link AssessmentReasonCode} instead. Remove after Task 8. */
export type AssessmentAcceptedReason =
  (typeof assessmentAcceptedReasons)[number]
