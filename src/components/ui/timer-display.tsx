import type { ComponentProps } from 'react'

import { cn } from '@/utils/cn'

export interface TimerDisplayProps extends ComponentProps<'time'> {
  seconds: number
}

export function TimerDisplay({
  className,
  seconds,
  ...props
}: TimerDisplayProps) {
  const safeSeconds = normalizeDurationSeconds(seconds)

  return (
    <time
      className={cn(
        'inline-flex min-w-[var(--cp-timer-min-width)] items-center justify-end font-mono text-[length:var(--cp-timer-font-size)] font-bold leading-none tabular-nums',
        className,
      )}
      dateTime={formatDurationDateTime(safeSeconds)}
      {...props}
    >
      {formatDuration(safeSeconds)}
    </time>
  )
}

export function formatDuration(totalSeconds: number) {
  const safeSeconds = normalizeDurationSeconds(totalSeconds)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatDurationDateTime(totalSeconds: number) {
  const safeSeconds = normalizeDurationSeconds(totalSeconds)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  return `PT${hours}H${minutes}M${seconds}S`
}

function normalizeDurationSeconds(seconds: number) {
  return Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
}
