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
export const assessmentConfidences = ['low', 'medium', 'high'] as const
export const assessmentReviewModes = ['first-solve', 'recall'] as const

export const assessmentAcceptedReasons = [
  'quick-good',
  'quick-easy-fast',
  'quick-hard-overtime',
  'leetcode-good',
  'leetcode-easy-fast',
  'leetcode-hard-overtime',
  'selected-rating',
  'failed',
  'hard-mode-overtime',
] as const

export const assessmentWarnings = [
  'missing-solve-time',
  'solve-time-required',
  'selected-rating-conflict',
] as const

export type AssessmentSubmissionIntent =
  (typeof assessmentSubmissionIntents)[number]
export type AssessmentDecisionStatus =
  (typeof assessmentDecisionStatuses)[number]
export type AssessmentBlockReason = (typeof assessmentBlockReasons)[number]
export type AssessmentLockReason = (typeof assessmentLockReasons)[number]
export type AssessmentConfidence = (typeof assessmentConfidences)[number]
export type AssessmentReviewMode = (typeof assessmentReviewModes)[number]
export type AssessmentAcceptedReason =
  (typeof assessmentAcceptedReasons)[number]
export type AssessmentWarning = (typeof assessmentWarnings)[number]

export type AssessmentTimingSettings = UserSettings['assessment']

/**
 * Read-only practice signals the policy may use to refine a rating before AI is
 * involved. Derived from already-persisted practice details by the caller; the
 * policy never reads or writes persistence itself.
 */
export type AssessmentPracticeContext = {
  reviewMode: AssessmentReviewMode
  previousRating: ReviewRating | null
  previousBestSeconds: number | null
}

type AssessmentInputBase = {
  difficulty: ProblemDifficulty
  timing: AssessmentTimingSettings
  elapsedSeconds?: number | null | undefined
  context?: AssessmentPracticeContext | null | undefined
}

export type LeetCodeAssessmentInput =
  | ({ intent: 'quick-submit' } & AssessmentInputBase)
  | ({ intent: 'leetcode-accepted' } & AssessmentInputBase)
  | ({
      intent: 'selected-rating'
      selectedRating: ReviewRating
    } & AssessmentInputBase)
  | ({ intent: 'fail' } & AssessmentInputBase)

export type AcceptedAssessmentDecision = {
  status: 'accepted'
  rating: ReviewRating
  isCorrect: boolean
  elapsedSeconds: number | null
  targetSeconds: number
  isOverTarget: boolean
  lockReason: AssessmentLockReason | null
  confidence: AssessmentConfidence
  reason: AssessmentAcceptedReason
  warnings: AssessmentWarning[]
}

export type BlockedAssessmentDecision = {
  status: 'blocked'
  reason: AssessmentBlockReason
  targetSeconds: number
  elapsedSeconds: null
}

export type LeetCodeAssessmentDecision =
  | AcceptedAssessmentDecision
  | BlockedAssessmentDecision

type TimingGoalKey = 'easy' | 'medium' | 'hard'

const timingGoalKeyByDifficulty = {
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
  unknown: 'hard',
} as const satisfies Record<ProblemDifficulty, TimingGoalKey>

/**
 * Fraction of the solve-time target under which a clean, timed accept can be
 * recommended as Easy. Kept conservative so Easy only fires on clearly fast
 * solves.
 */
const easyFastTargetRatio = 0.5

export function getLeetCodeSolveTimeTargetSeconds(
  difficulty: ProblemDifficulty,
  timing: AssessmentTimingSettings,
): number {
  const minutes =
    timing.timeTargetsMinutes[timingGoalKeyByDifficulty[difficulty]]

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
  const context = input.context ?? null

  // A failed submission is always Again and locks the session, regardless of
  // timing or solve-time requirements.
  if (input.intent === 'fail') {
    return acceptAssessment({
      rating: 'again',
      elapsedSeconds,
      targetSeconds,
      isOverTarget,
      lockReason: 'failed',
      reason: 'failed',
      confidence: 'high',
      warnings: [],
    })
  }

  // Hard mode (strict timing): an overtime solve still locks to Again.
  if (isOverTarget && input.timing.strictTiming) {
    return acceptAssessment({
      rating: 'again',
      elapsedSeconds,
      targetSeconds,
      isOverTarget,
      lockReason: 'hard-mode-overtime',
      reason: 'hard-mode-overtime',
      confidence: 'high',
      warnings: [],
    })
  }

  switch (input.intent) {
    case 'quick-submit':
      return evaluateAcceptedSolve('quick', {
        elapsedSeconds,
        targetSeconds,
        isOverTarget,
        context,
        timing: input.timing,
      })
    case 'leetcode-accepted':
      return evaluateAcceptedSolve('leetcode', {
        elapsedSeconds,
        targetSeconds,
        isOverTarget,
        context,
        timing: input.timing,
      })
    case 'selected-rating':
      return evaluateSelectedRating({
        selectedRating: input.selectedRating,
        elapsedSeconds,
        targetSeconds,
        isOverTarget,
        timing: input.timing,
      })
    default:
      return assertNever(input)
  }
}

type AcceptedSolveContext = {
  elapsedSeconds: number | null
  targetSeconds: number
  isOverTarget: boolean
  context: AssessmentPracticeContext | null
  timing: AssessmentTimingSettings
}

function evaluateAcceptedSolve(
  kind: 'quick' | 'leetcode',
  {
    elapsedSeconds,
    targetSeconds,
    isOverTarget,
    context,
    timing,
  }: AcceptedSolveContext,
): AcceptedAssessmentDecision {
  const warnings = collectTimingWarnings(elapsedSeconds, timing)

  // Overtime without hard mode falls back to Hard.
  if (isOverTarget) {
    return acceptAssessment({
      rating: 'hard',
      elapsedSeconds,
      targetSeconds,
      isOverTarget,
      lockReason: null,
      reason:
        kind === 'quick' ? 'quick-hard-overtime' : 'leetcode-hard-overtime',
      confidence: 'high',
      warnings,
    })
  }

  // A clearly fast and clean solve can be recommended as Easy.
  if (qualifiesForEasy(elapsedSeconds, targetSeconds, context)) {
    return acceptAssessment({
      rating: 'easy',
      elapsedSeconds,
      targetSeconds,
      isOverTarget,
      lockReason: null,
      reason: kind === 'quick' ? 'quick-easy-fast' : 'leetcode-easy-fast',
      confidence: 'high',
      warnings,
    })
  }

  // Default accept is Good. Without a timer reading the signal is weaker, so
  // confidence drops to low.
  return acceptAssessment({
    rating: 'good',
    elapsedSeconds,
    targetSeconds,
    isOverTarget,
    lockReason: null,
    reason: kind === 'quick' ? 'quick-good' : 'leetcode-good',
    confidence: elapsedSeconds === null ? 'low' : 'medium',
    warnings,
  })
}

type SelectedRatingContext = {
  selectedRating: ReviewRating
  elapsedSeconds: number | null
  targetSeconds: number
  isOverTarget: boolean
  timing: AssessmentTimingSettings
}

function evaluateSelectedRating({
  selectedRating,
  elapsedSeconds,
  targetSeconds,
  isOverTarget,
  timing,
}: SelectedRatingContext): AcceptedAssessmentDecision {
  const warnings = collectTimingWarnings(elapsedSeconds, timing)

  // Flag an optimistic manual rating that conflicts with an overtime solve so
  // downstream AI/explanations can reconcile it.
  if (
    isOverTarget &&
    (selectedRating === 'good' || selectedRating === 'easy')
  ) {
    warnings.push('selected-rating-conflict')
  }

  return acceptAssessment({
    rating: selectedRating,
    elapsedSeconds,
    targetSeconds,
    isOverTarget,
    lockReason: null,
    reason: 'selected-rating',
    confidence: 'high',
    warnings,
  })
}

function qualifiesForEasy(
  elapsedSeconds: number | null,
  targetSeconds: number,
  context: AssessmentPracticeContext | null,
): boolean {
  if (elapsedSeconds === null) {
    return false
  }

  if (elapsedSeconds > targetSeconds * easyFastTargetRatio) {
    return false
  }

  // A recall review recovering from a recent failure is not a "clean" solve.
  if (context?.reviewMode === 'recall' && context.previousRating === 'again') {
    return false
  }

  return true
}

function collectTimingWarnings(
  elapsedSeconds: number | null,
  timing: AssessmentTimingSettings,
): AssessmentWarning[] {
  if (elapsedSeconds !== null) {
    return []
  }

  const warnings: AssessmentWarning[] = ['missing-solve-time']

  if (timing.requireSolveTime) {
    warnings.push('solve-time-required')
  }

  return warnings
}

function acceptAssessment(input: {
  rating: ReviewRating
  elapsedSeconds: number | null
  targetSeconds: number
  isOverTarget: boolean
  lockReason: AssessmentLockReason | null
  reason: AssessmentAcceptedReason
  confidence: AssessmentConfidence
  warnings: AssessmentWarning[]
}): AcceptedAssessmentDecision {
  return {
    status: 'accepted',
    rating: input.rating,
    isCorrect: input.rating !== 'again',
    elapsedSeconds: input.elapsedSeconds,
    targetSeconds: input.targetSeconds,
    isOverTarget: input.isOverTarget,
    lockReason: input.lockReason,
    confidence: input.confidence,
    reason: input.reason,
    warnings: input.warnings,
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
