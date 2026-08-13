import type { ChartConfig } from '@/components/ui/chart'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
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
  const [pinnedPoint, setPinnedPoint] = useState<RetentionHealthPoint | null>(
    null,
  )
  const chartRegionRef = useRef<HTMLDivElement>(null)
  const pinnedPointRef = useRef<RetentionHealthPoint | null>(null)
  const previewRef = useRef<RetentionHealthPreviewHandle>(null)

  function clearPreview() {
    if (!pinnedPointRef.current) {
      previewRef.current?.clear()
    }
  }

  function showPreview(point: RetentionHealthPoint) {
    if (!pinnedPointRef.current) {
      previewRef.current?.show(point)
    }
  }

  function dismissPinnedPoint() {
    pinnedPointRef.current = null
    setPinnedPoint(null)
    previewRef.current?.clear()
  }

  function pinPoint(point: RetentionHealthPoint) {
    pinnedPointRef.current = point
    previewRef.current?.clear()
    setPinnedPoint(point)
  }

  useEffect(() => {
    if (!pinnedPoint) return

    function closeIfOutside(event: PointerEvent) {
      const target = event.target

      if (target instanceof Node && !chartRegionRef.current?.contains(target)) {
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
        aria-expanded={pinnedPoint?.slug === point.slug}
        aria-haspopup="dialog"
        aria-label={label}
        className="cursor-pointer focus-visible:[&>circle:first-of-type]:stroke-2 focus-visible:[&>circle:first-of-type]:stroke-ring"
        onBlur={clearPreview}
        onClick={() => pinPoint(point)}
        onFocus={() => showPreview(point)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            pinPoint(point)
          }
        }}
        onMouseEnter={() => showPreview(point)}
        onMouseLeave={clearPreview}
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
          <ChartTooltip
            content={
              <ChartTooltipContent
                active={false}
                formatter={(value, name) => [
                  name === 'daysSinceReview'
                    ? `${String(value)} days`
                    : formatPercent(typeof value === 'number' ? value : null),
                  name === 'daysSinceReview'
                    ? 'Days since review'
                    : 'Retrievability',
                ]}
                payload={[]}
              />
            }
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
      <RetentionHealthPreviewPanel ref={previewRef} />
      {pinnedPoint ? (
        <RetentionHealthTooltip
          onClose={dismissPinnedPoint}
          point={pinnedPoint}
        />
      ) : null}
    </div>
  )
}
