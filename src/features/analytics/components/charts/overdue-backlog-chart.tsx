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
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'

import {
  ChartEmptyState,
  chartDimension,
  formatChartDate,
  formatHistoryBoundary,
  toChartLabel,
} from './chart-shared'
import type { OverdueBacklogPoint } from './types'

const overdueBacklogChartConfig = {
  overdueCount: {
    label: 'Overdue problems',
    color: 'var(--chart-4)',
  },
} satisfies ChartConfig

export function OverdueBacklogChart({
  data,
  historyAvailableFrom,
  watchZone = 5,
}: {
  data: OverdueBacklogPoint[]
  historyAvailableFrom: string | null
  watchZone?: number
}) {
  const points = data.filter((point) => point.historyAvailable)

  if (points.length === 0) {
    return (
      <ChartEmptyState
        detail={formatHistoryBoundary(historyAvailableFrom)}
        message="Overdue history is not available yet."
      />
    )
  }

  return (
    <div className="grid min-w-0 gap-3">
      <ChartContainer
        accessibleDescription={`Overdue backlog over time with a watch zone below ${watchZone} overdue problems.`}
        accessibleName="Recent overdue backlog chart"
        aria-label="Recent overdue backlog chart"
        aria-roledescription="area chart"
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
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <ReferenceArea
            fill="var(--cp-tone-warning-bg)"
            fillOpacity={0.35}
            y1={0}
            y2={watchZone}
          />
          <ReferenceLine
            label={{
              fill: 'var(--chart-4)',
              fontSize: 11,
              position: 'insideTopRight',
              value: 'Watch zone',
            }}
            stroke="var(--chart-4)"
            strokeDasharray="4 4"
            y={watchZone}
          />
          <XAxis
            axisLine={false}
            dataKey="date"
            minTickGap={24}
            tickFormatter={formatChartDate}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            allowDecimals={false}
            tickLine={false}
            width={32}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                active={false}
                formatter={(value) => [`${String(value)} overdue`, 'Backlog']}
                labelFormatter={(label) => formatChartDate(toChartLabel(label))}
                payload={[]}
              />
            }
          />
          <Area
            dataKey="overdueCount"
            fill="var(--color-overdueCount)"
            fillOpacity={0.22}
            isAnimationActive={false}
            name="Overdue problems"
            stroke="var(--color-overdueCount)"
            strokeWidth={2.5}
            type="monotone"
          />
        </AreaChart>
      </ChartContainer>
      <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
        Keep overdue backlog below the{' '}
        <span className="font-semibold text-foreground">
          {watchZone}-problem watch zone
        </span>
        . {formatHistoryBoundary(historyAvailableFrom)}
      </p>
    </div>
  )
}
