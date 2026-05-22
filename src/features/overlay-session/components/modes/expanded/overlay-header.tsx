import { ChevronsDown, PanelRightClose, Settings } from 'lucide-react'

import type { AppShellProblemSummary } from '@/features/app-shell'
import { ProblemDifficultyBadge } from '@/features/problems'

import { OverlayControlButton } from '../../shared/overlay-control-button'

type OverlayHeaderProps = {
  problem: AppShellProblemSummary | null
  title: string
  onCollapse: () => void
  onDock: () => void
  onSettings: () => void
}

export function OverlayHeader({
  problem,
  title,
  onCollapse,
  onDock,
  onSettings,
}: OverlayHeaderProps) {
  return (
    <header className="flex min-h-14 items-center gap-2 border-b border-border px-3">
      <div className="flex shrink-0 items-center gap-1">
        <OverlayControlButton
          stopClickPropagation
          label="Collapse Overlay"
          onClick={onCollapse}
        >
          <ChevronsDown className="size-4" />
        </OverlayControlButton>
        <OverlayControlButton
          stopClickPropagation
          label="Open Settings"
          onClick={onSettings}
        >
          <Settings className="size-4" />
        </OverlayControlButton>
        <OverlayControlButton
          stopClickPropagation
          label="Dock Overlay"
          onClick={onDock}
        >
          <PanelRightClose className="size-4" />
        </OverlayControlButton>
      </div>

      <h1 className="min-w-0 flex-1 truncate text-[1rem] font-semibold leading-tight text-foreground">
        {title}
      </h1>

      <ProblemDifficultyBadge difficulty={problem?.difficulty} />
    </header>
  )
}
