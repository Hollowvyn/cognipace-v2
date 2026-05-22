import type { CSSProperties } from 'react'

import type { AssessmentLockReason } from '@/features/assessment'
import type { ReviewRating } from '@/lib/fsrs'
import { cn } from '@/utils/cn'

type AssessmentOption = {
  label: string
  meaning: string
  rating: ReviewRating
  token: string
}

const assessmentOptions = [
  {
    label: 'Easy',
    meaning: 'Fast',
    rating: 'easy',
    token: 'easy',
  },
  {
    label: 'Good',
    meaning: 'Stable',
    rating: 'good',
    token: 'good',
  },
  {
    label: 'Hard',
    meaning: 'Lagging',
    rating: 'hard',
    token: 'hard',
  },
  {
    label: 'Again',
    meaning: 'Failed',
    rating: 'again',
    token: 'again',
  },
] as const satisfies readonly AssessmentOption[]

type OverlayAssessmentRailProps = {
  isDisabled?: boolean
  lockReason: AssessmentLockReason | null
  selectedRating: ReviewRating
  onSelectRating: (rating: ReviewRating) => void
}

export function OverlayAssessmentRail({
  isDisabled,
  lockReason,
  selectedRating,
  onSelectRating,
}: OverlayAssessmentRailProps) {
  const selectedOption = assessmentOptions.find(
    (option) => option.rating === selectedRating,
  )

  return (
    <section aria-labelledby="overlay-assessment-heading">
      <div
        className="mb-2 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        id="overlay-assessment-heading"
      >
        Assessment
      </div>
      <div
        aria-label="Review assessment"
        className="grid grid-cols-4 overflow-hidden border border-border"
        role="group"
      >
        {assessmentOptions.map((option) => {
          const selected = option.rating === selectedRating
          const isOptionDisabled =
            isDisabled || (Boolean(lockReason) && !selected)

          return (
            <button
              aria-pressed={selected}
              className={cn(
                'min-w-0 border-r border-border bg-card px-2 py-3 text-center transition-colors last:border-r-0',
                'focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-35',
                selected
                  ? 'bg-[color:var(--overlay-rating-bg)] text-[color:var(--overlay-rating-fg)] ring-1 ring-inset ring-[color:var(--overlay-rating-fg)]'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              disabled={isOptionDisabled}
              key={option.rating}
              onClick={() => onSelectRating(option.rating)}
              style={ratingStyle(option.token)}
              type="button"
            >
              <span className="block truncate font-semibold">
                {option.label}
              </span>
              <span className="mt-1 block truncate font-mono text-[0.72rem] uppercase tracking-[0.12em] opacity-80">
                {option.meaning}
              </span>
            </button>
          )
        })}
      </div>
      <p
        className="mt-3 border-l-2 border-[color:var(--overlay-rating-fg)] pl-2 text-[0.78rem] leading-snug text-foreground"
        style={ratingStyle(selectedOption?.token ?? 'good')}
      >
        {formatAssessmentHelper(selectedRating, lockReason)}
      </p>
    </section>
  )
}

function ratingStyle(token: string): CSSProperties {
  return {
    '--overlay-rating-bg': `var(--cp-tone-review-${token}-bg)`,
    '--overlay-rating-fg': `var(--cp-tone-review-${token}-fg)`,
  } as CSSProperties
}

function formatAssessmentHelper(
  rating: ReviewRating,
  lockReason: AssessmentLockReason | null,
) {
  if (lockReason === 'hard-mode-overtime') {
    return 'Strict timing: overtime forces Again for this attempt.'
  }

  if (lockReason === 'failed') {
    return 'Failed attempt saved as Again.'
  }

  switch (rating) {
    case 'easy':
      return 'Easy/Fast: You solved it quickly with clear recall.'
    case 'good':
      return 'Good/Stable: Concept is clear, implementation was steady.'
    case 'hard':
      return 'Hard/Lagging: You finished, but recall or implementation was slow.'
    case 'again':
      return 'Again/Failed: Save this when you could not finish confidently.'
    default:
      return assertNever(rating)
  }
}

function assertNever(value: never): never {
  void value
  throw new Error('Unhandled assessment rating')
}
