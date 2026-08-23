import { RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'
import { formatDateTime } from '@/utils/date-format'

import { useAnalyticsSummary } from '../api/analytics-api'
import type {
  AnalyticsRange,
  SerializedAnalyticsSummary,
} from '../api/analytics-contracts'
import { AnalyticsChartPanel } from './analytics-chart-panel'
import { AnalyticsMetricRow } from './analytics-metric-row'
import { AnalyticsReadinessState } from './analytics-readiness-state'
import {
  MemoryStrengthView,
  ObservedRecallVsFsrsView,
  PracticeRhythmView,
} from './historical-views'

export function AnalyticsScreen({
  range = 30,
}: {
  range?: AnalyticsRange | undefined
}) {
  const query = useAnalyticsSummary(range)

  if (query.isPending) {
    return (
      <Surface>
        <InlineStatus>Loading analytics...</InlineStatus>
      </Surface>
    )
  }

  if (query.isError || !query.data) {
    return (
      <Surface className="grid gap-3">
        <InlineStatus role="alert" tone="danger">
          Failed to load Analytics.
        </InlineStatus>
        <div>
          <Button
            onClick={() => {
              void query.refetch()
            }}
            size="sm"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" />
            Retry
          </Button>
        </div>
      </Surface>
    )
  }

  const { data } = query

  return (
    <div className="flex min-w-0 flex-col gap-[var(--cp-surface-gap)]">
      <AnalyticsMetricRow summary={data} />
      <AnalyticsScopeMetadata data={data} />
      {!data.historicalReadiness.requested.ready ? (
        <AnalyticsReadinessState
          compact
          readiness={data.historicalReadiness.requested}
          recommendedRange={data.historicalReadiness.recommendedRange}
        />
      ) : null}
      {data.historicalReadiness.requested.ready &&
      hasTrimmedLeadingHistory(data.historicalReadiness.requested) ? (
        <AnalyticsReadinessState
          compact
          readiness={data.historicalReadiness.requested}
          recommendedRange={null}
        />
      ) : null}
      <AnalyticsHistoricalStory data={data} />
    </div>
  )
}

function AnalyticsScopeMetadata({
  data,
}: {
  data: SerializedAnalyticsSummary
}) {
  const finalBucketEndKey = data.timeFrame.buckets.at(-1)?.endKey
  return (
    <p className="m-0 text-sm text-muted-foreground">
      Range: {data.range} days
      {finalBucketEndKey
        ? ` · Period: ${formatScopeDateTime(data.timeFrame.periodStart, data.timeFrame.timeZone)}–${formatScopeDateKey(finalBucketEndKey)}`
        : ''}{' '}
      · Time zone: {data.timeFrame.timeZone}
      {data.timeFrame.timeZoneFallback ? ' (fallback)' : ''} · As of:{' '}
      {formatDateTime(data.timeFrame.asOf)}
    </p>
  )
}

function formatScopeDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: '2-digit',
  }).format(new Date(value))
}

function formatScopeDateKey(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
    year: '2-digit',
  }).format(new Date(`${value}T00:00:00.000Z`))
}

function AnalyticsHistoricalStory({
  data,
}: {
  data: SerializedAnalyticsSummary
}) {
  return (
    <div className="grid min-w-0 gap-4">
      <PhaseTwoPanel
        description="Rating-derived recalled outcomes compared with reconstructed FSRS retrievability immediately before those exact reviews."
        id="observed-recall-vs-fsrs"
        question="How did recalled review outcomes compare with the FSRS estimate?"
        readiness={data.historicalReadiness.recallQuality}
        title="Observed Recall vs FSRS Estimate"
      >
        <ObservedRecallVsFsrsView view={data.views.observedRecallVsFsrs} />
      </PhaseTwoPanel>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <PhaseTwoPanel
          description="FSRS's reconstructed post-review estimate of how long the memories reviewed in each bucket may remain retrievable."
          id="memory-strength"
          question="Are your reviewed memories staying strong for longer?"
          readiness={data.historicalReadiness.stability}
          title="Memory Strength"
        >
          <MemoryStrengthView view={data.views.memoryStrength} />
        </PhaseTwoPanel>
        <PhaseTwoPanel
          description="Completed review volume and the Good + Easy share move together by time bucket; the relationship is association only."
          id="practice-rhythm"
          question="When you practiced more or less, how did Review Success move?"
          readiness={data.historicalReadiness.practiceRhythm}
          title="Practice Rhythm"
        >
          <PracticeRhythmView view={data.views.practiceRhythm} />
        </PhaseTwoPanel>
      </div>
    </div>
  )
}

function PhaseTwoPanel({
  description,
  id,
  question,
  readiness,
  title,
  children,
}: {
  description: string
  id: string
  question: string
  readiness: SerializedAnalyticsSummary['historicalReadiness']['recallQuality']
  title: string
  children: ReactNode
}) {
  return (
    <AnalyticsChartPanel
      description={description}
      id={id}
      question={question}
      title={title}
    >
      {!readiness.ready ? (
        <AnalyticsReadinessState
          compact
          readiness={readiness}
          recommendedRange={null}
          title={title}
        />
      ) : null}
      {children}
    </AnalyticsChartPanel>
  )
}

function hasTrimmedLeadingHistory(
  readiness: SerializedAnalyticsSummary['historicalReadiness']['requested'],
): boolean {
  return (
    readiness.effectiveStart !== null &&
    readiness.effectiveBuckets < readiness.requestedBuckets
  )
}
