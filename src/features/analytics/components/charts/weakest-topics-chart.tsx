import type { ChartConfig } from '@/components/ui/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'

import { ChartEmptyState, chartDimension, formatPercent } from './chart-shared'
import type { TopicPoint } from './types'

const weakestTopicsChartConfig = {
  recallQuality: {
    label: 'Recall quality',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

export function WeakestTopicsChart({ data }: { data: TopicPoint[] }) {
  const points = data.filter((point) => point.recallQuality !== null)
  const lowSampleTopics = points.filter((point) => point.lowSample)

  if (points.length === 0) {
    return (
      <ChartEmptyState
        detail="Topics become comparable after reviewed problems have topic labels and eligible correctness observations."
        message="No topic-level recall data yet."
      />
    )
  }

  return (
    <div className="grid min-w-0 gap-3">
      <ChartContainer
        accessibleDescription="Topics are ordered from weakest to strongest by observed recall quality. Low-sample topics are labeled below the chart and use the attention color."
        accessibleName="Weakest topics chart"
        aria-label="Weakest topics chart"
        aria-roledescription="horizontal bar chart"
        className="aspect-auto h-72 min-h-[18rem]"
        config={weakestTopicsChartConfig}
        initialDimension={chartDimension}
        role="img"
      >
        <BarChart
          accessibilityLayer
          data={points}
          layout="vertical"
          margin={{ bottom: 4, left: 8, right: 8, top: 8 }}
        >
          <CartesianGrid horizontal={false} stroke="var(--color-border)" />
          <XAxis
            axisLine={false}
            domain={[0, 1]}
            tickFormatter={formatPercent}
            tickLine={false}
            type="number"
          />
          <YAxis
            axisLine={false}
            dataKey="topic"
            tickLine={false}
            type="category"
            width={92}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                active={false}
                formatter={(value) => [
                  formatPercent(typeof value === 'number' ? value : null),
                  'Recall quality',
                ]}
                payload={[]}
              />
            }
          />
          <Bar
            dataKey="recallQuality"
            isAnimationActive={false}
            name="Recall quality"
            radius={[0, 3, 3, 0]}
          >
            {points.map((point) => (
              <Cell
                fill={
                  point.lowSample
                    ? 'var(--chart-4)'
                    : 'var(--color-recallQuality)'
                }
                key={point.topic}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
        {lowSampleTopics.length > 0
          ? `Low sample: ${lowSampleTopics.map((point) => `${point.topic} (${point.sampleSize})`).join(', ')}. Treat these comparisons carefully.`
          : 'Each topic has enough observations for the selected low-sample threshold.'}
      </p>
    </div>
  )
}
