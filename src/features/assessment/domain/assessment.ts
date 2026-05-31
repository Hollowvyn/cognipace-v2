import type { ReviewRating } from '@/lib/fsrs'

import type {
  AssessmentLockReason,
  AssessmentReason,
  AssessmentReasonCode,
  AssessmentTimingSettings,
  AssessmentWarning,
  LeetCodeAssessmentDecision,
  LeetCodeAssessmentInput,
} from './assessment-types'

export type { AssessmentTimingSettings, LeetCodeAssessmentInput }
import {
  deriveAssessmentSignals,
  getLeetCodeSolveTimeTargetSeconds,
  type AssessmentDerivedSignals,
} from './derived'
import { applyHardLocks } from './rules/hard-locks'
import { proposeBaseRating } from './rules/base-rating'
import { applyEasyGate } from './rules/easy-gate'
import { collectWarnings, isDowngrade } from './rules/warnings'
import { scoreConfidence } from './rules/confidence'

export { getLeetCodeSolveTimeTargetSeconds }

export function evaluateLeetCodeAssessment(
  input: LeetCodeAssessmentInput,
): LeetCodeAssessmentDecision {
  const derived = deriveAssessmentSignals(input)
  const previousBestSeconds =
    input.practiceContext?.previousBestSeconds ?? null
  const locked = applyHardLocks(input, derived)

  if (locked) {
    const warnings = collectWarnings(input, derived, {
      proposedRating: 'again',
      easyUpgraded: false,
      lockReason: locked.lockReason,
      selectedRatingConflicts: false,
    })
    return assembleAccepted({
      derived,
      rating: 'again',
      reasonCode: locked.reasonCode,
      lockReason: locked.lockReason,
      warnings,
      confidence: 1,
      previousBestSeconds,
    })
  }

  const base = proposeBaseRating(input, derived)
  const finalOutcome = applyEasyGate(input, derived, base)
  const policyBaseRating = computePolicyBaseRating(input, derived)
  const selectedRatingConflicts =
    input.intent === 'selected-rating' &&
    input.selectedRating !== policyBaseRating
  const downgradedFromPrevious =
    input.practiceContext?.previousRating != null &&
    isDowngrade(finalOutcome.rating, input.practiceContext.previousRating)

  const warnings = collectWarnings(input, derived, {
    proposedRating: finalOutcome.rating,
    easyUpgraded: finalOutcome !== base,
    lockReason: null,
    selectedRatingConflicts,
    policyBaseRating,
  })

  const confidence = scoreConfidence(input, derived, {
    lockReason: null,
    downgradedFromPrevious,
    selectedRatingConflicts,
  })

  return assembleAccepted({
    derived,
    rating: finalOutcome.rating,
    reasonCode: finalOutcome.reasonCode,
    lockReason: null,
    warnings,
    confidence,
    previousBestSeconds,
  })
}

function computePolicyBaseRating(
  input: LeetCodeAssessmentInput,
  derived: AssessmentDerivedSignals,
): ReviewRating {
  if (input.intent === 'selected-rating') {
    return derived.isOverTarget ? 'hard' : 'good'
  }
  return proposeBaseRating(input, derived).rating
}

function assembleAccepted(args: {
  derived: AssessmentDerivedSignals
  rating: ReviewRating
  reasonCode: AssessmentReasonCode
  lockReason: AssessmentLockReason | null
  warnings: AssessmentWarning[]
  confidence: number
  previousBestSeconds: number | null
}): LeetCodeAssessmentDecision {
  const {
    derived,
    rating,
    reasonCode,
    lockReason,
    warnings,
    confidence,
    previousBestSeconds,
  } = args

  const reason: AssessmentReason = {
    code: reasonCode,
    signals: {
      elapsedSeconds: derived.elapsedSeconds,
      targetSeconds: derived.targetSeconds,
      ratioOfTarget: derived.ratioOfTarget,
      previousBestSeconds,
      beatsPreviousBest: derived.beatsPreviousBest,
      isRecallReview: derived.isRecallReview,
    },
  }

  return {
    status: 'accepted',
    rating,
    isCorrect: rating !== 'again',
    elapsedSeconds: derived.elapsedSeconds,
    targetSeconds: derived.targetSeconds,
    isOverTarget: derived.isOverTarget,
    lockReason,
    reason,
    warnings,
    confidence,
  }
}
