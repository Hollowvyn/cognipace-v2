import type { ReviewRating } from '@/lib/fsrs'

import type { AssessmentRecommendationState } from '../../..'

export type OverlayAssessmentRecommendationProps = {
  state: AssessmentRecommendationState
  selectedRating: ReviewRating
  isRatingLocked: boolean
  isMutating: boolean
  onUseRecommendation: (rating: ReviewRating) => void
}

export function OverlayAssessmentRecommendation({
  state,
}: OverlayAssessmentRecommendationProps) {
  if (state.status === 'idle') {
    return null
  }
  return null
}
