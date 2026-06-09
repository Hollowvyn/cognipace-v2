import { useId, type CSSProperties } from 'react'

import { cn } from '@/utils/cn'
import type { ReviewRating } from '@/lib/fsrs'
import { Badge } from '@/components/ui/badge'
import type { Tone } from '@/components/ui/types'
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

const RATING_TONE_BY_RATING: Record<ReviewRating, Tone> = {
  again: 'review-again',
  hard: 'review-hard',
  good: 'review-good',
  easy: 'review-easy',
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
    '--overlay-rating-bg': `var(--cp-tone-review-${rating}-bg)`,
    '--overlay-rating-fg': `var(--cp-tone-review-${rating}-fg)`,
  } as CSSProperties
}

export function OverlayAssessmentRecommendation({
  state,
  selectedRating,
  isRatingLocked,
  isMutating,
  onUseRecommendation,
}: OverlayAssessmentRecommendationProps) {
  const headingId = `${LABEL_ID_PREFIX}-${useId()}`

  if (state.status === 'idle') {
    return null
  }

  const isPending = state.status === 'pending'
  const isReady = state.status === 'ready'
  const showUseButton =
    isReady &&
    !isRatingLocked &&
    !isMutating &&
    state.recommendation.recommendedRating !== selectedRating

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
            <div className="flex items-center gap-2">
              <Badge tone={RATING_TONE_BY_RATING[state.recommendation.recommendedRating]}>
                {RATING_LABEL_BY_RATING[state.recommendation.recommendedRating]}
              </Badge>
              {showUseButton ? (
                <button
                  className={cn(
                    'rounded-md border border-primary px-2 py-1 text-[0.72rem] font-semibold text-primary',
                    'transition-colors hover:bg-primary/10',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                  onClick={() =>
                    onUseRecommendation(state.recommendation.recommendedRating)
                  }
                  type="button"
                >
                  Use recommendation
                </button>
              ) : null}
            </div>
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
