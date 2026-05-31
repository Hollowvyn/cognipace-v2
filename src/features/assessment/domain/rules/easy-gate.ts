import type { LeetCodeAssessmentInput } from '../assessment-types'
import type { AssessmentDerivedSignals } from '../derived'
import type { BaseRatingOutcome } from './base-rating'

export const EASY_GATE_RATIO = 0.5

export function applyEasyGate(
  input: LeetCodeAssessmentInput,
  derived: AssessmentDerivedSignals,
  base: BaseRatingOutcome,
): BaseRatingOutcome {
  if (input.intent !== 'quick-submit' && input.intent !== 'leetcode-accepted') {
    return base
  }
  if (base.rating !== 'good') {
    return base
  }
  if (derived.isRecallReview !== true) {
    return base
  }
  if (derived.ratioOfTarget === null || derived.ratioOfTarget > EASY_GATE_RATIO) {
    return base
  }
  if (derived.beatsPreviousBest !== true) {
    return base
  }

  return {
    rating: 'easy',
    reasonCode:
      input.intent === 'quick-submit' ? 'quick-easy-fast' : 'leetcode-easy-fast',
  }
}
