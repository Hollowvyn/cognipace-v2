import { ChevronRight, Map } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Surface } from '@/components/ui/surface'
import type {
  AppShellProblemSummary,
  PopupActiveTrackView,
  PopupControllerStatus,
} from '@/features/app-shell'

import { ScopedStatus } from './scoped-status'

type ActiveTrackCardProps = {
  isModeActionDisabled: boolean
  onOpenProblem: (
    problem: AppShellProblemSummary,
    scope: 'recommendation' | 'track',
  ) => void
  onOpenTracks: () => void
  onToggleStudyMode: () => void
  status: Exclude<PopupControllerStatus, null> | null
  view: PopupActiveTrackView
}

export function ActiveTrackCard({
  isModeActionDisabled,
  onOpenProblem,
  onOpenTracks,
  onToggleStudyMode,
  status,
  view,
}: ActiveTrackCardProps) {
  const nextProblem = view.nextProblem
  const dueDate = view.dueAt ? formatDueDate(view.dueAt) : null

  return (
    <Surface aria-labelledby="popup-active-track-title">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0 pr-1">
          <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            Active Track
          </p>
          <h2
            className="mt-1 line-clamp-2 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground"
            id="popup-active-track-title"
          >
            {view.title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <IconButton
            label="Open Tracks"
            onClick={onOpenTracks}
            size="sm"
            tooltip="Open Tracks"
            variant="ghost"
          >
            <Map aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
        {view.body}
      </p>

      {view.progressPercent !== null ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {view.groupTitle ? (
            <Badge tone="neutral" variant="outline">
              {view.groupTitle}
            </Badge>
          ) : null}
          <Badge
            aria-label={`Track progress ${view.progressPercent} percent complete`}
            tone="neutral"
            variant="outline"
          >
            {view.progressPercent}%
          </Badge>
          {dueDate ? <Badge tone="info">Due {dueDate}</Badge> : null}
        </div>
      ) : null}

      {nextProblem ? (
        <div className="mt-3 rounded-[var(--cp-radius-md)] border border-border bg-muted p-3">
          <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            Up Next
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[0.875rem] font-semibold leading-tight text-foreground">
              {nextProblem.title}
            </span>
            <IconButton
              className="border-border bg-transparent text-foreground hover:bg-card"
              label="Continue Track"
              onClick={() => {
                onOpenProblem(nextProblem, 'track')
              }}
              size="sm"
              tooltip="Continue Track"
              variant="outline"
            >
              <ChevronRight aria-hidden="true" />
            </IconButton>
          </div>
        </div>
      ) : null}

      <ScopedStatus status={status} />

      <div className="mt-3 flex items-center gap-2">
        <Button
          className="flex-1"
          disabled={isModeActionDisabled}
          onClick={onToggleStudyMode}
          variant="outline"
        >
          {view.modeActionLabel}
        </Button>
      </div>
    </Surface>
  )
}

function formatDueDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date)
}
