import { RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'

import { useAnalyticsSummary } from '../api/analytics-api'
import type {
  AnalyticsRange,
  SerializedAnalyticsSummary,
} from '../api/analytics-contracts'
import {
  metricDefinitions,
  type AnalyticsMetricDefinition,
} from '../domain/metric-definitions'
import { AnalyticsChartPanel } from './analytics-chart-panel'
import { AnalyticsMetricRow } from './analytics-metric-row'
import { AnalyticsReadinessState } from './analytics-readiness-state'
import {
  MemoryStrengthChart,
  OverdueBacklogChart,
  PracticeRhythmChart,
  RatingsMixChart,
  RecallQualityChart,
  RetentionHealthChart,
  UpcomingReviewLoadChart,
  WeakestTopicsChart,
} from './charts'
import { FragileKnowledgeTable } from './fragile-knowledge-table'

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
      <AnalyticsWorkloadStory data={data} />
      <AnalyticsCurrentStateStory data={data} />
    </div>
  )
}

function AnalyticsHistoricalStory({
  data,
}: {
  data: SerializedAnalyticsSummary
}) {
  return (
    <div className="grid min-w-0 gap-4">
      {data.historicalReadiness.recallQuality.ready ? (
        <AnalyticsChartPanel
          description={metricDefinitions.recallQuality.explanation}
          id="recall-quality"
          question={metricDefinitions.recallQuality.question}
          title={metricDefinitions.recallQuality.label}
          warning={metricDefinitions.recallQuality.warning}
        >
          <RecallQualityChart data={data.recallQuality} />
        </AnalyticsChartPanel>
      ) : (
        <AnalyticsChartPanel
          description={metricDefinitions.recallQuality.explanation}
          id="recall-quality"
          question={metricDefinitions.recallQuality.question}
          title={metricDefinitions.recallQuality.label}
          warning={metricDefinitions.recallQuality.warning}
        >
          <AnalyticsReadinessState
            compact
            readiness={data.historicalReadiness.recallQuality}
            recommendedRange={null}
            title={metricDefinitions.recallQuality.label}
          />
          <RecallQualityChart data={data.recallQuality} />
        </AnalyticsChartPanel>
      )}

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <HistoricalMetricPanel
          data={data}
          metric="practiceRhythm"
          render={() => <PracticeRhythmChart data={data.practiceRhythm} />}
        />
        <HistoricalMetricPanel
          data={data}
          metric="ratingsMix"
          render={() => (
            <RatingsMixChart data={data.ratingsMix} summary={data.hardAgain} />
          )}
        />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <HistoricalMetricPanel
          data={data}
          metric="topics"
          render={() => <WeakestTopicsChart data={data.topics} />}
        />
        <HistoricalMetricPanel
          data={data}
          metric="stability"
          render={() => <MemoryStrengthChart data={data.stability} />}
        />
      </div>
    </div>
  )
}

type HistoricalMetricKey =
  'practiceRhythm' | 'ratingsMix' | 'topics' | 'stability' | 'overdueBacklog'

const historicalMetricPanels: Record<
  HistoricalMetricKey,
  { chartId: string; definition: AnalyticsMetricDefinition }
> = {
  practiceRhythm: {
    chartId: 'practice-rhythm',
    definition: metricDefinitions.practiceRhythm,
  },
  ratingsMix: {
    chartId: 'ratings-mix',
    definition: metricDefinitions.ratingsMix,
  },
  topics: {
    chartId: 'weakest-topics',
    definition: metricDefinitions.weakestTopics,
  },
  stability: {
    chartId: 'memory-strength',
    definition: metricDefinitions.memoryStrength,
  },
  overdueBacklog: {
    chartId: 'overdue-backlog',
    definition: metricDefinitions.overdueBacklog,
  },
}

function HistoricalMetricPanel({
  data,
  metric,
  render,
}: {
  data: SerializedAnalyticsSummary
  metric: HistoricalMetricKey
  render: () => ReactNode
}) {
  const { chartId, definition } = historicalMetricPanels[metric]
  const readiness = data.historicalReadiness[metric]

  return (
    <AnalyticsChartPanel
      description={definition.explanation}
      id={chartId}
      question={definition.question}
      title={definition.label}
      warning={definition.warning}
    >
      {!readiness.ready ? (
        <AnalyticsReadinessState
          compact
          readiness={readiness}
          recommendedRange={null}
          title={definition.label}
        />
      ) : null}
      {render()}
    </AnalyticsChartPanel>
  )
}

function UpcomingLoadPanel({ data }: { data: SerializedAnalyticsSummary }) {
  const definition = metricDefinitions.upcomingLoad

  return (
    <AnalyticsChartPanel
      description={definition.explanation}
      id="upcoming-review-load"
      question={definition.question}
      title={definition.label}
    >
      <UpcomingReviewLoadChart data={data.upcomingLoad} />
    </AnalyticsChartPanel>
  )
}

function AnalyticsWorkloadStory({
  data,
}: {
  data: SerializedAnalyticsSummary
}) {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <HistoricalMetricPanel
        data={data}
        metric="overdueBacklog"
        render={() => (
          <OverdueBacklogChart
            data={data.overdueBacklog}
            historyAvailableFrom={data.overdueHistoryAvailableFrom}
          />
        )}
      />
      <UpcomingLoadPanel data={data} />
    </div>
  )
}

function AnalyticsCurrentStateStory({
  data,
}: {
  data: SerializedAnalyticsSummary
}) {
  const retentionDefinition = metricDefinitions.retentionHealth

  return (
    <div className="grid min-w-0 gap-4">
      <AnalyticsChartPanel
        description={retentionDefinition.explanation}
        id="retention-health"
        question={retentionDefinition.question}
        title={retentionDefinition.label}
      >
        <RetentionHealthChart
          data={data.retentionHealth}
          targetRetention={data.targetRetention}
        />
      </AnalyticsChartPanel>
      <FragileKnowledgeTable rows={data.fragileKnowledge} />
    </div>
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
