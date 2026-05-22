import { Settings } from 'lucide-react'

import { IconButton } from '@/components/ui/icon-button'
import { SurfaceRoot } from '@/components/ui/surface'
import type { PopupAppShellController } from '@/features/app-shell'

import { MetricTiles } from './components/metric-tiles'
import { RecommendationCard } from './components/recommendation-card'
import { ScopedStatus } from './components/scoped-status'
import { StudyModeCard } from './components/study-mode-card'

export function PopupShell({
  controller,
}: {
  controller: PopupAppShellController
}) {
  const {
    actions,
    canShuffleRecommendation,
    canToggleStudyMode,
    data,
    isUpdatingStudyMode,
    status,
    view,
  } = controller
  const surfaceStatus = status?.scope === 'surface' ? status : null

  return (
    <SurfaceRoot
      className="flex flex-col gap-[var(--cp-surface-gap)] p-[var(--cp-surface-padding)]"
      surface="popup"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-[var(--cp-radius-md)] bg-primary text-[0.8125rem] font-extrabold leading-none text-primary-foreground"
          >
            C
          </span>
          <h1 className="m-0 truncate text-[length:var(--cp-title-font-size)] font-extrabold leading-tight text-foreground">
            CogniPace
          </h1>
        </div>
        <IconButton
          label="Open Settings"
          onClick={actions.openSettings}
          tooltip="Open Settings"
          variant="ghost"
        >
          <Settings aria-hidden="true" />
        </IconButton>
      </header>

      <ScopedStatus status={surfaceStatus} />

      <MetricTiles metrics={data.metrics} />

      <RecommendationCard
        canShuffle={canShuffleRecommendation}
        onOpenProblem={actions.openProblem}
        onShuffle={actions.shuffleRecommendation}
        status={status?.scope === 'recommendation' ? status : null}
        view={view.recommendation}
      />

      <StudyModeCard
        isModeActionDisabled={!canToggleStudyMode || isUpdatingStudyMode}
        onOpenProblem={actions.openProblem}
        onOpenTracks={actions.openTracks}
        onToggleStudyMode={actions.toggleStudyMode}
        status={status?.scope === 'track' ? status : null}
        view={view.studyMode}
      />
    </SurfaceRoot>
  )
}
