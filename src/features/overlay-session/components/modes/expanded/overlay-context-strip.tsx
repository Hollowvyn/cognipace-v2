import type { OverlayAppShellData } from '@/features/app-shell'

import { formatOverlayDateTime } from '../../../domain'

type OverlayContextStripProps = {
  context: OverlayAppShellData['overlay'] | null
  isSubmitted: boolean
}

export function OverlayContextStrip({
  context,
  isSubmitted,
}: OverlayContextStripProps) {
  const practice = context?.practice
  const sessionLabel = practice?.isStarted ? 'RECALL' : 'FIRST SOLVE'
  const stateLabel = practice?.isStarted
    ? formatPracticePhaseLabel(practice.phase)
    : isSubmitted
      ? 'SAVED'
      : 'NEW PROBLEM'

  return (
    <div className="flex min-h-10 items-center border-b border-border bg-muted px-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      <div className="min-w-0 truncate">
        <span>{sessionLabel}</span>
        <span className="mx-2 text-border">|</span>
        <span>{stateLabel}</span>
      </div>
    </div>
  )
}

export function OverlaySubmissionSummary({
  context,
}: {
  context: OverlayAppShellData['overlay'] | null
}) {
  const practice = context?.practice
  const lastSubmittedAt =
    practice?.latestAttempt?.reviewedAt ?? practice?.lastReviewedAt ?? null
  const nextReviewAt = practice?.dueAt ?? null
  const hasSubmission = Boolean(practice?.isStarted || lastSubmittedAt)

  if (!hasSubmission) {
    return (
      <section
        aria-label="Submission status"
        className="border border-border bg-card px-4 py-3"
      >
        <div className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          No submissions yet
        </div>
        <p className="m-0 mt-1 text-[0.95rem] font-semibold leading-snug text-foreground">
          After first submission
        </p>
      </section>
    )
  }

  return (
    <section
      aria-label="Submission status"
      className="grid grid-cols-2 gap-2 text-[0.72rem]"
    >
      <SubmissionStatusCard
        label="Last submitted"
        value={formatOverlayDateTime(lastSubmittedAt)}
      />
      <SubmissionStatusCard
        label="Next due"
        value={formatOverlayDateTime(nextReviewAt)}
        tone={
          practice?.isOverdue ? 'danger' : practice?.isDue ? 'warning' : 'neutral'
        }
      />
    </section>
  )
}

function SubmissionStatusCard({
  label,
  tone = 'neutral',
  value,
}: {
  label: string
  tone?: 'neutral' | 'warning' | 'danger'
  value: string
}) {
  const toneClassName = {
    neutral: 'text-foreground',
    warning: 'text-[color:var(--cp-tone-warning-fg)]',
    danger: 'text-destructive',
  }[tone]

  return (
    <div className="min-w-0 border border-border bg-card px-3 py-2">
      <div className="truncate font-mono uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 truncate font-semibold ${toneClassName}`}>
        {value}
      </div>
    </div>
  )
}

function formatPracticePhaseLabel(phase: string) {
  return phase.replace('-', ' ').toUpperCase()
}
