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
  formatBucketLabel,
  formatPercentagePoints,
  formatPercent,
  toChartLabel,
} from './chart-shared'
import type { HardAgainSummary, RatingsMixPoint } from './types'

const ratingsMixChartConfig = {
  again: {
    label: 'Again',
    color: 'var(--cp-analytics-again)',
  },
  hard: {
    label: 'Hard',
    color: 'var(--cp-analytics-hard)',
  },
  good: {
    label: 'Good',
    color: 'var(--cp-analytics-good)',
  },
  easy: {
    label: 'Easy',
    color: 'var(--cp-analytics-easy)',
  },
} satisfies ChartConfig

export const ratingsMixStackOffset = 'expand' as const

function RatingsLegend() {
  const items = [
    ['Again', 'var(--cp-analytics-again)'],
    ['Hard', 'var(--cp-analytics-hard)'],
    ['Good', 'var(--cp-analytics-good)'],
    ['Easy', 'var(--cp-analytics-easy)'],
  ] as const

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
      {items.map(([label, color]) => (
        <span key={label} style={{ color }}>
          {label}
        </span>
      ))}
    </div>
  )
}

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
          stackOffset={ratingsMixStackOffset}
        >
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="bucketStart"
            minTickGap={24}
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
                labelFormatter={(label, payload) => {
                  const point = payload?.[0]?.payload as
                    | RatingsMixPoint
                    | undefined
                  return point
                    ? formatBucketLabel(point.bucketStart, point.bucketEnd)
                    : toChartLabel(label)
                }}
                payload={[]}
              />
            }
          />
          <ChartLegend content={<RatingsLegend />} />
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
