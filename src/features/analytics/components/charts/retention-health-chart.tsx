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
  XAxis,
  YAxis,
} from 'recharts'

import { ChartEmptyState, chartDimension, formatPercent } from './chart-shared'
import type { RetentionHealthPoint } from './types'

const retentionHealthChartConfig = {
  aboveTarget: {
    label: 'Above target',
    color: 'var(--chart-3)',
  },
  approaching: {
    label: 'Approaching',
    color: 'var(--chart-4)',
  },
  belowTarget: {
    label: 'Below target',
    color: 'var(--chart-5)',
  },
} satisfies ChartConfig

type RetentionStatus = 'aboveTarget' | 'approaching' | 'belowTarget'

function getStatus(
  retrievability: number,
  targetRetention: number,
): RetentionStatus {
  if (retrievability >= targetRetention) return 'aboveTarget'
  if (retrievability >= targetRetention - 0.1) return 'approaching'
  return 'belowTarget'
}

export function RetentionHealthChart({
  data,
  targetRetention,
}: {
  data: RetentionHealthPoint[]
  targetRetention: number
}) {
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
      groups[getStatus(point.retrievability, targetRetention)].push(point)
      return groups
    },
    { aboveTarget: [], approaching: [], belowTarget: [] },
  )

  return (
    <ChartContainer
      accessibleDescription={`Each point is a reviewed problem plotted by days since review and predicted retrievability. The target is ${formatPercent(targetRetention)}.`}
      accessibleName="Retention health chart"
      aria-label="Retention health chart"
      aria-roledescription="scatter plot"
      className="aspect-auto h-72 min-h-[18rem]"
      config={retentionHealthChartConfig}
      initialDimension={chartDimension}
      role="img"
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
        />
        <Scatter
          data={grouped.approaching}
          dataKey="retrievability"
          fill="var(--color-approaching)"
          isAnimationActive={false}
          name="Approaching"
        />
        <Scatter
          data={grouped.belowTarget}
          dataKey="retrievability"
          fill="var(--color-belowTarget)"
          isAnimationActive={false}
          name="Below target"
        />
      </ScatterChart>
    </ChartContainer>
  )
}
