import type { ChartConfig } from '@/components/ui/chart'
import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Bar, CartesianGrid, ComposedChart, XAxis, YAxis } from 'recharts'

import {
  DASHED_LINE_EVIDENCE_LABEL,
  ChartEmptyState,
  chartDimension,
  formatBucketLabel,
  formatPercent,
  toChartLabel,
} from './chart-shared'
import { LineSegments } from './line-segments'
import type { PracticeRhythmPoint } from './types'

const practiceRhythmChartConfig = {
  reviewCount: {
    label: 'Reviews',
    color: 'var(--cp-analytics-practice-volume)',
  },
  observedCorrectness: {
    label: 'Observed correctness',
    color: 'var(--cp-analytics-observed)',
  },
} satisfies ChartConfig

function hasPermittedGap(data: readonly PracticeRhythmPoint[]): boolean {
  let lastValueIndex: number | null = null

  return data.some((point, index) => {
    if (point.observedCorrectness === null) return false
    const gap = lastValueIndex === null ? 0 : index - lastValueIndex - 1
    lastValueIndex = index
    return gap > 0 && gap <= 2
  })
}

function PracticeRhythmLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span style={{ color: 'var(--cp-analytics-practice-volume)' }}>
        Reviews
      </span>
      <span style={{ color: 'var(--cp-analytics-observed)' }}>
        Observed correctness
      </span>
    </div>
  )
}

export function PracticeRhythmChart({ data }: { data: PracticeRhythmPoint[] }) {
  const hasReviews = data.some((point) => point.reviewCount > 0)
  const hasCorrectness = data.some(
    (point) => point.observedCorrectness !== null,
  )

  if (!hasReviews) {
    return (
      <ChartEmptyState
        detail="Adaptive buckets with no eligible correctness observations stay blank instead of becoming zero."
        message="Not enough review data for a practice rhythm comparison yet."
      />
    )
  }

  return (
    <div className="grid min-w-0 gap-3">
      <div data-testid="practice-correctness-lines">
        <ChartContainer
          accessibleDescription="Each adaptive time bucket shows review volume and, when eligible assessments exist, observed correctness. This describes an association, not proof of causation."
          accessibleName="Practice rhythm chart"
          aria-label="Practice rhythm chart"
          aria-roledescription="composed bar and line chart"
          className="aspect-auto h-72 min-h-[18rem]"
          config={practiceRhythmChartConfig}
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
              allowDecimals={false}
              axisLine={false}
              label={{ value: 'Reviews', angle: -90, position: 'insideLeft' }}
              tickLine={false}
              width={42}
              yAxisId="reviews"
            />
            <YAxis
              axisLine={false}
              domain={[0, 1]}
              label={{
                value: 'Correctness',
                angle: 90,
                position: 'insideRight',
              }}
              orientation="right"
              tickFormatter={formatPercent}
              tickLine={false}
              width={42}
              yAxisId="correctness"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  active={false}
                  formatter={(value, name, item) => {
                    const point = item.payload as PracticeRhythmPoint
                    const reviews = name === 'Reviews'
                    return [
                      reviews
                        ? `${String(value)} reviews`
                        : `${formatPercent(typeof value === 'number' ? value : null)} · ${point.sampleSize} eligible review${point.sampleSize === 1 ? '' : 's'}`,
                      reviews ? 'Reviews' : 'Observed correctness',
                    ]
                  }}
                  labelFormatter={(label, payload) => {
                    const point = payload?.[0]?.payload as
                      | PracticeRhythmPoint
                      | undefined
                    return point
                      ? formatBucketLabel(point.bucketStart, point.bucketEnd)
                      : toChartLabel(label)
                  }}
                  payload={[]}
                />
              }
            />
            <ChartLegend content={<PracticeRhythmLegend />} />
            <Bar
              dataKey="reviewCount"
              data-testid="practice-review-bars"
              fill="var(--cp-analytics-practice-volume)"
              isAnimationActive={false}
              name="Reviews"
              radius={[3, 3, 0, 0]}
              yAxisId="reviews"
            />
            {hasCorrectness ? (
              <LineSegments
                data={data}
                dataKey="observedCorrectness"
                maximumGap={2}
                seriesKey="Observed correctness"
                stroke="var(--cp-analytics-observed)"
                type="linear"
                yAxisId="correctness"
              />
            ) : null}
          </ComposedChart>
        </ChartContainer>
      </div>
      <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
        <span className="font-medium text-foreground">
          Association, not causation.
        </span>{' '}
        More reviews and stronger observed correctness can move together without
        either one proving it caused the other.
      </p>
      {hasPermittedGap(data) ? (
        <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
          {DASHED_LINE_EVIDENCE_LABEL}
        </p>
      ) : null}
    </div>
  )
}

/** @deprecated Use PracticeRhythmChart. */
export const ConsistencyChart = PracticeRhythmChart
