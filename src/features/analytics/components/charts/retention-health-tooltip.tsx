import { Button } from '@/components/ui/button'
import { createLeetCodeProblemUrl } from '@/lib/leetcode'
import { ExternalLink, X } from 'lucide-react'
import { forwardRef, useImperativeHandle, useState } from 'react'
import type { Ref } from 'react'

import { formatDays, formatPercent } from './chart-shared'
import type { RetentionHealthPoint } from './types'

export type RetentionStatus = 'aboveTarget' | 'approaching' | 'belowTarget'

export const retentionStatusDetails: Record<
  RetentionStatus,
  { color: string; label: string }
> = {
  aboveTarget: {
    color: 'var(--cp-analytics-healthy)',
    label: 'Above target',
  },
  approaching: {
    color: 'var(--cp-analytics-attention)',
    label: 'Approaching',
  },
  belowTarget: {
    color: 'var(--cp-analytics-risk)',
    label: 'Below target',
  },
}

export function classifyRetentionStatus(
  retrievability: number,
  targetRetention: number,
): RetentionStatus {
  if (retrievability >= targetRetention) return 'aboveTarget'
  if (retrievability >= targetRetention - 0.1) return 'approaching'
  return 'belowTarget'
}

export function describeRetentionPoint(point: RetentionHealthPoint): string {
  const status = classifyRetentionStatus(
    point.retrievability,
    point.targetRetention,
  )

  return `${point.title} retention: ${formatPercent(point.retrievability)} predicted recall, ${retentionStatusDetails[status].label.toLowerCase()}, reviewed ${formatDays(point.daysSinceReview)} ago.`
}

export function RetentionHealthPreview({
  point,
}: {
  point: RetentionHealthPoint
}) {
  const status = classifyRetentionStatus(
    point.retrievability,
    point.targetRetention,
  )
  const statusDetail = retentionStatusDetails[status]

  return (
    <div
      aria-label={`${point.title} memory preview`}
      aria-live="polite"
      className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-sm rounded-[var(--cp-panel-radius)] border border-border bg-card/95 px-3 py-2 text-[length:var(--cp-badge-font-size)] shadow-overlay backdrop-blur-sm"
      role="status"
    >
      <p className="m-0 font-semibold" style={{ color: statusDetail.color }}>
        {statusDetail.label}
      </p>
      <p className="m-0 mt-1 text-muted-foreground">
        {describeRetentionPoint(point)}
      </p>
    </div>
  )
}

export type RetentionHealthPreviewHandle = {
  clear: () => void
  setFocusedSlug: (slug: string | null) => void
  setHoveredSlug: (slug: string | null) => void
}

export const RetentionHealthPreviewPanel = forwardRef<
  RetentionHealthPreviewHandle,
  { data: RetentionHealthPoint[] }
>(function RetentionHealthPreviewPanel({ data }, ref) {
  const [focusedSlug, setFocusedSlug] = useState<string | null>(null)
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)
  const previewSlug = focusedSlug ?? hoveredSlug
  const point = previewSlug
    ? (data.find((candidate) => candidate.slug === previewSlug) ?? null)
    : null

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        setFocusedSlug(null)
        setHoveredSlug(null)
      },
      setFocusedSlug,
      setHoveredSlug,
    }),
    [],
  )

  return point ? <RetentionHealthPreview point={point} /> : null
})

export function RetentionHealthTooltip({
  closeButtonRef,
  dialogRef,
  onClose,
  point,
}: {
  closeButtonRef?: Ref<HTMLButtonElement>
  dialogRef?: Ref<HTMLDivElement>
  onClose: () => void
  point: RetentionHealthPoint
}) {
  const status = classifyRetentionStatus(
    point.retrievability,
    point.targetRetention,
  )
  const statusDetail = retentionStatusDetails[status]

  return (
    <div
      aria-label={`${point.title} memory details`}
      className="absolute inset-x-3 top-3 z-10 max-w-sm rounded-[var(--cp-panel-radius)] border border-border bg-card p-3 shadow-overlay sm:left-auto sm:right-3"
      id="retention-health-details"
      ref={dialogRef}
      role="dialog"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 truncate font-semibold text-foreground">
            {point.title}
          </p>
          <p className="m-0 mt-1 text-[length:var(--cp-badge-font-size)] text-muted-foreground">
            {point.slug}
          </p>
        </div>
        <Button
          aria-label={`Close ${point.title} memory details`}
          className="shrink-0"
          onClick={onClose}
          ref={closeButtonRef}
          size="icon"
          variant="ghost"
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[length:var(--cp-badge-font-size)]">
        <div>
          <dt className="text-muted-foreground">Predicted recall</dt>
          <dd className="m-0 tabular-nums text-foreground">
            {formatPercent(point.retrievability)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Memory status</dt>
          <dd className="m-0" style={{ color: statusDetail.color }}>
            {statusDetail.label}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last review</dt>
          <dd className="m-0 tabular-nums text-foreground">
            {formatDays(point.daysSinceReview)} ago
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Stability</dt>
          <dd className="m-0 tabular-nums text-foreground">
            {formatDays(point.stabilityDays)}
          </dd>
        </div>
      </dl>

      <a
        className="mt-3 inline-flex min-w-0 items-center gap-2 text-[length:var(--cp-badge-font-size)] font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        href={createLeetCodeProblemUrl(point.slug)}
        rel="noopener noreferrer"
        target="_blank"
      >
        <ExternalLink aria-hidden="true" className="size-3.5" />
        Open {point.title} on LeetCode
      </a>
    </div>
  )
}
