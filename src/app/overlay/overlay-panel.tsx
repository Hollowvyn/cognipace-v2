import {
  CheckCircle2,
  Clock3,
  Code2,
  LockKeyhole,
  Send,
  Sparkles,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { reviewRatings, type ReviewRating } from '@/lib/fsrs'

import type { LeetCodeOverlaySession } from './use-leetcode-overlay-session'

type OverlayPanelProps = LeetCodeOverlaySession

const ratingLabels = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
} as const satisfies Record<ReviewRating, string>

export function OverlayPanel({
  codeSnapshot,
  context,
  elapsedSeconds,
  feedback,
  lastSubmissionClick,
  location,
  metadata,
  saveReview,
  status,
}: OverlayPanelProps) {
  const isSaving = status === 'saving-review'
  const canSave = Boolean(context?.problem) && !isSaving
  const problemTitle =
    metadata?.title ?? context?.problem.title ?? location?.slug
  const topics = metadata?.topics ?? []
  const isPremiumProblem = metadata?.isPremium === true

  return (
    <aside className="cp-overlay-host cp-stack p-3" aria-label="CogniPace">
      <div className="cp-row">
        <div className="min-w-0">
          <p className="cp-kicker">CogniPace</p>
          <h1 className="cp-title truncate">
            {problemTitle ?? 'Reading page'}
          </h1>
        </div>
        <Badge>{metadata?.difficulty ?? 'Unknown'}</Badge>
      </div>

      <div className="cp-overlay-timer">
        <Clock3 size={16} aria-hidden="true" />
        <span>{formatElapsedTime(elapsedSeconds)}</span>
      </div>

      <div className="cp-overlay-meta">
        <Badge>{location?.slug ?? 'No problem'}</Badge>
        <Badge>{metadata?.source ?? 'waiting'}</Badge>
        {isPremiumProblem ? <Badge>Premium</Badge> : null}
        {context?.practiceStatus ? (
          <Badge>{context.practiceStatus}</Badge>
        ) : null}
      </div>

      {topics.length > 0 ? (
        <div className="cp-overlay-topic-list" aria-label="LeetCode topics">
          {topics.slice(0, 4).map((topic) => (
            <Badge key={topic.slug ?? topic.name}>{topic.name}</Badge>
          ))}
        </div>
      ) : null}

      <div className="cp-overlay-signal-grid">
        <div className="cp-overlay-signal">
          <Sparkles size={14} aria-hidden="true" />
          <span>{metadata?.confidence ?? 'low'} confidence</span>
        </div>
        <div className="cp-overlay-signal">
          <Code2 size={14} aria-hidden="true" />
          <span>
            {codeSnapshot?.language ?? codeSnapshot?.source ?? 'no code'}
          </span>
        </div>
      </div>

      {isPremiumProblem ? (
        <div className="cp-overlay-feedback">
          <LockKeyhole size={14} aria-hidden="true" />
          <span>Premium locked on LeetCode</span>
        </div>
      ) : null}

      {lastSubmissionClick ? (
        <div className="cp-overlay-feedback">
          <Send size={14} aria-hidden="true" />
          <span>
            Submit click seen at{' '}
            {formatClockTime(lastSubmissionClick.clickedAt)}
          </span>
        </div>
      ) : null}

      {feedback ? (
        <div className="cp-overlay-feedback" role="status">
          <CheckCircle2 size={14} aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      ) : null}

      <div className="cp-overlay-rating-grid" aria-label="Save review result">
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
  )
}

function formatElapsedTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatClockTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}
