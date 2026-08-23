import type { ChartConfig } from '@/components/ui/chart'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import {
  CartesianGrid,
  ReferenceLine,
  Scatter,
  ScatterChart,
  type ScatterShapeProps,
  XAxis,
  YAxis,
} from 'recharts'
import { useEffect, useRef, useState } from 'react'

import { ChartEmptyState, chartDimension, formatPercent } from './chart-shared'
import type { RetentionHealthPoint } from './types'
import {
  classifyRetentionStatus,
  describeRetentionPoint,
  RetentionHealthPreviewPanel,
  RetentionHealthTooltip,
  type RetentionHealthPreviewHandle,
  retentionStatusDetails,
  type RetentionStatus,
} from './retention-health-tooltip'

const retentionHealthChartConfig = {
  aboveTarget: {
    label: retentionStatusDetails.aboveTarget.label,
    color: retentionStatusDetails.aboveTarget.color,
  },
  approaching: {
    label: retentionStatusDetails.approaching.label,
    color: retentionStatusDetails.approaching.color,
  },
  belowTarget: {
    label: retentionStatusDetails.belowTarget.label,
    color: retentionStatusDetails.belowTarget.color,
  },
} satisfies ChartConfig

export function RetentionHealthChart({
  data,
  targetRetention,
}: {
  data: RetentionHealthPoint[]
  targetRetention: number
}) {
  const [pinnedSlug, setPinnedSlug] = useState<string | null>(null)
  const chartRegionRef = useRef<HTMLDivElement>(null)
  const dialogCloseButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const originTriggerRef = useRef<SVGGElement | null>(null)
  const originTriggerSlugRef = useRef<string | null>(null)
  const pinnedSlugRef = useRef<string | null>(null)
  const previewRef = useRef<RetentionHealthPreviewHandle>(null)
  const restoreFocusRef = useRef<SVGGElement | null>(null)
  const restoreFocusSlugRef = useRef<string | null>(null)
  const suppressNextPreviewRef = useRef(false)
  const pinnedPoint = pinnedSlug
    ? (data.find((point) => point.slug === pinnedSlug) ?? null)
    : null

  function setHoveredSlug(slug: string | null) {
    if (!pinnedSlugRef.current) {
      previewRef.current?.setHoveredSlug(slug)
    }
  }

  function setFocusedSlug(slug: string | null) {
    if (!pinnedSlugRef.current) {
      previewRef.current?.setFocusedSlug(slug)
    }
  }

  function dismissPinnedPoint() {
    restoreFocusRef.current = originTriggerRef.current
    restoreFocusSlugRef.current = originTriggerSlugRef.current
    originTriggerRef.current = null
    originTriggerSlugRef.current = null
    pinnedSlugRef.current = null
    setPinnedSlug(null)
    previewRef.current?.clear()
  }

  function pinPoint(slug: string, trigger: SVGGElement) {
    originTriggerRef.current = trigger
    originTriggerSlugRef.current = slug
    restoreFocusRef.current = null
    restoreFocusSlugRef.current = null
    pinnedSlugRef.current = slug
    previewRef.current?.clear()
    setPinnedSlug(slug)
  }

  useEffect(() => {
    if (pinnedSlug && !pinnedPoint) {
      originTriggerRef.current = null
      originTriggerSlugRef.current = null
      restoreFocusRef.current = null
      restoreFocusSlugRef.current = null
      pinnedSlugRef.current = null
      previewRef.current?.clear()
      queueMicrotask(() => {
        setPinnedSlug((currentSlug) =>
          currentSlug === pinnedSlug ? null : currentSlug,
        )
      })
    }
  }, [pinnedPoint, pinnedSlug])

  useEffect(() => {
    if (pinnedSlug) {
      const focusTimer = window.setTimeout(() => {
        dialogCloseButtonRef.current?.focus()
      }, 0)

      return () => {
        window.clearTimeout(focusTimer)
      }
    }

    const storedTrigger = restoreFocusRef.current
    const slug = restoreFocusSlugRef.current
    restoreFocusRef.current = null
    restoreFocusSlugRef.current = null

    if (!storedTrigger && !slug) return

    const focusTimer = window.setTimeout(() => {
      const trigger = slug
        ? chartRegionRef.current?.querySelector<SVGGElement>(
            `[data-retention-trigger-slug="${slug}"]`,
          )
        : storedTrigger?.isConnected
          ? storedTrigger
          : null

      if (trigger) {
        suppressNextPreviewRef.current = true
        trigger.focus()
      }
    }, 0)

    return () => {
      window.clearTimeout(focusTimer)
    }
  }, [pinnedSlug])

  useEffect(() => {
    if (!pinnedPoint) return

    function closeIfOutside(event: PointerEvent) {
      const target = event.target

      if (target instanceof Node && !dialogRef.current?.contains(target)) {
        dismissPinnedPoint()
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        dismissPinnedPoint()
      }
    }

    document.addEventListener('pointerdown', closeIfOutside, true)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('pointerdown', closeIfOutside, true)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [pinnedPoint])

  if (data.length === 0) {
    return (
      <ChartEmptyState
        detail="Reviewed cards will appear here with their current FSRS retrievability and distance from target."
        message="No retention health data yet."
      />
    )
  }

  const grouped = data.reduce<Record<RetentionStatus, RetentionHealthPoint[]>>(
    (groups, point) => {
      groups[
        classifyRetentionStatus(point.retrievability, point.targetRetention)
      ].push(point)
      return groups
    },
    { aboveTarget: [], approaching: [], belowTarget: [] },
  )

  const summary = (Object.keys(grouped) as RetentionStatus[]).map((status) => ({
    count: grouped[status].length,
    status,
  }))

  function renderPoint({
    cx,
    cy,
    fill,
    payload,
  }: ScatterShapeProps & { fill?: string | undefined }) {
    const point = payload as RetentionHealthPoint | undefined

    if (cx === undefined || cy === undefined || point === undefined) {
      return null
    }

    const label = describeRetentionPoint(point)

    return (
      <g
        aria-controls="retention-health-details"
        aria-expanded={pinnedSlug === point.slug}
        aria-haspopup="dialog"
        aria-label={label}
        className="cursor-pointer focus-visible:[&>circle:first-of-type]:stroke-2 focus-visible:[&>circle:first-of-type]:stroke-ring"
        data-retention-trigger-slug={point.slug}
        onBlur={() => setFocusedSlug(null)}
        onClick={(event) => pinPoint(point.slug, event.currentTarget)}
        onFocus={() => {
          if (suppressNextPreviewRef.current) {
            suppressNextPreviewRef.current = false
            return
          }

          setFocusedSlug(point.slug)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            pinPoint(point.slug, event.currentTarget)
          }
        }}
        onMouseEnter={() => setHoveredSlug(point.slug)}
        onMouseLeave={() => setHoveredSlug(null)}
        ref={(element) => {
          if (element && pinnedSlugRef.current === point.slug) {
            originTriggerRef.current = element
          }
        }}
        role="button"
        tabIndex={0}
      >
        <title>{label}</title>
        <circle cx={cx} cy={cy} fill={fill} r={6} />
        <circle cx={cx} cy={cy} fill="transparent" r={12} />
      </g>
    )
  }

  return (
    <div className="relative" ref={chartRegionRef}>
      <dl className="mb-3 grid grid-cols-3 gap-2">
        {summary.map(({ count, status }) => (
          <div className="min-w-0" key={status}>
            <dt className="text-[length:var(--cp-badge-font-size)] text-muted-foreground">
              {retentionStatusDetails[status].label}
            </dt>
            <dd
              className="m-0 text-lg font-semibold tabular-nums"
              style={{ color: retentionStatusDetails[status].color }}
            >
              {count}
            </dd>
          </div>
        ))}
      </dl>
      <ChartContainer
        accessibleDescription={`Each point is a reviewed problem plotted by days since review and predicted retrievability. The target is ${formatPercent(targetRetention)}.`}
        accessibleName="Retention health chart"
        aria-label="Retention health chart"
        aria-roledescription="interactive scatter plot"
        className="aspect-auto h-72 min-h-[18rem]"
        config={retentionHealthChartConfig}
        initialDimension={chartDimension}
        role="group"
      >
        <ScatterChart
          accessibilityLayer
          margin={{ bottom: 4, left: 0, right: 8, top: 8 }}
        >
          <CartesianGrid stroke="var(--color-border)" />
          <XAxis
            allowDecimals={false}
            axisLine={false}
            dataKey="daysSinceReview"
            label={{
              value: 'Days since review',
              position: 'insideBottom',
              offset: -2,
            }}
            tickLine={false}
            type="number"
            width={42}
          />
          <YAxis
            axisLine={false}
            domain={[0, 1]}
            tickFormatter={formatPercent}
            tickLine={false}
            width={42}
          />
          <ReferenceLine
            label={{
              fill: 'var(--chart-2)',
              fontSize: 11,
              position: 'insideTopRight',
              value: `Target ${formatPercent(targetRetention)}`,
            }}
            stroke="var(--chart-2)"
            strokeDasharray="5 5"
            y={targetRetention}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Scatter
            data={grouped.aboveTarget}
            dataKey="retrievability"
            fill="var(--color-aboveTarget)"
            isAnimationActive={false}
            name="Above target"
            shape={renderPoint}
          />
          <Scatter
            data={grouped.approaching}
            dataKey="retrievability"
            fill="var(--color-approaching)"
            isAnimationActive={false}
            name="Approaching"
            shape={renderPoint}
          />
          <Scatter
            data={grouped.belowTarget}
            dataKey="retrievability"
            fill="var(--color-belowTarget)"
            isAnimationActive={false}
            name="Below target"
            shape={renderPoint}
          />
        </ScatterChart>
      </ChartContainer>
      <RetentionHealthPreviewPanel data={data} ref={previewRef} />
      {pinnedPoint ? (
        <RetentionHealthTooltip
          closeButtonRef={dialogCloseButtonRef}
          dialogRef={dialogRef}
          onClose={dismissPinnedPoint}
          point={pinnedPoint}
        />
      ) : null}
    </div>
  )
}
