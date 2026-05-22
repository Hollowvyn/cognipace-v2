import { Pause, Play, RotateCcw } from 'lucide-react'

import { cn } from '@/utils/cn'

import { formatOverlayDuration } from '../../../domain'
import type { OverlayTimerStatus } from '../../../hooks/use-overlay-timer'
import { OverlayControlButton } from '../../shared/overlay-control-button'

type OverlayTimerCardProps = {
  elapsedSeconds: number
  isOverTarget: boolean
  targetSeconds: number
  timerStatus: OverlayTimerStatus
  onPause: () => void
  onReset: () => void
  onStart: () => void
}

export function OverlayTimerCard({
  elapsedSeconds,
  isOverTarget,
  targetSeconds,
  timerStatus,
  onPause,
  onReset,
  onStart,
}: OverlayTimerCardProps) {
  const isLocked = timerStatus === 'locked'
  const isRunning = timerStatus === 'running'
  const canReset = !isLocked && elapsedSeconds > 0
  const timerTone = isOverTarget
    ? 'text-destructive'
    : isRunning
      ? 'text-primary'
      : 'text-foreground'

  return (
    <section className="border border-border bg-card p-4" aria-label="Timer">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Elapsed Time
          </div>
          <time
            aria-label="Elapsed solve time"
            className={cn(
              'mt-3 block font-mono text-[1.65rem] font-semibold leading-none tabular-nums',
              timerTone,
            )}
            dateTime={`PT${Math.max(0, Math.floor(elapsedSeconds))}S`}
          >
            {formatOverlayDuration(elapsedSeconds)}
          </time>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <OverlayControlButton
            disabled={isLocked}
            label={isRunning ? 'Pause Timer' : 'Start Timer'}
            onClick={isRunning ? onPause : onStart}
            tone={isRunning ? 'primary' : 'neutral'}
          >
            {isRunning ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
          </OverlayControlButton>
          <OverlayControlButton
            disabled={!canReset}
            label="Reset Timer"
            onClick={onReset}
          >
            <RotateCcw className="size-4" />
          </OverlayControlButton>
        </div>
      </div>
      <div className="mt-3 text-right font-mono text-[0.75rem] text-muted-foreground">
        Target: {formatOverlayDuration(targetSeconds)}
      </div>
    </section>
  )
}
