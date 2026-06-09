import { useId, type CSSProperties } from 'react'

import { cn } from '@/utils/cn'
import type { ReviewRating } from '@/lib/fsrs'
import { Badge } from '@/components/ui/badge'
import type { AssessmentRecommendationConfidence } from '@/features/leetcode-review-assistant'

import type { AssessmentRecommendationState } from '../../..'

export type OverlayAssessmentRecommendationProps = {
  state: AssessmentRecommendationState
  selectedRating: ReviewRating
  isRatingLocked: boolean
  isMutating: boolean
  onUseRecommendation: (rating: ReviewRating) => void
}

const LABEL_ID_PREFIX = 'overlay-ai-recommendation'

const RATING_LABEL_BY_RATING: Record<ReviewRating, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
}

const CONFIDENCE_LABEL: Record<AssessmentRecommendationConfidence, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const CONFIDENCE_DOT_CLASS: Record<AssessmentRecommendationConfidence, string> = {
  high: 'bg-[color:var(--cp-tone-success-fg)]',
  medium: 'bg-foreground',
  low: 'bg-muted-foreground',
}

function ratingAccentStyle(rating: ReviewRating): CSSProperties {
  return {
    '--overlay-rating-fg': `var(--cp-tone-review-${rating}-fg)`,
  } as CSSProperties
}

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

      {state.status === 'ready' ? (
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <Badge tone={`review-${state.recommendation.recommendedRating}`}>
              {RATING_LABEL_BY_RATING[state.recommendation.recommendedRating]}
            </Badge>
            <span className="inline-flex items-center gap-1.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span
                aria-hidden="true"
                className={cn(
                  'inline-block h-1.5 w-1.5 rounded-full',
                  CONFIDENCE_DOT_CLASS[state.recommendation.confidence],
                )}
              />
              {CONFIDENCE_LABEL[state.recommendation.confidence]} confidence
            </span>
          </div>
          <p
            className={cn(
              'border-l-2 pl-2 text-[0.78rem] leading-snug text-foreground',
              'border-[color:var(--overlay-rating-fg)]',
            )}
            style={ratingAccentStyle(state.recommendation.recommendedRating)}
          >
            {state.recommendation.primaryReason}
          </p>
        </div>
      ) : null}
    </section>
  )
}
