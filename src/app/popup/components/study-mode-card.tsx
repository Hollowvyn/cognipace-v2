import { ChevronRight, Map } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Surface } from '@/components/ui/surface'
import type {
  AppShellProblemSummary,
  PopupControllerStatus,
  PopupStudyModeView,
} from '@/features/app-shell'

import { ScopedStatus } from './scoped-status'

type StudyModeCardProps = {
  isModeActionDisabled: boolean
  onOpenProblem: (
    problem: AppShellProblemSummary,
    scope: 'recommendation' | 'track',
  ) => void
  onOpenTracks: () => void
  onToggleStudyMode: () => void
  status: Exclude<PopupControllerStatus, null> | null
  view: PopupStudyModeView
}

type FreePracticeStudyModeView = Extract<
  PopupStudyModeView,
  { kind: 'freePractice' }
>

type StudyPlanStudyModeView = Extract<PopupStudyModeView, { kind: 'studyPlan' }>

type StudyModeStatus = Exclude<PopupControllerStatus, null> | null

export function StudyModeCard({
  isModeActionDisabled,
  onOpenProblem,
  onOpenTracks,
  onToggleStudyMode,
  status,
  view,
}: StudyModeCardProps) {
  if (view.kind === 'freePractice') {
    return (
      <FreePracticeStudyModeCard
        isModeActionDisabled={isModeActionDisabled}
        onToggleStudyMode={onToggleStudyMode}
        status={status}
        view={view}
      />
    )
  }

  return (
    <StudyPlanModeCard
      isModeActionDisabled={isModeActionDisabled}
      onOpenProblem={onOpenProblem}
      onOpenTracks={onOpenTracks}
      onToggleStudyMode={onToggleStudyMode}
      status={status}
      view={view}
    />
  )
}

function FreePracticeStudyModeCard({
  isModeActionDisabled,
  onToggleStudyMode,
  status,
  view,
}: {
  isModeActionDisabled: boolean
  onToggleStudyMode: () => void
  status: StudyModeStatus
  view: FreePracticeStudyModeView
}) {
  return (
    <StudyModeSurface titleId="popup-study-mode-title">
      <StudyModeTitleBlock
        kicker="Freestyle Mode"
        title={view.title}
        titleId="popup-study-mode-title"
      />
      <StudyModeBody>{view.body}</StudyModeBody>
      <StudyModeFooter
        isModeActionDisabled={isModeActionDisabled}
        label={view.modeActionLabel}
        onToggleStudyMode={onToggleStudyMode}
        status={status}
      />
    </StudyModeSurface>
  )
}

function StudyPlanModeCard({
  isModeActionDisabled,
  onOpenProblem,
  onOpenTracks,
  onToggleStudyMode,
  status,
  view,
}: {
  isModeActionDisabled: boolean
  onOpenProblem: (
    problem: AppShellProblemSummary,
    scope: 'recommendation' | 'track',
  ) => void
  onOpenTracks: () => void
  onToggleStudyMode: () => void
  status: StudyModeStatus
  view: StudyPlanStudyModeView
}) {
  const nextProblem = view.nextProblem

  return (
    <StudyModeSurface titleId="popup-active-track-title">
      <ActiveTrackHeader
        onOpenTracks={onOpenTracks}
        title={view.title}
        titleId="popup-active-track-title"
      />
      <StudyModeBody variant="clamped">{view.body}</StudyModeBody>
      <TrackProgressBadges
        groupTitle={view.groupTitle}
        progressPercent={view.progressPercent}
        targetStatus={view.targetStatus}
      />
      {nextProblem ? (
        <NextTrackProblem
          nextProblem={nextProblem}
          onOpenProblem={onOpenProblem}
        />
      ) : null}
      <StudyModeFooter
        isModeActionDisabled={isModeActionDisabled}
        label={view.modeActionLabel}
        onToggleStudyMode={onToggleStudyMode}
        status={status}
      />
    </StudyModeSurface>
  )
}

function StudyModeSurface({
  children,
  titleId,
}: {
  children: ReactNode
  titleId: string
}) {
  return <Surface aria-labelledby={titleId}>{children}</Surface>
}

function StudyModeTitleBlock({
  kicker,
  title,
  titleVariant = 'default',
  titleId,
}: {
  kicker: string
  title: string
  titleVariant?: 'default' | 'clamped'
  titleId: string
}) {
  const titleClassName =
    titleVariant === 'clamped'
      ? 'mt-1 line-clamp-2 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground'
      : 'mt-1 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground'

  return (
    <>
      <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
        {kicker}
      </p>
      <h2 className={titleClassName} id={titleId}>
        {title}
      </h2>
    </>
  )
}

function ActiveTrackHeader({
  onOpenTracks,
  title,
  titleId,
}: {
  onOpenTracks: () => void
  title: string
  titleId: string
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
      <div className="min-w-0 pr-1">
        <StudyModeTitleBlock
          kicker="Active Track"
          title={title}
          titleVariant="clamped"
          titleId={titleId}
        />
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
  )
}

function StudyModeBody({
  children,
  variant = 'default',
}: {
  children: ReactNode
  variant?: 'default' | 'clamped'
}) {
  const className =
    variant === 'clamped'
      ? 'mt-2 line-clamp-2 text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground'
      : 'mt-2 text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground'

  return <p className={className}>{children}</p>
}

function TrackProgressBadges({
  groupTitle,
  progressPercent,
  targetStatus,
}: {
  groupTitle: string | null
  progressPercent: number | null
  targetStatus: StudyPlanStudyModeView['targetStatus']
}) {
  if (progressPercent === null) {
    return null
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {groupTitle ? (
        <Badge tone="neutral" variant="outline">
          {groupTitle}
        </Badge>
      ) : null}
      <Badge
        aria-label={`Track progress ${progressPercent} percent complete`}
        tone="neutral"
        variant="outline"
      >
        {progressPercent}%
      </Badge>
      {targetStatus ? (
        <Badge tone={targetStatus.tone}>{targetStatus.label}</Badge>
      ) : null}
    </div>
  )
}

function NextTrackProblem({
  nextProblem,
  onOpenProblem,
}: {
  nextProblem: AppShellProblemSummary
  onOpenProblem: (
    problem: AppShellProblemSummary,
    scope: 'recommendation' | 'track',
  ) => void
}) {
  return (
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
  )
}

function StudyModeFooter({
  isModeActionDisabled,
  label,
  onToggleStudyMode,
  status,
}: {
  isModeActionDisabled: boolean
  label: string
  onToggleStudyMode: () => void
  status: StudyModeStatus
}) {
  return (
    <>
      <ScopedStatus status={status} />
      <div className="mt-3 flex items-center gap-2">
        <Button
          className="flex-1"
          disabled={isModeActionDisabled}
          onClick={onToggleStudyMode}
          variant="outline"
        >
          {label}
        </Button>
      </div>
    </>
  )
}
