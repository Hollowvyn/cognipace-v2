import type { ReviewRating } from '@/lib/fsrs'

import type {
  AssessmentLockReason,
  AssessmentWarning,
  LeetCodeAssessmentInput,
} from '../assessment-types'
import type { AssessmentDerivedSignals } from '../derived'

export type CollectWarningsContext = {
  proposedRating: ReviewRating
  lockReason: AssessmentLockReason | null
  selectedRatingConflicts: boolean
  /** Required when selectedRatingConflicts is true. */
  policyBaseRating?: ReviewRating
}

const RATING_RANK: Record<ReviewRating, number> = {
  again: 0,
  hard: 1,
  good: 2,
  easy: 3,
}

export function isDowngrade(
  proposed: ReviewRating,
  previous: ReviewRating,
): boolean {
  return RATING_RANK[proposed] < RATING_RANK[previous]
}

export function collectWarnings(
  input: LeetCodeAssessmentInput,
  derived: AssessmentDerivedSignals,
  ctx: CollectWarningsContext,
): AssessmentWarning[] {
  const warnings: AssessmentWarning[] = []
  const practiceContext = input.practiceContext

  if (derived.isUntimed) {
    warnings.push({ code: 'untimed', signals: {} })
  }

  if (input.timing.requireSolveTime && derived.isUntimed) {
    warnings.push({
      code: 'solve-time-required-missing',
      signals: { targetSeconds: derived.targetSeconds },
    })
  }

  if (practiceContext == null) {
    warnings.push({ code: 'no-practice-context', signals: {} })
  } else {
    if (practiceContext.isFirstSolve) {
      warnings.push({ code: 'first-solve', signals: {} })
    }
    if (practiceContext.previousBestSeconds == null) {
      warnings.push({ code: 'no-previous-best', signals: {} })
    }
    if (practiceContext.latestAttempt?.isCorrect === false) {
      warnings.push({
        code: 'retry-after-fail',
        signals: {
          previousElapsedSeconds:
            practiceContext.latestAttempt.elapsedSeconds ?? null,
          occurredAt: practiceContext.latestAttempt.occurredAt,
        },
      })
    }
    if (
      practiceContext.previousRating !== null &&
      isDowngrade(ctx.proposedRating, practiceContext.previousRating)
    ) {
      warnings.push({
        code: 'downgrade-from-previous',
        signals: {
          previousRating: practiceContext.previousRating,
          proposedRating: ctx.proposedRating,
        },
      })
    }
  }

  if (
    ctx.lockReason == null &&
    input.intent === 'selected-rating' &&
    ctx.selectedRatingConflicts &&
    ctx.policyBaseRating !== undefined
  ) {
    warnings.push({
      code: 'selected-rating-conflict',
      signals: {
        selectedRating: input.selectedRating,
        policyRating: ctx.policyBaseRating,
      },
    })
  }

  return warnings
}
