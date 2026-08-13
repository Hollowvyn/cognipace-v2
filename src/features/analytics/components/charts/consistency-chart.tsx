import type { ChartConfig } from '@/components/ui/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis } from 'recharts'

import { ChartEmptyState, chartDimension, formatPercent } from './chart-shared'
import type { ConsistencyPoint } from './types'

const consistencyChartConfig = {
  observedCorrectness: {
    label: 'Observed correctness',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

export function ConsistencyChart({ data }: { data: ConsistencyPoint[] }) {
  const points = data.filter(
    (point): point is ConsistencyPoint & { observedCorrectness: number } =>
      point.observedCorrectness !== null,
  )

  if (points.length === 0) {
    return (
      <ChartEmptyState
        detail="Weeks with no eligible correctness observations are left out instead of being shown as zero."
        message="Not enough observed correctness data for a practice rhythm comparison yet."
      />
    )
  }

  return (
    <ChartContainer
      accessibleDescription="Each point represents a week. More practice days are shown against observed correctness; this is an association, not proof of causation."
      accessibleName="Consistency versus observed correctness chart"
      aria-label="Consistency versus observed correctness chart"
      aria-roledescription="scatter plot"
      className="aspect-auto h-64 min-h-[16rem]"
      config={consistencyChartConfig}
      initialDimension={chartDimension}
      role="img"
    >
      <ScatterChart
        accessibilityLayer
        data={points}
        margin={{ bottom: 4, left: 0, right: 8, top: 8 }}
      >
        <CartesianGrid stroke="var(--color-border)" />
        <XAxis
          allowDecimals={false}
          axisLine={false}
          dataKey="reviewDays"
          domain={[0, 'dataMax + 1']}
          label={{
            value: 'Practice days / week',
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
        <ChartTooltip
          content={
            <ChartTooltipContent
              active={false}
              formatter={(value, name) => [
                name === 'reviewDays'
                  ? `${String(value)} days`
                  : formatPercent(typeof value === 'number' ? value : null),
                name === 'reviewDays'
                  ? 'Practice days'
                  : 'Observed correctness',
              ]}
              payload={[]}
            />
          }
        />
        <Scatter
          data={points}
          dataKey="observedCorrectness"
          fill="var(--color-observedCorrectness)"
          isAnimationActive={false}
          name="Observed correctness"
        />
      </ScatterChart>
    </ChartContainer>
  )
}
