import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { cn } from '@/utils/cn'

import { useSetActiveTrack } from '../api/tracks-api'
import type { SerializedTrackWorkspaceRow } from '../api/tracks-contracts'

export function OtherTracksAccordion({
  activeTrackId,
  tracks,
}: {
  activeTrackId: string | null
  tracks: readonly SerializedTrackWorkspaceRow[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setActiveTrack = useSetActiveTrack()
  const otherTracks = tracks.filter((row) => row.track.id !== activeTrackId)

  if (otherTracks.length === 0) {
    return null
  }

  async function setActive(trackId: string) {
    setError(null)

    try {
      await setActiveTrack.mutateAsync({
        surface: 'dashboard',
        trackId,
      })
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to set active track.',
      )
    }
  }

  return (
    <section className="rounded-[var(--cp-panel-radius)] border border-border bg-card text-card-foreground shadow-surface">
      <button
        aria-label={isOpen ? 'Hide other tracks' : 'Show other tracks'}
        aria-expanded={isOpen}
        className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:px-5"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="min-w-0">
          <span className="block text-[length:var(--cp-copy-font-size)] font-bold text-foreground">
            {otherTracks.length}{' '}
            {otherTracks.length === 1 ? 'other track' : 'other tracks'}
          </span>
          <span className="block text-[length:var(--cp-badge-font-size)] text-muted-foreground">
            Summary only
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2 text-[length:var(--cp-copy-font-size)] font-semibold text-primary">
          {isOpen ? 'Hide other tracks' : 'Show other tracks'}
          {isOpen ? (
            <ChevronDown aria-hidden="true" className="size-4" />
          ) : (
            <ChevronRight aria-hidden="true" className="size-4" />
          )}
        </span>
      </button>
      {isOpen ? (
        <div className="border-t border-border">
          {error ? (
            <InlineStatus className="m-4 md:m-5" role="alert" tone="danger">
              {error}
            </InlineStatus>
          ) : null}
          <div className="divide-y divide-border">
            {otherTracks.map((row) => (
              <OtherTrackRow
                key={row.track.id}
                disabled={setActiveTrack.isPending}
                onSetActive={() => {
                  void setActive(row.track.id)
                }}
                row={row}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function OtherTrackRow({
  disabled,
  onSetActive,
  row,
}: {
  disabled: boolean
  onSetActive: () => void
  row: SerializedTrackWorkspaceRow
}) {
  return (
    <div className="grid min-w-0 gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-5">
      <div className="min-w-0">
        <h3 className="m-0 truncate text-[length:var(--cp-copy-font-size)] font-bold leading-tight text-foreground">
          {row.track.title}
        </h3>
        {row.track.description ? (
          <p className="m-0 mt-1 line-clamp-2 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
            {row.track.description}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[length:var(--cp-badge-font-size)] text-muted-foreground">
          <ProgressText row={row} />
          <span>{row.progress.totalCount} problems</span>
          {row.track.dueAt ? (
            <span>Due {formatDateCell(row.track.dueAt)}</span>
          ) : null}
        </div>
      </div>
      <Button
        aria-label={`Set ${row.track.title} active`}
        disabled={disabled}
        onClick={onSetActive}
        size="sm"
        variant="outline"
      >
        Set Active
      </Button>
    </div>
  )
}

function ProgressText({ row }: { row: SerializedTrackWorkspaceRow }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular-nums">
        {row.progress.completedCount} of {row.progress.totalCount}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'h-1.5 w-16 overflow-hidden rounded-full bg-muted',
          row.progress.totalCount === 0 && 'opacity-70',
        )}
      >
        <span
          className="block h-full rounded-full bg-primary"
          style={{ width: `${row.progress.percent}%` }}
        />
      </span>
    </span>
  )
}

function formatDateCell(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}
