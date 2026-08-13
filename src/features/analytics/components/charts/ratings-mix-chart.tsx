import type { ChartConfig } from '@/components/ui/chart'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartEmptyState,
  chartDimension,
  formatChartDate,
  formatPercentagePoints,
  formatPercent,
  toChartLabel,
} from './chart-shared'
import type { HardAgainSummary, RatingsMixPoint } from './types'

const ratingsMixChartConfig = {
  again: {
    label: 'Again',
    color: 'var(--chart-5)',
  },
  hard: {
    label: 'Hard',
    color: 'var(--chart-4)',
  },
  good: {
    label: 'Good',
    color: 'var(--chart-1)',
  },
  easy: {
    label: 'Easy',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig

export function RatingsMixChart({
  data,
  summary,
}: {
  data: RatingsMixPoint[]
  summary: HardAgainSummary
}) {
  const totalReviews = data.reduce((sum, point) => sum + point.total, 0)

  if (totalReviews === 0) {
    return (
      <ChartEmptyState
        detail="Rating proportions will appear after the next review session."
        message="No review ratings in this period yet."
      />
    )
  }

  return (
    <div className="grid min-w-0 gap-3">
      <ChartContainer
        accessibleDescription="Stacked rating proportions in each selected time bucket for Again, Hard, Good, and Easy. The Hard plus Again summary compares the selected period with the immediately preceding comparable period."
        accessibleName="Ratings mix chart"
        aria-label="Ratings mix chart"
        aria-roledescription="stacked bar chart"
        className="aspect-auto h-64 min-h-[16rem]"
        config={ratingsMixChartConfig}
        initialDimension={chartDimension}
        role="img"
      >
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ bottom: 4, left: 0, right: 8, top: 8 }}
          stackOffset="expand"
        >
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="bucketStart"
            minTickGap={24}
            tickFormatter={formatChartDate}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            domain={[0, 1]}
            tickFormatter={formatPercent}
            tickLine={false}
            width={42}
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
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="again"
            fill="var(--color-again)"
            isAnimationActive={false}
            name="Again"
            stackId="ratings"
          />
          <Bar
            dataKey="hard"
            fill="var(--color-hard)"
            isAnimationActive={false}
            name="Hard"
            stackId="ratings"
          />
          <Bar
            dataKey="good"
            fill="var(--color-good)"
            isAnimationActive={false}
            name="Good"
            stackId="ratings"
          />
          <Bar
            dataKey="easy"
            fill="var(--color-easy)"
            isAnimationActive={false}
            name="Easy"
            stackId="ratings"
          />
        </BarChart>
      </ChartContainer>
      <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
        Hard + Again this period:{' '}
        <span className="font-semibold text-foreground">
          {formatPercent(summary.selectedShare)}
        </span>{' '}
        ({summary.sampleSize} ratings).
        {summary.lowSample ? (
          <> Need at least 10 ratings to compare periods.</>
        ) : summary.direction !== null && summary.delta !== null ? (
          <>
            {' '}
            <span className="font-semibold text-foreground">
              {summary.direction}{' '}
              {formatPercentagePoints(Math.abs(summary.delta))}
            </span>{' '}
            from the previous period ({formatPercent(summary.previousShare)};{' '}
            {summary.previousSampleSize} ratings).
          </>
        ) : (
          <> The previous period does not have enough ratings to compare.</>
        )}
      </p>
    </div>
  )
}
