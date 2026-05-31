import type { ReviewRating } from '@/lib/fsrs'

import type {
  AssessmentReasonCode,
  LeetCodeAssessmentInput,
} from '../assessment-types'
import type { AssessmentDerivedSignals } from '../derived'

export type BaseRatingOutcome = {
  rating: ReviewRating
  reasonCode: AssessmentReasonCode
}

export function proposeBaseRating(
  input: LeetCodeAssessmentInput,
  derived: AssessmentDerivedSignals,
): BaseRatingOutcome {
  switch (input.intent) {
    case 'selected-rating':
      return { rating: input.selectedRating, reasonCode: 'selected-rating' }
    case 'quick-submit':
      return derived.isOverTarget
        ? { rating: 'hard', reasonCode: 'quick-hard-overtime' }
        : { rating: 'good', reasonCode: 'quick-good' }
    case 'leetcode-accepted':
      return derived.isOverTarget
        ? { rating: 'hard', reasonCode: 'leetcode-hard-overtime' }
        : { rating: 'good', reasonCode: 'leetcode-good' }
    case 'fail':
      throw new Error(
        'proposeBaseRating should not be called for fail intent (hard-lock applies)',
      )
  }
}
