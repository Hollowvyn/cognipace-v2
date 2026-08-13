import type { ChartConfig } from '@/components/ui/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { CartesianGrid, LineChart, XAxis, YAxis } from 'recharts'

import {
  DASHED_LINE_EVIDENCE_LABEL,
  ChartTrendNote,
  ChartEmptyState,
  chartDimension,
  formatBucketLabel,
  formatDays,
  getMaximumLineBridgeGap,
  toChartLabel,
} from './chart-shared'
import { analyticsChartDefinitions } from './chart-definitions'
import { LineSegments } from './line-segments'
import type { StabilityPoint } from './types'

const memoryStrengthDefinition = analyticsChartDefinitions.memoryStrength
const [stabilitySeries] = memoryStrengthDefinition.series

const memoryStrengthChartConfig = {
  medianStabilityDays: {
    label: stabilitySeries.label,
    color: stabilitySeries.color,
  },
} satisfies ChartConfig

function hasDashedBridge(data: readonly StabilityPoint[]): boolean {
  let lastValueIndex: number | null = null

  return data.some((point, index) => {
    if (point.medianStabilityDays === null) return false
    const gap = lastValueIndex === null ? 0 : index - lastValueIndex - 1
    lastValueIndex = index
    return gap > 0
  })
}

export function MemoryStrengthChart({ data }: { data: StabilityPoint[] }) {
  const hasValues = data.some((point) => point.medianStabilityDays !== null)
  const trendPointCount = data.filter(
    (point) => point.medianStabilityDays !== null,
  ).length

  if (!hasValues) {
    return (
      <ChartEmptyState
        detail="FSRS stability becomes useful here after review logs provide a reliable interval history."
        message="No memory strength trend available yet."
      />
    )
  }

  return (
    <div
      className="grid min-w-0 gap-3"
      data-chart-definition={memoryStrengthDefinition.id}
      data-testid={`analytics-chart-${memoryStrengthDefinition.id}`}
    >
      <ChartContainer
        accessibleDescription={memoryStrengthDefinition.metricMeaning}
        accessibleName={`${memoryStrengthDefinition.title} chart`}
        aria-label={`${memoryStrengthDefinition.title} chart`}
        aria-roledescription="line chart"
        className="aspect-auto h-64 min-h-[16rem]"
        config={memoryStrengthChartConfig}
        initialDimension={chartDimension}
        role="img"
      >
        <LineChart
          accessibilityLayer
          data={data}
          margin={{ bottom: 4, left: 0, right: 8, top: 8 }}
        >
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="bucketStart"
            minTickGap={32}
            tickFormatter={(value) => {
              const point = data.find((item) => item.bucketStart === value)
              return point
                ? formatBucketLabel(point.bucketStart, point.bucketEnd)
                : toChartLabel(value)
            }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tickFormatter={formatDays}
            tickLine={false}
            width={42}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                active={false}
                formatter={(value, _name, item) => {
                  const point = item.payload as StabilityPoint
                  return [
                    `${formatDays(typeof value === 'number' ? value : null)} · ${point.sampleSize} stability sample${point.sampleSize === 1 ? '' : 's'}`,
                    stabilitySeries.label,
                  ]
                }}
                labelFormatter={(label, payload) => {
                  const point = payload?.[0]?.payload as
                    | StabilityPoint
                    | undefined
                  return point
                    ? formatBucketLabel(point.bucketStart, point.bucketEnd)
                    : toChartLabel(label)
                }}
                payload={[]}
              />
            }
          />
          <LineSegments
            data={data}
            dataKey="medianStabilityDays"
            maximumGap={getMaximumLineBridgeGap(data.length)}
            seriesKey={stabilitySeries.label}
            stroke={stabilitySeries.color}
            type="linear"
          />
        </LineChart>
      </ChartContainer>
      <ChartTrendNote pointCount={trendPointCount} />
      {hasDashedBridge(data) ? (
        <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
          {DASHED_LINE_EVIDENCE_LABEL}
        </p>
      ) : null}
      <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
        Longer stability generally means less frequent review, not a guarantee
        of recall.
      </p>
    </div>
  )
}
