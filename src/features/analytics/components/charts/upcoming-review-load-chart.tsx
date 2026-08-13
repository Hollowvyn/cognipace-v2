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
import type { UpcomingLoadPoint } from './types'

const upcomingLoadChartConfig = {
  dueCount: {
    label: 'Upcoming reviews',
    color: 'var(--cp-analytics-healthy)',
  },
  overdueCount: {
    label: 'Overdue reviews',
    color: 'var(--cp-analytics-risk)',
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
    <div className="grid min-w-0 gap-3">
      <p className="m-0 text-sm font-medium text-foreground">Next 14 days</p>
      <ChartContainer
        accessibleDescription="Fixed next 14 days review workload forecast. Overdue work is separated from scheduled upcoming reviews and does not change with the historical range."
        accessibleName="Upcoming review load chart"
        aria-label="Upcoming review load chart"
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
            fill="var(--color-overdueCount)"
            isAnimationActive={false}
            name="Overdue reviews"
            stackId="load"
          />
          <Bar
            dataKey="dueCount"
            fill="var(--color-dueCount)"
            isAnimationActive={false}
            name="Upcoming reviews"
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
