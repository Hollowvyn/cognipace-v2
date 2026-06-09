import { useId } from 'react'

import { cn } from '@/utils/cn'
import type { ReviewRating } from '@/lib/fsrs'

import type { AssessmentRecommendationState } from '../../..'

export type OverlayAssessmentRecommendationProps = {
  state: AssessmentRecommendationState
  selectedRating: ReviewRating
  isRatingLocked: boolean
  isMutating: boolean
  onUseRecommendation: (rating: ReviewRating) => void
}

const LABEL_ID_PREFIX = 'overlay-ai-recommendation'

export function OverlayAssessmentRecommendation({
  state,
}: OverlayAssessmentRecommendationProps) {
  const headingId = `${LABEL_ID_PREFIX}-${useId()}`

  if (state.status === 'idle') {
    return null
  }

  const isPending = state.status === 'pending'

  return (
    <section
      aria-busy={isPending || undefined}
      aria-labelledby={headingId}
      aria-live="polite"
      className="border-y border-border py-3"
      role="region"
    >
      <div
        className={cn(
          'mb-2 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em]',
          'text-muted-foreground',
        )}
        id={headingId}
      >
        AI recommendation
      </div>
      {isPending ? (
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-block h-5 w-12 animate-pulse rounded-full bg-muted"
          />
          <span
            aria-hidden="true"
            className="inline-block h-3 flex-1 max-w-[14rem] animate-pulse rounded bg-muted"
          />
          <span className="sr-only">Loading recommendation</span>
        </div>
      ) : null}
    </section>
  )
}
