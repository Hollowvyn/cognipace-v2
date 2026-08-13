import type { ChartConfig } from '@/components/ui/chart'
import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'

import {
  DASHED_LINE_EVIDENCE_LABEL,
  ChartEmptyState,
  chartDimension,
  formatBucketLabel,
  formatPercent,
  toChartLabel,
} from './chart-shared'
import { LineSegments } from './line-segments'
import type { RecallQualityPoint } from './types'

const recallChartConfig = {
  observedRecall: {
    label: 'Observed correctness',
    color: 'var(--cp-analytics-observed)',
  },
  predictedRecall: {
    label: 'Predicted recall',
    color: 'var(--cp-analytics-predicted)',
  },
  targetRetention: {
    label: 'Target retention',
    color: 'var(--cp-analytics-target)',
  },
} satisfies ChartConfig

function hasPermittedGap(
  data: readonly RecallQualityPoint[],
  key: 'observedRecall' | 'predictedRecall',
): boolean {
  let lastValueIndex: number | null = null

  return data.some((point, index) => {
    if (point[key] === null) return false
    const gap = lastValueIndex === null ? 0 : index - lastValueIndex - 1
    lastValueIndex = index
    return gap > 0 && gap <= 2
  })
}

function RecallLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span style={{ color: 'var(--cp-analytics-observed)' }}>
        Observed correctness
      </span>
      <span style={{ color: 'var(--cp-analytics-predicted)' }}>
        Predicted recall
      </span>
      <span style={{ color: 'var(--cp-analytics-target)' }}>
        Target retention
      </span>
    </div>
  )
}

export function RecallQualityChart({ data }: { data: RecallQualityPoint[] }) {
  const hasValues = data.some(
    (point) => point.observedRecall !== null || point.predictedRecall !== null,
  )
  const targetRetention = data.find(
    (point) => point.targetRetention !== null,
  )?.targetRetention
  const showsDashedContinuity =
    hasPermittedGap(data, 'observedRecall') ||
    hasPermittedGap(data, 'predictedRecall')

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
        accessibleDescription="Observed correctness is based on eligible persisted review outcomes. Predicted recall is the FSRS estimate immediately before review."
        accessibleName="Recall quality chart"
        aria-label="Recall quality chart"
        aria-roledescription="line chart"
        className="aspect-auto h-80 min-h-[20rem]"
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
            minTickGap={32}
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
                formatter={(value, name, item) => {
                  const point = item.payload as RecallQualityPoint
                  const observed = name === 'Observed correctness'
                  const label = observed
                    ? 'Observed correctness'
                    : 'Predicted recall (FSRS estimate)'
                  const sampleSize = observed
                    ? point.eligibleSampleSize
                    : point.reviewCount

                  return [
                    `${formatPercent(typeof value === 'number' ? value : null)} · ${sampleSize} eligible review${sampleSize === 1 ? '' : 's'}`,
                    label,
                  ]
                }}
                labelFormatter={(label, payload) => {
                  const point = payload?.[0]?.payload as
                    | RecallQualityPoint
                    | undefined
                  return point
                    ? formatBucketLabel(point.bucketStart, point.bucketEnd)
                    : toChartLabel(label)
                }}
                payload={[]}
              />
            }
          />
          <ChartLegend content={<RecallLegend />} />
          {targetRetention === undefined ? null : (
            <ReferenceLine
              ifOverflow="extendDomain"
              label={{
                fill: 'var(--cp-analytics-target)',
                fontSize: 11,
                position: 'insideTopRight',
                value: 'Target retention',
              }}
              stroke="var(--cp-analytics-target)"
              strokeDasharray="5 5"
              y={targetRetention}
            />
          )}
          <LineSegments
            data={data}
            dataKey="observedRecall"
            maximumGap={2}
            seriesKey="Observed correctness"
            stroke="var(--cp-analytics-observed)"
            type="linear"
          />
          <LineSegments
            data={data}
            dataKey="predictedRecall"
            maximumGap={2}
            seriesKey="Predicted recall"
            stroke="var(--cp-analytics-predicted)"
            type="linear"
          />
        </ComposedChart>
      </ChartContainer>
      {showsDashedContinuity ? (
        <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
          {DASHED_LINE_EVIDENCE_LABEL}
        </p>
      ) : null}
      <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
        Predicted recall is an FSRS estimate immediately before each review, not
        an observed result or guarantee. Tooltips show the eligible review
        sample for every presentation bucket.
      </p>
    </div>
  )
}
