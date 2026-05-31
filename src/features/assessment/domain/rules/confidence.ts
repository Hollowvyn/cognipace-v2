import type {
  AssessmentLockReason,
  LeetCodeAssessmentInput,
} from '../assessment-types'
import type { AssessmentDerivedSignals } from '../derived'

export const CONFIDENCE_FACTORS = {
  untimed: 0.6,
  noPracticeContext: 0.8,
  firstSolve: 0.85,
  noPreviousBest: 0.9,
  retryAfterFail: 0.85,
  downgradeFromPrevious: 0.9,
  selectedRatingConflict: 0.85,
  solveTimeRequiredMissing: 0.7,
} as const

export type ScoreConfidenceContext = {
  lockReason: AssessmentLockReason | null
  downgradedFromPrevious: boolean
  selectedRatingConflicts: boolean
}

export function scoreConfidence(
  input: LeetCodeAssessmentInput,
  derived: AssessmentDerivedSignals,
  ctx: ScoreConfidenceContext,
): number {
  if (ctx.lockReason !== null) {
    return 1
  }

  let score = 1
  const practiceContext = input.practiceContext

  if (derived.isUntimed) {
    score *= CONFIDENCE_FACTORS.untimed
  }
  if (practiceContext == null) {
    score *= CONFIDENCE_FACTORS.noPracticeContext
  } else {
    if (practiceContext.isFirstSolve) {
      score *= CONFIDENCE_FACTORS.firstSolve
    }
    if (practiceContext.previousBestSeconds == null) {
      score *= CONFIDENCE_FACTORS.noPreviousBest
    }
    if (practiceContext.latestAttempt?.isCorrect === false) {
      score *= CONFIDENCE_FACTORS.retryAfterFail
    }
  }
  if (ctx.downgradedFromPrevious) {
    score *= CONFIDENCE_FACTORS.downgradeFromPrevious
  }
  if (ctx.selectedRatingConflicts) {
    score *= CONFIDENCE_FACTORS.selectedRatingConflict
  }
  if (input.timing.requireSolveTime && derived.isUntimed) {
    score *= CONFIDENCE_FACTORS.solveTimeRequiredMissing
  }

  return Math.round(score * 100) / 100
}
