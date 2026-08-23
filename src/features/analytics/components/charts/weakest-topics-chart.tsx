import type { ChartConfig } from '@/components/ui/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'

import { ChartEmptyState, chartDimension, formatPercent } from './chart-shared'
import { analyticsChartDefinitions } from './chart-definitions'
import type { TopicPoint } from './types'

const weakestTopicsDefinition = analyticsChartDefinitions.weakestTopics
const [topicSeries] = weakestTopicsDefinition.series

const weakestTopicsChartConfig = {
  recallQuality: {
    label: topicSeries.label,
    color: topicSeries.color,
  },
} satisfies ChartConfig

export function WeakestTopicsChart({ data }: { data: TopicPoint[] }) {
  const lowSampleTopics = data.filter(
    (point) => point.recallQuality !== null && point.lowSample,
  )
  const points = data
    .filter(
      (point): point is TopicPoint & { recallQuality: number } =>
        point.recallQuality !== null && !point.lowSample,
    )
    .sort((left, right) => left.recallQuality - right.recallQuality)
    .slice(0, 5)

  if (points.length === 0) {
    return (
      <ChartEmptyState
        detail={
          lowSampleTopics.length > 0
            ? `Low sample: ${lowSampleTopics.map((point) => `${point.topic} (${point.sampleSize})`).join(', ')}. These are not ranked as weak yet.`
            : 'Topics become comparable after reviewed problems have topic labels and eligible correctness observations.'
        }
        message="No sufficiently sampled topics to rank yet."
      />
    )
  }

  return (
    <div
      className="grid min-w-0 gap-3"
      data-chart-definition={weakestTopicsDefinition.id}
      data-testid={`analytics-chart-${weakestTopicsDefinition.id}`}
    >
      <ChartContainer
        accessibleDescription={weakestTopicsDefinition.metricMeaning}
        accessibleName={`${weakestTopicsDefinition.title} chart`}
        aria-label={`${weakestTopicsDefinition.title} chart`}
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
                formatter={(value, _name, item) => {
                  const point = item.payload as TopicPoint
                  return [
                    `${formatPercent(typeof value === 'number' ? value : null)} · ${point.sampleSize} eligible review${point.sampleSize === 1 ? '' : 's'}`,
                    topicSeries.label,
                  ]
                }}
                payload={[]}
              />
            }
          />
          <Bar
            dataKey="recallQuality"
            isAnimationActive={false}
            name={topicSeries.label}
            radius={[0, 3, 3, 0]}
          >
            {points.map((point) => (
              <Cell fill={topicSeries.color} key={point.topic} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
        Showing the five weakest sufficiently sampled topics.
        {lowSampleTopics.length > 0
          ? ` Low-sample topics excluded: ${lowSampleTopics.map((point) => `${point.topic} (${point.sampleSize})`).join(', ')}.`
          : ' Low-sample topics are excluded from this confident ranking.'}
      </p>
    </div>
  )
}
