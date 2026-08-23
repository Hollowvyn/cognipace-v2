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
  ChartTrendNote,
  ChartEmptyState,
  chartDimension,
  formatBucketLabel,
  formatPercent,
  toChartLabel,
} from './chart-shared'
import { analyticsChartDefinitions } from './chart-definitions'
import { LineSegments } from './line-segments'
import type { RecallQualityPoint } from './types'

const recallDefinition = analyticsChartDefinitions.recallQuality
const [observedSeries, predictedSeries, targetSeries] = recallDefinition.series
const [observedTooltip, predictedTooltip, eligibleTooltip] =
  recallDefinition.tooltipFields

const recallChartConfig = {
  observedRecall: {
    label: observedSeries.label,
    color: observedSeries.color,
  },
  predictedRecall: {
    label: predictedSeries.label,
    color: predictedSeries.color,
  },
  targetRetention: {
    label: targetSeries.label,
    color: targetSeries.color,
  },
} satisfies ChartConfig

function hasDashedBridge(
  data: readonly RecallQualityPoint[],
  key: 'observedRecall' | 'predictedRecall',
): boolean {
  let lastValueIndex: number | null = null

  return data.some((point, index) => {
    if (point[key] === null) return false
    const gap = lastValueIndex === null ? 0 : index - lastValueIndex - 1
    lastValueIndex = index
    return gap > 0
  })
}

function RecallLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span style={{ color: observedSeries.color }}>
        {observedSeries.label}
      </span>
      <span style={{ color: predictedSeries.color }}>
        {predictedSeries.label}
      </span>
      <span style={{ color: targetSeries.color }}>{targetSeries.label}</span>
    </div>
  )
}

export function RecallQualityChart({ data }: { data: RecallQualityPoint[] }) {
  const hasValues = data.some(
    (point) => point.observedRecall !== null || point.predictedRecall !== null,
  )
  const trendPointCount = new Set(
    data
      .filter(
        (point) =>
          point.observedRecall !== null || point.predictedRecall !== null,
      )
      .map((point) => point.bucketStart),
  ).size
  const targetRetention = data.find(
    (point) => point.targetRetention !== null,
  )?.targetRetention
  const showsDashedContinuity =
    hasDashedBridge(data, 'observedRecall') ||
    hasDashedBridge(data, 'predictedRecall')
  const latestObserved = [...data]
    .reverse()
    .find((point) => point.observedRecall !== null)
  const latestPredicted = [...data]
    .reverse()
    .find((point) => point.predictedRecall !== null)

  if (!hasValues) {
    return (
      <ChartEmptyState
        detail="The chart will compare your observed results with the FSRS estimate once enough reviews are available."
        message="Not enough review data for recall quality yet."
      />
    )
  }

  return (
    <div
      className="grid min-w-0 gap-3"
      data-chart-definition={recallDefinition.id}
      data-testid={`analytics-chart-${recallDefinition.id}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="m-0 text-sm font-medium text-foreground">
            {recallDefinition.title}
          </p>
          <p className="m-0 text-xs text-muted-foreground">
            {recallDefinition.question}
          </p>
        </div>
        <p className="m-0 text-sm font-semibold tabular-nums text-foreground">
          Latest observed {formatPercent(latestObserved?.observedRecall)}
        </p>
      </div>
      <ChartContainer
        accessibleDescription={recallDefinition.metricMeaning}
        accessibleName={`${recallDefinition.title} chart`}
        aria-label={`${recallDefinition.title} chart`}
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
            allowDuplicatedCategory={false}
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
                  const observed = name === observedSeries.label
                  const label = observed
                    ? observedTooltip.label
                    : predictedTooltip.label
                  const sampleSize = observed
                    ? point.eligibleSampleSize
                    : point.reviewCount

                  return [
                    `${formatPercent(typeof value === 'number' ? value : null)} · ${sampleSize} ${eligibleTooltip.label.toLowerCase()}`,
                    label,
                  ]
                }}
                labelFormatter={(label, payload) => {
                  const point = payload?.[0]?.payload as
                    RecallQualityPoint | undefined
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
                fill: targetSeries.color,
                fontSize: 11,
                position: 'insideTopRight',
                value: targetSeries.label,
              }}
              data-testid="recall-target-reference"
              stroke={targetSeries.color}
              strokeDasharray="5 5"
              y={targetRetention}
            />
          )}
          <LineSegments
            data={data}
            dataKey="observedRecall"
            seriesKey={observedSeries.label}
            stroke={observedSeries.color}
            testId="recall-observed-lines"
            type="linear"
          />
          <LineSegments
            data={data}
            dataKey="predictedRecall"
            seriesKey={predictedSeries.label}
            stroke={predictedSeries.color}
            testId="recall-predicted-lines"
            type="linear"
          />
        </ComposedChart>
      </ChartContainer>
      <ChartTrendNote pointCount={trendPointCount} />
      {showsDashedContinuity ? (
        <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
          {DASHED_LINE_EVIDENCE_LABEL}
        </p>
      ) : null}
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Latest observed</dt>
          <dd className="m-0 font-medium text-foreground">
            {formatPercent(latestObserved?.observedRecall)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Latest predicted</dt>
          <dd className="m-0 font-medium text-foreground">
            {formatPercent(latestPredicted?.predictedRecall)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Eligible sample</dt>
          <dd className="m-0 font-medium text-foreground">
            {latestObserved?.eligibleSampleSize ?? 0} reviews
          </dd>
        </div>
      </dl>
      <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
        Previous-period comparison is unavailable because this chart receives
        the selected period only; it will not infer a comparison from a
        different bucket.
      </p>
      <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
        Predicted recall is an FSRS estimate immediately before each review, not
        an observed result or guarantee. Tooltips show the eligible review
        sample for every presentation bucket.
      </p>
    </div>
  )
}
