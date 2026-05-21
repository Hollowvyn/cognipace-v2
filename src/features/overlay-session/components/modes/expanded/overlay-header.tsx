import {
  ChevronsDown,
  PanelRightClose,
  Settings,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { Tone } from '@/components/ui/types'
import type { AppShellProblemSummary } from '@/features/app-shell'

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
    <header
      className="flex min-h-14 cursor-pointer items-center gap-2 border-b border-border px-3"
      onClick={onCollapse}
    >
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

      <Badge tone={getDifficultyTone(problem?.difficulty)}>
        {formatDifficulty(problem?.difficulty)}
      </Badge>
    </header>
  )
}

function formatDifficulty(difficulty: string | null | undefined) {
  if (!difficulty) {
    return 'Unknown'
  }

  return difficulty[0]?.toUpperCase() + difficulty.slice(1)
}

function getDifficultyTone(difficulty: string | null | undefined): Tone {
  switch (difficulty) {
    case 'easy':
      return 'leetcode-easy'
    case 'medium':
      return 'leetcode-medium'
    case 'hard':
      return 'leetcode-hard'
    default:
      return 'neutral'
  }
}
