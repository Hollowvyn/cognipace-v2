import { useState } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'

import { ChartTable } from '@/components/ui/chart-table'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'

import type { AnalyticsViews } from '../api/analytics-contracts'
import { LineSegments } from './charts/line-segments'
import {
  formatBucketLabel,
  formatDays,
  formatPercent,
} from './charts/chart-shared'

const chartDimension = { width: 640, height: 288 }

export function ObservedRecallVsFsrsView({
  view,
}: {
  view: AnalyticsViews['observedRecallVsFsrs']
}) {
  const hasValues = view.rows.some((row) => row.observedRecall !== null)
  return (
    <ChartTable
      chart={
        hasValues ? (
          <ChartContainer
            accessibleDescription={`Paired review outcomes and reconstructed FSRS estimates. Scale: ${formatPercent(view.scale.domain[0])}–${formatPercent(view.scale.domain[1])}.`}
            accessibleName="Observed Recall vs FSRS Estimate chart"
            aria-label="Observed Recall vs FSRS Estimate chart"
            className="aspect-auto h-80 min-h-[20rem]"
            config={{
              observedRecall: {
                label: 'Observed recall',
                color: 'var(--cp-analytics-observed)',
              },
              fsrsEstimate: {
                label: 'FSRS estimate',
                color: 'var(--cp-analytics-predicted)',
              },
            }}
            initialDimension={chartDimension}
            role="img"
          >
            <ComposedChart
              accessibilityLayer
              data={view.rows}
              margin={{ bottom: 4, left: 0, right: 8, top: 8 }}
            >
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="bucketStart"
                minTickGap={32}
                tickFormatter={(value) =>
                  formatRowBucket(
                    view.rows.find((row) => row.bucketStart === value),
                  )
                }
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                domain={view.scale.domain}
                ticks={view.scale.ticks}
                tickFormatter={formatPercent}
                tickLine={false}
                width={44}
              />
              <ChartTooltip content={<RecallTooltip />} />
              <RecallLegend />
              <ReferenceLine
                label="Target retention"
                stroke="var(--cp-analytics-target)"
                strokeDasharray="5 5"
                y={view.targetRetention}
              />
              <LineSegments
                data={view.rows}
                dataKey="observedRecall"
                seriesKey="Observed recall"
                showMeasuredDots
                stroke="var(--cp-analytics-observed)"
                testId="observed-recall"
                type="linear"
              />
              <LineSegments
                data={view.rows}
                dataKey="fsrsEstimate"
                seriesKey="FSRS estimate"
                showMeasuredDots
                stroke="var(--cp-analytics-predicted)"
                strokeDasharray="6 3"
                testId="fsrs-estimate"
                type="linear"
              />
            </ComposedChart>
          </ChartContainer>
        ) : (
          <Empty message="No reviews in this period have both a valid rating and an FSRS estimate." />
        )
      }
      table={
        <ObservedRecallTable
          rows={view.rows}
          resetKey={view.rows.map((row) => row.id).join('|')}
        />
      }
    />
  )
}

export function MemoryStrengthView({
  view,
}: {
  view: AnalyticsViews['memoryStrength']
}) {
  const hasValues = view.rows.some((row) => row.medianStrengthDays !== null)
  const chartRows = view.rows.map((row) => ({
    ...row,
    iqrBase: row.q1,
    iqrRange: row.q1 === null || row.q3 === null ? null : row.q3 - row.q1,
  }))
  return (
    <ChartTable
      chart={
        hasValues ? (
          <ChartContainer
            accessibleDescription={`Median post-review FSRS stability. Scale: ${formatDays(view.scale.domain[0])}–${formatDays(view.scale.domain[1])}.`}
            accessibleName="Memory Strength chart"
            aria-label="Memory Strength chart"
            className="aspect-auto h-72 min-h-[18rem]"
            config={{
              medianStrengthDays: {
                label: 'Median strength',
                color: 'var(--cp-analytics-healthy)',
              },
            }}
            initialDimension={chartDimension}
            role="img"
          >
            <ComposedChart
              accessibilityLayer
              data={chartRows}
              margin={{ bottom: 4, left: 0, right: 8, top: 8 }}
            >
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="bucketStart"
                minTickGap={32}
                tickFormatter={(value) =>
                  formatRowBucket(
                    chartRows.find((row) => row.bucketStart === value),
                  )
                }
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                domain={view.scale.domain}
                ticks={view.scale.ticks}
                tickFormatter={formatDays}
                tickLine={false}
                width={48}
              />
              <ChartTooltip content={<MemoryTooltip />} />
              <Area
                dataKey="iqrBase"
                fill="transparent"
                stackId="memory-strength-iqr"
                stroke="transparent"
              />
              <Area
                data-testid="memory-strength-iqr-band"
                dataKey="iqrRange"
                fill="var(--cp-analytics-healthy)"
                fillOpacity={0.18}
                stackId="memory-strength-iqr"
                stroke="none"
              />
              <LineSegments
                data={chartRows}
                dataKey="medianStrengthDays"
                seriesKey="Median strength"
                stroke="var(--cp-analytics-healthy)"
                type="linear"
              />
            </ComposedChart>
          </ChartContainer>
        ) : (
          <Empty message="No valid post-review FSRS stability is available in this period." />
        )
      }
      table={
        <MemoryStrengthTable
          rows={view.rows}
          resetKey={view.rows.map((row) => row.id).join('|')}
        />
      }
    />
  )
}

export function PracticeRhythmView({
  view,
}: {
  view: AnalyticsViews['practiceRhythm']
}) {
  const hasReviews = view.rows.some((row) => row.completedReviews > 0)
  return (
    <div className="grid gap-2">
      <p className="m-0 text-sm font-medium text-foreground">
        Association, not causation.
      </p>
      <ChartTable
        chart={
          hasReviews ? (
            <ChartContainer
              accessibleDescription={`Completed reviews and Review Success. Review count scale: ${view.countScale.domain.join('–')}; Review Success scale: ${formatPercent(view.percentageScale.domain[0])}–${formatPercent(view.percentageScale.domain[1])}. Association, not causation.`}
              accessibleName="Practice Rhythm chart"
              aria-label="Practice Rhythm chart"
              className="aspect-auto h-72 min-h-[18rem]"
              config={{
                completedReviews: {
                  label: 'Completed reviews',
                  color: 'var(--cp-analytics-practice-volume)',
                },
                reviewSuccess: {
                  label: 'Review Success',
                  color: 'var(--cp-analytics-observed)',
                },
              }}
              initialDimension={chartDimension}
              role="img"
            >
              <ComposedChart
                accessibilityLayer
                data={view.rows}
                margin={{ bottom: 4, left: 0, right: 8, top: 8 }}
              >
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="bucketStart"
                  minTickGap={32}
                  tickFormatter={(value) =>
                    formatRowBucket(
                      view.rows.find((row) => row.bucketStart === value),
                    )
                  }
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  domain={view.countScale.domain}
                  ticks={view.countScale.ticks}
                  tickLine={false}
                  width={42}
                  yAxisId="count"
                />
                <YAxis
                  axisLine={false}
                  domain={view.percentageScale.domain}
                  orientation="right"
                  tickFormatter={formatPercent}
                  ticks={view.percentageScale.ticks}
                  tickLine={false}
                  width={44}
                  yAxisId="success"
                />
                <ChartTooltip content={<RhythmTooltip />} />
                <Bar
                  dataKey="completedReviews"
                  fill="var(--cp-analytics-practice-volume)"
                  isAnimationActive={false}
                  name="Completed reviews"
                  radius={[3, 3, 0, 0]}
                  yAxisId="count"
                />
                <LineSegments
                  data={view.rows}
                  dataKey="reviewSuccess"
                  seriesKey="Review Success"
                  stroke="var(--cp-analytics-observed)"
                  type="linear"
                  yAxisId="success"
                />
              </ComposedChart>
            </ChartContainer>
          ) : (
            <Empty message="No valid review ratings are available in this period." />
          )
        }
        table={
          <PracticeRhythmTable
            rows={view.rows}
            resetKey={view.rows.map((row) => row.id).join('|')}
          />
        }
      />
    </div>
  )
}

function ObservedRecallTable({
  rows,
  resetKey,
}: {
  rows: AnalyticsViews['observedRecallVsFsrs']['rows']
  resetKey: string
}) {
  return (
    <PagedTable
      caption="Observed Recall vs FSRS Estimate exact values"
      headers={[
        'Bucket',
        'Recalled',
        'Paired reviews',
        'Observed recall',
        'FSRS estimate',
        'Difference',
        'Provenance',
        'Evidence',
      ]}
      resetKey={resetKey}
      rows={rows}
      cells={(row) => [
        bucketText(row),
        row.recalledCount,
        row.pairedReviews,
        formatPercent(row.observedRecall),
        formatPercent(row.fsrsEstimate),
        formatDifference(row.difference),
        'Reconstructed',
        evidenceText(row.evidence),
      ]}
    />
  )
}

function MemoryStrengthTable({
  rows,
  resetKey,
}: {
  rows: AnalyticsViews['memoryStrength']['rows']
  resetKey: string
}) {
  return (
    <PagedTable
      caption="Memory Strength exact values"
      headers={[
        'Bucket',
        'Median strength',
        'Middle 50%',
        'Eligible reviews',
        'Median change',
        'Provenance',
        'Evidence',
      ]}
      resetKey={resetKey}
      rows={rows}
      cells={(row) => [
        bucketText(row),
        formatDays(row.medianStrengthDays),
        row.q1 === null || row.q3 === null
          ? 'Not measured'
          : `${formatDays(row.q1)}–${formatDays(row.q3)}`,
        row.eligibleReviews,
        formatSignedDays(row.medianChangeDays),
        'Reconstructed',
        evidenceText(row.evidence),
      ]}
    />
  )
}

function PracticeRhythmTable({
  rows,
  resetKey,
}: {
  rows: AnalyticsViews['practiceRhythm']['rows']
  resetKey: string
}) {
  return (
    <PagedTable
      caption="Practice Rhythm exact values"
      headers={[
        'Bucket',
        'Completed reviews',
        'Good + Easy',
        'Review Success',
        'Evidence',
      ]}
      resetKey={resetKey}
      rows={rows}
      cells={(row) => [
        bucketText(row),
        row.completedReviews,
        `${row.goodEasy} of ${row.validRatings}`,
        formatPercent(row.reviewSuccess),
        evidenceText(row.evidence),
      ]}
    />
  )
}

function PagedTable<Row extends { id: string }>({
  caption,
  headers,
  rows,
  cells,
  resetKey,
}: {
  caption: string
  headers: string[]
  rows: Row[]
  cells: (row: Row) => Array<string | number>
  resetKey: string
}) {
  const [pagination, setPagination] = useState({ key: resetKey, page: 0 })
  const page = pagination.key === resetKey ? pagination.page : 0
  const pageSize = 7
  const visible = rows.slice(page * pageSize, (page + 1) * pageSize)
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  return (
    <div className="grid gap-3">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                className="px-2 py-2 text-left font-semibold"
                key={header}
                scope="col"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr className="border-t border-border" key={row.id}>
              {cells(row).map((cell, index) =>
                index === 0 ? (
                  <th
                    className="px-2 py-2 text-left font-medium"
                    key={`${row.id}-${headers[index]}`}
                    scope="row"
                  >
                    {cell}
                  </th>
                ) : (
                  <td
                    className="px-2 py-2 text-right tabular-nums"
                    key={`${row.id}-${headers[index]}`}
                  >
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > pageSize ? (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {pages}
          </span>
          <button
            className="rounded border px-2 py-1 text-sm disabled:opacity-50"
            disabled={page === 0}
            onClick={() =>
              setPagination({ key: resetKey, page: Math.max(0, page - 1) })
            }
            type="button"
          >
            Previous
          </button>
          <button
            className="rounded border px-2 py-1 text-sm disabled:opacity-50"
            disabled={page >= pages - 1}
            onClick={() =>
              setPagination({
                key: resetKey,
                page: Math.min(pages - 1, page + 1),
              })
            }
            type="button"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  )
}

function RecallTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{
    payload: AnalyticsViews['observedRecallVsFsrs']['rows'][number]
  }>
}) {
  const row = payload?.[0]?.payload
  return active && row ? (
    <TooltipBox
      title={bucketText(row)}
      values={[
        `Recalled: ${row.recalledCount} of ${row.pairedReviews}`,
        `Observed recall: ${formatPercent(row.observedRecall)}`,
        `FSRS estimate: ${formatPercent(row.fsrsEstimate)}`,
        `Difference: ${formatDifference(row.difference)}`,
        'Provenance: Reconstructed',
        `Evidence: ${evidenceText(row.evidence)}`,
      ]}
    />
  ) : null
}
function MemoryTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: AnalyticsViews['memoryStrength']['rows'][number] }>
}) {
  const row = payload?.[0]?.payload
  return active && row ? (
    <TooltipBox
      title={bucketText(row)}
      values={[
        `Median strength: ${formatDays(row.medianStrengthDays)}`,
        `Middle 50%: ${row.q1 === null || row.q3 === null ? 'Not measured' : `${formatDays(row.q1)}–${formatDays(row.q3)}`}`,
        `Eligible reviews: ${row.eligibleReviews}`,
        `Median change: ${formatSignedDays(row.medianChangeDays)}`,
        'Provenance: Reconstructed',
        `Evidence: ${evidenceText(row.evidence)}`,
      ]}
    />
  ) : null
}
function RhythmTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: AnalyticsViews['practiceRhythm']['rows'][number] }>
}) {
  const row = payload?.[0]?.payload
  return active && row ? (
    <TooltipBox
      title={bucketText(row)}
      values={[
        `Completed reviews: ${row.completedReviews}`,
        `Review Success: ${formatPercent(row.reviewSuccess)}`,
        `Good + Easy: ${row.goodEasy} of ${row.validRatings}`,
        `Evidence: ${evidenceText(row.evidence)}`,
      ]}
    />
  ) : null
}
function TooltipBox({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="rounded border border-border bg-popover p-2 text-xs shadow">
      <p className="m-0 font-semibold">{title}</p>
      {values.map((value) => (
        <p className="m-0" key={value}>
          {value}
        </p>
      ))}
    </div>
  )
}
function Empty({ message }: { message: string }) {
  return (
    <p className="m-0 grid min-h-48 place-items-center text-sm text-muted-foreground">
      {message}
    </p>
  )
}
function formatRowBucket(
  row: { bucketStart: string; bucketEnd: string } | undefined,
) {
  return row ? formatBucketLabel(row.bucketStart, row.bucketEnd) : ''
}
function bucketText(row: {
  bucketStart: string
  bucketEnd: string
  isPartial: boolean
}) {
  return `${formatTableBucket(row.bucketStart, row.bucketEnd)}${row.isPartial ? ' (in progress)' : ''}`
}
function evidenceText(value: 'measured' | 'not-measured') {
  return value === 'measured' ? 'Measured' : 'Not measured'
}
function formatDifference(value: number | null) {
  return value === null
    ? 'Not measured'
    : `${value >= 0 ? '+' : '−'}${Math.round(Math.abs(value) * 100)} pp`
}
function formatSignedDays(value: number | null) {
  return value === null
    ? 'Not measured'
    : `${value >= 0 ? '+' : '−'}${formatDays(Math.abs(value))}`
}

function RecallLegend() {
  return (
    <div
      className="flex flex-wrap gap-4 text-xs text-muted-foreground"
      role="list"
    >
      <LegendLine
        label="Observed recall"
        stroke="var(--cp-analytics-observed)"
      />
      <LegendLine
        dashed
        label="FSRS estimate"
        stroke="var(--cp-analytics-predicted)"
      />
      <LegendLine
        dashed
        label="Target retention"
        stroke="var(--cp-analytics-target)"
      />
    </div>
  )
}

function LegendLine({
  dashed = false,
  label,
  stroke,
}: {
  dashed?: boolean
  label: string
  stroke: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5" role="listitem">
      <span
        aria-hidden="true"
        className="w-5 border-t-2"
        style={{
          borderColor: stroke,
          borderTopStyle: dashed ? 'dashed' : 'solid',
        }}
      />
      {label}
    </span>
  )
}

const tableDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
  year: '2-digit',
})

function formatTableDate(dateKey: string) {
  return tableDateFormatter.format(new Date(`${dateKey}T00:00:00.000Z`))
}

function formatTableBucket(bucketStart: string, bucketEnd: string) {
  return bucketStart === bucketEnd
    ? formatTableDate(bucketStart)
    : `${formatTableDate(bucketStart)}–${formatTableDate(bucketEnd)}`
}
