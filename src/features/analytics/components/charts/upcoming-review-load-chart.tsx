import type { ChartConfig } from '@/components/ui/chart'
import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartEmptyState,
  chartDimension,
  formatChartDate,
  toChartLabel,
} from './chart-shared'
import { analyticsChartDefinitions } from './chart-definitions'
import type { UpcomingLoadPoint } from './types'

const upcomingLoadDefinition = analyticsChartDefinitions.upcomingLoad
const [overdueSeries, upcomingSeries] = upcomingLoadDefinition.series

const upcomingLoadChartConfig = {
  dueCount: {
    label: upcomingSeries.label,
    color: upcomingSeries.color,
  },
  overdueCount: {
    label: overdueSeries.label,
    color: overdueSeries.color,
  },
} satisfies ChartConfig

export function UpcomingReviewLoadChart({
  data,
}: {
  data: UpcomingLoadPoint[]
}) {
  if (data.length === 0) {
    return (
      <ChartEmptyState
        detail="The next 14 days will appear when the scheduler has active cards to forecast."
        message="No upcoming review load to show yet."
      />
    )
  }

  return (
    <div
      className="grid min-w-0 gap-3"
      data-chart-definition={upcomingLoadDefinition.id}
      data-testid={`analytics-chart-${upcomingLoadDefinition.id}`}
    >
      <p className="m-0 text-sm font-medium text-foreground">
        {upcomingLoadDefinition.title} · Next 14 days
      </p>
      <ChartContainer
        accessibleDescription={upcomingLoadDefinition.metricMeaning}
        accessibleName={`${upcomingLoadDefinition.title} chart`}
        aria-label={`${upcomingLoadDefinition.title} chart`}
        aria-roledescription="bar chart"
        className="aspect-auto h-64 min-h-[16rem]"
        config={upcomingLoadChartConfig}
        initialDimension={chartDimension}
        role="img"
      >
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ bottom: 4, left: 0, right: 8, top: 8 }}
        >
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            allowDuplicatedCategory={false}
            axisLine={false}
            dataKey="date"
            minTickGap={24}
            tickFormatter={(value) =>
              data.find((point) => point.date === value)?.today
                ? 'Today'
                : formatChartDate(String(value))
            }
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
                formatter={(value, name) => [
                  `${String(value)} reviews`,
                  String(name ?? ''),
                ]}
                labelFormatter={(label) => formatChartDate(toChartLabel(label))}
                payload={[]}
              />
            }
          />
          <ChartLegend />
          <Bar
            dataKey="overdueCount"
            fill={overdueSeries.color}
            isAnimationActive={false}
            name={overdueSeries.label}
            stackId="load"
          />
          <Bar
            dataKey="dueCount"
            fill={upcomingSeries.color}
            isAnimationActive={false}
            name={upcomingSeries.label}
            radius={[3, 3, 0, 0]}
            stackId="load"
          />
        </BarChart>
      </ChartContainer>
      <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
        This forecast always covers the next 14 days, regardless of the
        historical range above.
      </p>
    </div>
  )
}
