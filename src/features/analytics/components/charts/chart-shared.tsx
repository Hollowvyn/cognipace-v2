import type { ReactNode } from 'react'

import { InlineStatus } from '@/components/ui/inline-status'
import { cn } from '@/utils/cn'
import { formatDateTime } from '@/utils/date-format'

import type { AnalyticsLegendItem } from './types'

export const chartDimension = { height: 288, width: 640 } as const

export const DASHED_LINE_EVIDENCE_LABEL =
  'Dashed line crosses a period with no eligible evidence.'

export function AnalyticsChartLegendItem({
  item,
}: {
  item: AnalyticsLegendItem
}) {
  return (
    <span className="inline-flex items-center gap-1.5" role="listitem">
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 rounded-[2px]"
        style={{ backgroundColor: item.color }}
      />
      <span>{item.label}</span>
      {item.note ? (
        <span className="text-muted-foreground">{item.note}</span>
      ) : null}
    </span>
  )
}

const dateLabelFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

export function formatChartDate(value: string): string {
  return dateLabelFormatter.format(new Date(`${value}T00:00:00.000Z`))
}

export function toChartLabel(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : ''
}

export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined
    ? '—'
    : `${Math.round(value * 100)}%`
}

export function formatPercentagePoints(
  value: number | null | undefined,
): string {
  return value === null || value === undefined
    ? '—'
    : `${Math.round(value * 100)} points`
}

export function formatDays(value: number | null | undefined): string {
  return value === null || value === undefined
    ? '—'
    : `${value.toFixed(value >= 10 ? 0 : 1)}d`
}

export function formatHistoryBoundary(value: string | null): string {
  return value === null
    ? 'No historical snapshots yet.'
    : `History since ${formatDateTime(value)}`
}

export function ChartEmptyState({
  className,
  message,
  detail,
}: {
  className?: string
  message: string
  detail?: ReactNode
}) {
  return (
    <div
      aria-label={message}
      className={cn(
        'grid min-h-48 place-items-center rounded-[var(--cp-control-radius)] border border-dashed border-border px-4 text-center',
        className,
      )}
      role="status"
    >
      <div className="grid max-w-md gap-1">
        <InlineStatus>{message}</InlineStatus>
        {detail ? (
          <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function hasNumericValue(value: number | null): value is number {
  return value !== null && Number.isFinite(value)
}
