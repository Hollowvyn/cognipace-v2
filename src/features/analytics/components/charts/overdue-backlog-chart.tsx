import type { ChartConfig } from '@/components/ui/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'

import {
  ChartEmptyState,
  chartDimension,
  formatBucketLabel,
  formatHistoryBoundary,
  toChartLabel,
} from './chart-shared'
import { analyticsChartDefinitions } from './chart-definitions'
import type { OverdueBacklogPoint } from './types'

const overdueBacklogDefinition = analyticsChartDefinitions.overdueBacklog
const [backlogSeries, watchZoneSeries, healthySeries, attentionSeries] =
  overdueBacklogDefinition.series

const overdueBacklogChartConfig = {
  overdueCount: {
    label: backlogSeries.label,
    color: backlogSeries.color,
  },
} satisfies ChartConfig

type BacklogChartPoint = OverdueBacklogPoint & {
  attentionRange: number | null
  healthyRange: number | null
}

export function buildOverdueBacklogChartSeries(
  data: readonly OverdueBacklogPoint[],
  watchZone = 5,
): BacklogChartPoint[] {
  return data.map((point) => ({
    ...point,
    attentionRange:
      point.overdueCount !== null && point.overdueCount > watchZone
        ? point.overdueCount
        : null,
    healthyRange:
      point.overdueCount !== null && point.overdueCount <= watchZone
        ? point.overdueCount
        : null,
  }))
}

function formatBacklogStatus(value: number, watchZone: number): string {
  return value <= watchZone ? 'Within watch zone' : 'Above watch zone'
}

export function OverdueBacklogChart({
  data,
  historyAvailableFrom,
  watchZone = 5,
}: {
  data: OverdueBacklogPoint[]
  historyAvailableFrom: string | null
  watchZone?: number
}) {
  const points = buildOverdueBacklogChartSeries(data, watchZone)
  const knownCounts = points.flatMap((point) =>
    point.overdueCount === null ? [] : [point.overdueCount],
  )
  const yMax = Math.max(watchZone + 1, ...knownCounts)
  const thresholdOffset = `${Math.max(0, Math.min(100, (1 - watchZone / yMax) * 100))}%`

  if (!points.some((point) => point.historyAvailable)) {
    return (
      <ChartEmptyState
        detail={formatHistoryBoundary(historyAvailableFrom)}
        message="Overdue history is not available yet."
      />
    )
  }

  return (
    <div
      className="grid min-w-0 gap-3"
      data-chart-definition={overdueBacklogDefinition.id}
      data-testid={`analytics-chart-${overdueBacklogDefinition.id}`}
    >
      <ChartContainer
        accessibleDescription={overdueBacklogDefinition.metricMeaning}
        accessibleName={`${overdueBacklogDefinition.title} chart`}
        aria-label={`${overdueBacklogDefinition.title} chart`}
        aria-roledescription="line and area chart"
        className="aspect-auto h-64 min-h-[16rem]"
        config={overdueBacklogChartConfig}
        initialDimension={chartDimension}
        role="img"
      >
        <AreaChart
          accessibilityLayer
          data={points}
          margin={{ bottom: 4, left: 0, right: 8, top: 8 }}
        >
          <defs>
            <linearGradient
              id="backlog-line-gradient"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="0%" stopColor={attentionSeries.color} />
              <stop
                offset={thresholdOffset}
                stopColor={attentionSeries.color}
              />
              <stop offset={thresholdOffset} stopColor={healthySeries.color} />
              <stop offset="100%" stopColor={healthySeries.color} />
            </linearGradient>
            <linearGradient
              id="backlog-area-gradient"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={attentionSeries.color}
                stopOpacity={0.2}
              />
              <stop
                offset={thresholdOffset}
                stopColor={attentionSeries.color}
                stopOpacity={0.2}
              />
              <stop
                offset={thresholdOffset}
                stopColor={healthySeries.color}
                stopOpacity={0.2}
              />
              <stop
                offset="100%"
                stopColor={healthySeries.color}
                stopOpacity={0.03}
              />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <ReferenceLine
            label={{
              fill: watchZoneSeries.color,
              fontSize: 11,
              position: 'insideTopRight',
              value: `Watch zone · ${watchZone}`,
            }}
            stroke={watchZoneSeries.color}
            strokeDasharray="4 4"
            y={watchZone}
          />
          <XAxis
            axisLine={false}
            dataKey="bucketStart"
            minTickGap={32}
            tickFormatter={(value) => {
              const point = points.find((item) => item.bucketStart === value)
              return point
                ? formatBucketLabel(point.bucketStart, point.bucketEnd)
                : toChartLabel(value)
            }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            domain={[0, yMax]}
            tickLine={false}
            width={32}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                active={false}
                formatter={(value) => {
                  const count = typeof value === 'number' ? value : null
                  return [
                    count === null
                      ? 'Unknown historical backlog'
                      : `${count} overdue · ${formatBacklogStatus(count, watchZone)}`,
                    backlogSeries.label,
                  ]
                }}
                labelFormatter={(label, payload) => {
                  const point = payload?.[0]?.payload as
                    | BacklogChartPoint
                    | undefined
                  return point
                    ? formatBucketLabel(point.bucketStart, point.bucketEnd)
                    : toChartLabel(label)
                }}
                payload={[]}
              />
            }
          />
          <Area
            connectNulls={false}
            data-connect-nulls="false"
            dataKey="overdueCount"
            data-null-policy="preserve-gaps"
            data-testid="backlog-history-series"
            fill="url(#backlog-area-gradient)"
            fillOpacity={1}
            isAnimationActive={false}
            name={backlogSeries.label}
            stroke="url(#backlog-line-gradient)"
            strokeWidth={2.5}
            type="linear"
          />
          <Area
            connectNulls={false}
            data-connect-nulls="false"
            dataKey="healthyRange"
            data-null-policy="preserve-gaps"
            data-testid="backlog-healthy-range"
            fill="none"
            isAnimationActive={false}
            name={healthySeries.label}
            stroke={healthySeries.color}
            strokeWidth={2.5}
            type="linear"
          />
          <Area
            connectNulls={false}
            data-connect-nulls="false"
            dataKey="attentionRange"
            data-null-policy="preserve-gaps"
            data-testid="backlog-attention-range"
            fill="none"
            isAnimationActive={false}
            name={attentionSeries.label}
            stroke={attentionSeries.color}
            strokeWidth={2.5}
            type="linear"
          />
        </AreaChart>
      </ChartContainer>
      <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
        Tooltip reports each bucket’s threshold status. Keep overdue backlog at
        or below the{' '}
        <span className="font-semibold text-foreground">
          {watchZone}-problem watch zone
        </span>
        . {formatHistoryBoundary(historyAvailableFrom)}
      </p>
    </div>
  )
}
