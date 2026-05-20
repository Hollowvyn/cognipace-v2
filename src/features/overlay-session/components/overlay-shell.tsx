import { AlertCircle, CheckCircle2, Clock3 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { SurfaceRoot } from '@/components/ui/surface'
import { TimerDisplay } from '@/components/ui/timer-display'
import type { Tone } from '@/components/ui/types'
import { reviewRatings, type ReviewRating } from '@/lib/fsrs'

import type {
  LeetCodeOverlaySession,
  OverlaySyncStatus,
} from '../hooks/use-leetcode-overlay-session'

type OverlayShellProps = LeetCodeOverlaySession

const ratingLabels = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
} as const satisfies Record<ReviewRating, string>

export function OverlayShell({
  context,
  elapsedSeconds,
  feedback,
  location,
  metadata,
  saveReview,
  status,
}: OverlayShellProps) {
  const isSaving = status === 'saving-review'
  const canSave = Boolean(context?.problem) && !isSaving
  const problemTitle =
    metadata?.title ??
    context?.problem.title ??
    location?.slug ??
    'Reading page'
  const difficulty = metadata?.difficulty ?? context?.problem.difficulty
  const statusTone = status === 'error' ? 'danger' : 'neutral'
  const feedbackTone = status === 'error' ? 'danger' : 'success'

  return (
    <SurfaceRoot
      asChild
      className="flex flex-col gap-[var(--cp-surface-gap)] p-[var(--cp-surface-padding)]"
      surface="overlay"
    >
      <aside aria-label="CogniPace">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
              CogniPace
            </p>
            <h1 className="mt-1 truncate text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
              {problemTitle}
            </h1>
          </div>
          <Badge tone={getDifficultyTone(difficulty)}>
            {difficulty ?? 'Unknown'}
          </Badge>
        </header>

        <div className="flex items-center gap-2 rounded-[var(--cp-panel-radius)] bg-muted p-[var(--cp-panel-padding)]">
          <Clock3 aria-hidden="true" className="size-[var(--cp-icon-size)]" />
          <TimerDisplay
            aria-label="Elapsed solve time"
            seconds={elapsedSeconds}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge>{location?.slug ?? 'No problem'}</Badge>
          {metadata?.isPremium ? <Badge tone="premium">Premium</Badge> : null}
        </div>

        <InlineStatus tone={statusTone}>
          {status === 'error' ? (
            <AlertCircle aria-hidden="true" />
          ) : (
            <CheckCircle2 aria-hidden="true" />
          )}
          <span>{formatOverlayStatus(status)}</span>
        </InlineStatus>

        {feedback ? (
          <InlineStatus tone={feedbackTone}>
            {status === 'error' ? (
              <AlertCircle aria-hidden="true" />
            ) : (
              <CheckCircle2 aria-hidden="true" />
            )}
            <span>{feedback}</span>
          </InlineStatus>
        ) : null}

        <div className="grid grid-cols-2 gap-2" aria-label="Save review result">
          {reviewRatings.map((rating) => (
            <Button
              key={rating}
              disabled={!canSave}
              onClick={() => void saveReview(rating)}
              size="sm"
              type="button"
              variant={rating === 'again' ? 'outline' : 'primary'}
            >
              {ratingLabels[rating]}
            </Button>
          ))}
        </div>
      </aside>
    </SurfaceRoot>
  )
}

function getDifficultyTone(difficulty: string | undefined): Tone {
  switch (difficulty) {
    case 'Easy':
    case 'easy':
      return 'leetcode-easy'
    case 'Medium':
    case 'medium':
      return 'leetcode-medium'
    case 'Hard':
    case 'hard':
      return 'leetcode-hard'
    default:
      return 'neutral'
  }
}

function formatOverlayStatus(status: OverlaySyncStatus) {
  switch (status) {
    case 'booting':
      return 'Starting CogniPace'
    case 'reading-page':
      return 'Reading LeetCode page'
    case 'syncing-problem':
      return 'Syncing problem'
    case 'ready':
      return 'Ready to review'
    case 'saving-review':
      return 'Saving review'
    case 'saved-review':
      return 'Review saved'
    case 'error':
      return 'Needs attention'
    default:
      return assertNever(status)
  }
}

function assertNever(value: never): never {
  void value
  throw new Error('Unhandled overlay status')
}
