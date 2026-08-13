import type { ChartConfig } from '@/components/ui/chart'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'

import {
  ChartEmptyState,
  chartDimension,
  formatChartDate,
  formatPercent,
  toChartLabel,
} from './chart-shared'
import type { RecallQualityPoint } from './types'

const recallChartConfig = {
  observedRecall: {
    label: 'Observed correctness',
    color: 'var(--chart-1)',
  },
  predictedRecall: {
    label: 'Predicted recall',
    color: 'var(--chart-2)',
  },
  targetRetention: {
    label: 'Target retention',
    color: 'var(--chart-4)',
  },
} satisfies ChartConfig

export function RecallQualityChart({ data }: { data: RecallQualityPoint[] }) {
  const hasValues = data.some(
    (point) => point.observedRecall !== null || point.predictedRecall !== null,
  )

  if (!hasValues) {
    return (
      <ChartEmptyState
        detail="The chart will compare your observed results with the FSRS estimate once enough reviews are available."
        message="Not enough review data for recall quality yet."
      />
    )
  }

  return (
    <div className="grid min-w-0 gap-3">
      <ChartContainer
        accessibleDescription="Observed correctness is based on review outcomes. Predicted recall is the FSRS estimate before each review."
        accessibleName="Recall quality chart"
        aria-label="Recall quality chart"
        aria-roledescription="line chart"
        className="aspect-auto h-72 min-h-[18rem]"
        config={recallChartConfig}
        initialDimension={chartDimension}
        role="img"
      >
        <ComposedChart
          accessibilityLayer
          data={data}
          margin={{ bottom: 4, left: 0, right: 8, top: 8 }}
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
                formatter={(value, name, item) => {
                  const point = item.payload as RecallQualityPoint
                  const isObserved = name === 'Observed correctness'
                  const sampleSize = isObserved
                    ? point.eligibleSampleSize
                    : point.reviewCount
                  const label = isObserved
                    ? 'Observed correctness'
                    : name === 'Predicted recall'
                      ? 'Predicted recall (FSRS estimate)'
                      : String(name ?? '')

                  return [
                    `${formatPercent(typeof value === 'number' ? value : null)} · n=${sampleSize}`,
                    label,
                  ]
                }}
                labelFormatter={(label) => formatChartDate(toChartLabel(label))}
                payload={[]}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Line
            activeDot={{ r: 5 }}
            connectNulls
            dataKey="observedRecall"
            dot={{ r: 3, strokeWidth: 0 }}
            isAnimationActive={false}
            name="Observed correctness"
            stroke="var(--color-observedRecall)"
            strokeWidth={2.5}
            type="monotone"
          />
          <Line
            activeDot={{ r: 5 }}
            connectNulls
            dataKey="predictedRecall"
            dot={{ r: 3, strokeWidth: 0 }}
            isAnimationActive={false}
            name="Predicted recall"
            stroke="var(--color-predictedRecall)"
            strokeWidth={2.5}
            type="monotone"
          />
          <Line
            dataKey="targetRetention"
            dot={false}
            isAnimationActive={false}
            name="Target retention"
            stroke="var(--color-targetRetention)"
            strokeDasharray="5 5"
            strokeWidth={1.5}
            type="monotone"
          />
        </ComposedChart>
      </ChartContainer>
      <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
        Predicted recall is an FSRS estimate immediately before each review;
        each time bucket's sample sizes distinguish review volume from eligible
        observed correctness.
      </p>
    </div>
  )
}
