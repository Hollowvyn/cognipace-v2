import { PanelRightOpen } from 'lucide-react'

import { SurfaceRoot } from '@/components/ui/surface'
import type { ThemeMode } from '@/features/settings'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { useDockedOverlayDrag } from './use-docked-overlay-drag'

type DockedOverlayProps = {
  onRestore: () => void
  themeMode: ThemeMode
}

export function DockedOverlay({ onRestore, themeMode }: DockedOverlayProps) {
  const drag = useDockedOverlayDrag()

  return (
    <SurfaceRoot
      asChild
      data-cp-overlay-mode="docked"
      style={{ transform: `translateY(${drag.dockOffsetY}px)` }}
      surface="overlay"
      theme={themeMode}
    >
      <aside aria-label="CogniPace docked overlay">
        <TooltipProvider delayDuration={250}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label="Show Overlay"
                className="flex h-full w-full touch-none select-none items-center justify-center bg-card text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={() => {
                  if (drag.shouldSuppressRestoreClick()) {
                    return
                  }

                  onRestore()
                }}
                onPointerCancel={drag.handlePointerCancel}
                onPointerDown={drag.handlePointerDown}
                onPointerMove={drag.handlePointerMove}
                onPointerUp={drag.handlePointerUp}
                type="button"
              >
                <PanelRightOpen aria-hidden="true" className="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Show Overlay</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </aside>
    </SurfaceRoot>
  )
}
