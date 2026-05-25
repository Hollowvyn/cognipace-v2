import { CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { IconButton } from '@/components/ui/icon-button'
import { InlineStatus } from '@/components/ui/inline-status'
import { cn } from '@/utils/cn'

import { useSetActiveTrack } from '../api/tracks-api'
import type { SerializedTrackWorkspaceRow } from '../api/tracks-contracts'
import { getTrackTargetStatus } from '../domain'
import { TrackActions, type RenderTrackEditAction } from './track-actions'

export function OtherTracksAccordion({
  activeTrackId,
  generatedAt,
  newTrackAction,
  renderEditTrackAction,
  tracks,
}: {
  activeTrackId: string | null
  generatedAt: string
  newTrackAction?: ReactNode
  renderEditTrackAction: RenderTrackEditAction
  tracks: readonly SerializedTrackWorkspaceRow[]
}) {
  const [isExpandedByUser, setIsExpandedByUser] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setActiveTrack = useSetActiveTrack()
  const isForcedOpen = activeTrackId === null
  const isOpen = isForcedOpen || isExpandedByUser

  if (tracks.length === 0 && !newTrackAction) {
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
    <section
      aria-label="All tracks"
      className="rounded-[var(--cp-panel-radius)] border border-border bg-card text-card-foreground shadow-surface"
    >
      <div className="grid min-w-0 gap-3 px-4 py-3 md:flex md:items-center md:justify-between md:px-5">
        <span className="min-w-0">
          <span className="block text-[length:var(--cp-copy-font-size)] font-bold text-foreground">
            All tracks
          </span>
          {tracks.length > 0 ? (
            <span className="block text-[length:var(--cp-badge-font-size)] text-muted-foreground">
              {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
            </span>
          ) : null}
        </span>
        <div
          aria-label="All tracks actions"
          className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end"
        >
          {newTrackAction}
          {tracks.length > 0 ? (
            <IconButton
              aria-expanded={isOpen}
              disabled={isForcedOpen}
              label={
                isForcedOpen
                  ? 'All tracks shown'
                  : isOpen
                    ? 'Hide all tracks'
                    : 'Show all tracks'
              }
              onClick={() => setIsExpandedByUser((current) => !current)}
              tooltip={
                isForcedOpen
                  ? 'All tracks shown'
                  : isOpen
                    ? 'Hide all tracks'
                    : 'Show all tracks'
              }
              variant="ghost"
            >
              {isOpen ? (
                <ChevronUp aria-hidden="true" />
              ) : (
                <ChevronDown aria-hidden="true" />
              )}
            </IconButton>
          ) : null}
        </div>
      </div>
      {isOpen ? (
        <div className="border-t border-border">
          {error ? (
            <InlineStatus className="m-4 md:m-5" role="alert" tone="danger">
              {error}
            </InlineStatus>
          ) : null}
          <div className="divide-y divide-border">
            {tracks.map((row) => (
              <OtherTrackRow
                key={row.track.id}
                disabled={setActiveTrack.isPending}
                isActive={row.track.id === activeTrackId}
                onSetActive={() => {
                  void setActive(row.track.id)
                }}
                generatedAt={generatedAt}
                renderEditTrackAction={renderEditTrackAction}
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
  generatedAt,
  isActive,
  onSetActive,
  renderEditTrackAction,
  row,
}: {
  disabled: boolean
  generatedAt: string
  isActive: boolean
  onSetActive: () => void
  renderEditTrackAction: RenderTrackEditAction
  row: SerializedTrackWorkspaceRow
}) {
  const targetStatus = getTrackTargetStatus({
    dueAt: row.track.dueAt,
    generatedAt,
    progress: row.progress,
  })

  return (
    <div className="grid min-w-0 gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-5">
      <div className="min-w-0">
        <h3 className="m-0 flex min-w-0 items-center gap-2 text-[length:var(--cp-copy-font-size)] font-bold leading-tight text-foreground">
          <span className="min-w-0 truncate">{row.track.title}</span>
          {isActive ? (
            <Badge className="shrink-0" tone="success" variant="outline">
              Active
            </Badge>
          ) : null}
        </h3>
        {row.track.description ? (
          <p className="m-0 mt-1 line-clamp-2 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
            {row.track.description}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[length:var(--cp-badge-font-size)] text-muted-foreground">
          <ProgressText row={row} title={row.track.title} />
          <span>{row.progress.totalCount} problems</span>
          {targetStatus.catalogLabel ? (
            <span
              className={cn(
                targetStatus.tone === 'danger' && 'text-destructive',
              )}
              data-cp-tone={
                targetStatus.tone === 'danger' ? 'danger' : undefined
              }
            >
              {targetStatus.catalogLabel}
            </span>
          ) : null}
        </div>
      </div>
      <TrackActions
        ariaLabel={`${row.track.title} catalog actions`}
        className="justify-start md:justify-end"
        renderEditTrackAction={renderEditTrackAction}
        setActiveAction={
          isActive ? null : (
            <IconButton
              disabled={disabled}
              label={`Set ${row.track.title} active`}
              onClick={onSetActive}
              tooltip="Set active"
              variant="ghost"
            >
              <CheckCircle2 aria-hidden="true" />
            </IconButton>
          )
        }
        showClearActive={isActive}
        track={row.track}
      />
    </div>
  )
}

function ProgressText({
  row,
  title,
}: {
  row: SerializedTrackWorkspaceRow
  title: string
}) {
  return (
    <span
      aria-label={`${title} progress: ${row.progress.completedCount} of ${row.progress.totalCount}`}
      className="inline-flex items-center gap-2"
    >
      <TinyProgressRing percent={row.progress.percent} />
      <span className="tabular-nums">
        {row.progress.completedCount} of {row.progress.totalCount}
      </span>
    </span>
  )
}

function TinyProgressRing({ percent }: { percent: number }) {
  const clampedPercent = Math.max(0, Math.min(percent, 100))

  return (
    <span
      aria-hidden="true"
      className="grid size-3 shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(var(--cp-color-primary) ${clampedPercent}%, var(--cp-color-muted) 0)`,
      }}
    >
      <span className="block size-1.5 rounded-full bg-card" />
    </span>
  )
}
