import {
  CalendarClock,
  CheckCircle2,
  ListChecks,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'
import { createLeetCodeProblemUrl } from '@/lib/leetcode'
import { cn } from '@/utils/cn'

import {
  useDeleteTrack,
  useResetTrackProgress,
  useSetActiveGroup,
} from '../api/tracks-api'
import type {
  SerializedActiveTrack,
  SerializedTrack,
  SerializedTrackGroup,
  TrackProblemRow,
} from '../api/tracks-contracts'
import { TrackConfirmationDialog } from './track-confirmation-dialog'
import { TrackProblemTable } from './track-problem-table'
import type { RenderProblemEditAction } from '@/features/problems'

export type RenderTrackEditAction = (track: SerializedTrack) => ReactNode

export function ActiveTrackWorkspace({
  activeTrack,
  groups,
  renderEditProblemAction,
  renderEditTrackAction,
  rows,
  dueCount,
}: {
  activeTrack: NonNullable<SerializedActiveTrack>
  dueCount: number
  groups: readonly SerializedTrackGroup[]
  renderEditProblemAction: RenderProblemEditAction
  renderEditTrackAction: RenderTrackEditAction
  rows: readonly TrackProblemRow[]
}) {
  const activeGroupId = activeTrack.activeGroup?.id ?? groups[0]?.id ?? null
  const activeRows = activeGroupId
    ? rows.filter((row) => row.membership.groupId === activeGroupId)
    : rows

  return (
    <Surface className="grid w-full overflow-hidden p-0">
      <ActiveTrackHeader
        activeTrack={activeTrack}
        dueCount={dueCount}
        renderEditTrackAction={renderEditTrackAction}
      />
      <ActiveTrackGroups
        activeGroupId={activeGroupId}
        groups={groups}
        trackId={activeTrack.track.id}
      />
      {groups.length === 0 ? (
        <div className="border-t border-border px-4 py-5 md:px-5">
          <InlineStatus>No groups in this track.</InlineStatus>
        </div>
      ) : (
        <TrackProblemTable
          renderEditProblemAction={renderEditProblemAction}
          rows={activeRows}
        />
      )}
    </Surface>
  )
}

function ActiveTrackHeader({
  activeTrack,
  dueCount,
  renderEditTrackAction,
}: {
  activeTrack: NonNullable<SerializedActiveTrack>
  dueCount: number
  renderEditTrackAction: RenderTrackEditAction
}) {
  const [confirmation, setConfirmation] = useState<
    'delete' | 'reset-progress' | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const deleteTrack = useDeleteTrack()
  const resetProgress = useResetTrackProgress()
  const isPending = deleteTrack.isPending || resetProgress.isPending

  async function runAction(action: () => Promise<unknown>) {
    setError(null)

    try {
      await action()
      setConfirmation(null)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Track action failed.',
      )
    }
  }

  function openConfirmation(nextConfirmation: 'delete' | 'reset-progress') {
    setError(null)
    setConfirmation(nextConfirmation)
  }

  function closeConfirmation() {
    setError(null)
    setConfirmation(null)
  }

  return (
    <div className="grid gap-4 px-4 pb-4 pt-4 md:px-5 lg:px-7 lg:py-5">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <h2 className="m-0 break-words text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
            {activeTrack.track.title}
          </h2>
          {activeTrack.track.description ? (
            <p className="m-0 mt-2 max-w-3xl break-words text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
              {activeTrack.track.description}
            </p>
          ) : null}
          {activeTrack.track.dueAt ? (
            <p className="m-0 mt-2 text-[length:var(--cp-badge-font-size)] font-semibold text-muted-foreground">
              Due {formatDateCell(activeTrack.track.dueAt)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-start gap-2 md:justify-end">
          {renderEditTrackAction(activeTrack.track)}
          <Button
            disabled={isPending}
            onClick={() => openConfirmation('reset-progress')}
            size="sm"
            variant="ghost"
          >
            <RefreshCw aria-hidden="true" />
            Reset Progress
          </Button>
          <Button
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={isPending}
            onClick={() => openConfirmation('delete')}
            size="sm"
            variant="ghost"
          >
            <Trash2 aria-hidden="true" />
            Delete Track
          </Button>
        </div>
      </div>
      <div className="grid gap-3 border-y border-border py-3 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border">
        <MetricBlock
          ariaLabel="Progress metric"
          icon={<CheckCircle2 aria-hidden="true" />}
          label="Progress"
          value={
            <span className="inline-flex min-w-0 items-baseline gap-2">
              <span className="tabular-nums">
                {activeTrack.progress.completedCount} of{' '}
                {activeTrack.progress.totalCount}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {activeTrack.progress.percent}%
              </span>
            </span>
          }
        />
        <MetricBlock
          ariaLabel="Due metric"
          icon={<CalendarClock aria-hidden="true" />}
          label="Due Reviews"
          value={<span className="tabular-nums">{dueCount}</span>}
        />
        <MetricBlock
          ariaLabel="Next metric"
          icon={<ListChecks aria-hidden="true" />}
          label="Next"
          value={
            activeTrack.nextProblem ? (
              <a
                className="truncate font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                href={createLeetCodeProblemUrl(activeTrack.nextProblem.slug)}
                rel="noreferrer"
                target="_blank"
              >
                {activeTrack.nextProblem.title}
              </a>
            ) : (
              <span className="text-muted-foreground">None</span>
            )
          }
        />
      </div>
      {confirmation === 'reset-progress' ? (
        <TrackConfirmationDialog
          confirmLabel="Reset Progress"
          description="This clears completed progress for this track."
          error={error}
          onCancel={closeConfirmation}
          onConfirm={() => {
            void runAction(() =>
              resetProgress.mutateAsync({
                surface: 'dashboard',
                trackId: activeTrack.track.id,
              }),
            )
          }}
          pending={isPending}
          title="Reset track progress?"
        />
      ) : null}
      {confirmation === 'delete' ? (
        <TrackConfirmationDialog
          confirmLabel="Delete Track"
          description="This permanently deletes this track and its groups."
          error={error}
          onCancel={closeConfirmation}
          onConfirm={() => {
            void runAction(() =>
              deleteTrack.mutateAsync({
                surface: 'dashboard',
                trackId: activeTrack.track.id,
              }),
            )
          }}
          pending={isPending}
          title="Delete track?"
        />
      ) : null}
    </div>
  )
}

function ActiveTrackGroups({
  activeGroupId,
  groups,
  trackId,
}: {
  activeGroupId: string | null
  groups: readonly SerializedTrackGroup[]
  trackId: string
}) {
  const setActiveGroup = useSetActiveGroup()
  const [error, setError] = useState<string | null>(null)

  if (groups.length <= 1) {
    return null
  }

  async function selectGroup(groupId: string) {
    if (groupId === activeGroupId) {
      return
    }

    setError(null)

    try {
      await setActiveGroup.mutateAsync({
        groupId,
        surface: 'dashboard',
        trackId,
      })
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to change active group.',
      )
    }
  }

  return (
    <div className="border-t border-border px-4 py-3 md:px-5 lg:px-7">
      {error ? (
        <InlineStatus className="mb-3" role="alert" tone="danger">
          {error}
        </InlineStatus>
      ) : null}
      <div
        aria-label="Track groups"
        className="flex min-w-0 flex-wrap gap-2"
        role="group"
      >
        {groups.map((group) => {
          const isActive = group.id === activeGroupId

          return (
            <button
              aria-pressed={isActive}
              className={cn(
                'inline-flex max-w-full min-w-0 items-center rounded-[var(--cp-control-radius)] border px-3 py-2 text-[length:var(--cp-control-font-size)] font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-card-foreground hover:bg-muted',
              )}
              disabled={setActiveGroup.isPending}
              key={group.id}
              onClick={() => {
                void selectGroup(group.id)
              }}
              type="button"
            >
              <span className="min-w-0 max-w-full truncate">
                {group.title}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MetricBlock({
  ariaLabel,
  icon,
  label,
  value,
}: {
  ariaLabel: string
  icon: ReactNode
  label: string
  value: ReactNode
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="grid min-w-0 gap-1 sm:px-3 sm:first:pl-0"
    >
      <div className="flex min-w-0 items-center gap-1.5 text-[length:var(--cp-badge-font-size)] font-bold uppercase text-muted-foreground">
        <span className="[&_svg]:size-3.5">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="min-w-0 truncate text-[length:var(--cp-copy-font-size)] font-bold text-foreground">
        {value}
      </div>
    </div>
  )
}

function formatDateCell(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(value))
}
