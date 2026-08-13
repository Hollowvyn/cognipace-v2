import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'

import { useAnalyticsSummary } from '../api/analytics-api'
import type {
  AnalyticsRange,
  SerializedAnalyticsSummary,
} from '../api/analytics-contracts'
import { metricDefinitions } from '../domain/metric-definitions'
import { AnalyticsChartPanel } from './analytics-chart-panel'
import { AnalyticsMemoryProfile } from './analytics-memory-profile'
import { AnalyticsMetricRow } from './analytics-metric-row'
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

export function AnalyticsScreen({ range = 30 }: { range?: AnalyticsRange }) {
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
      {data.chartDataStatus === 'unavailable' ? (
        <AnalyticsChartPanel
          description={metricDefinitions.recallQuality.explanation}
          emptyMessage={
            'Not enough valid review history to draw the selected analytics charts yet. Keep reviewing to build a useful trend.'
          }
          id="analytics-chart-data"
          title="Analytics charts"
        />
      ) : null}
      <AnalyticsMemoryProfile profile={data.memoryProfile} />
      {data.chartDataStatus === 'ready' ? (
        <AnalyticsChartHierarchy data={data} />
      ) : null}
    </div>
  )
}

function AnalyticsChartHierarchy({
  data,
}: {
  data: SerializedAnalyticsSummary
}) {
  return (
    <div className="grid min-w-0 gap-4">
      <AnalyticsChartPanel
        description={`${metricDefinitions.observedCorrectness.explanation} ${metricDefinitions.predictedRecall.explanation}`}
        id="recall-quality"
        title="Recall quality"
      >
        <RecallQualityChart data={data.recallQuality} />
      </AnalyticsChartPanel>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <AnalyticsChartPanel
          description={metricDefinitions.practiceRhythm.explanation}
          id="practice-rhythm"
          title="Practice rhythm vs observed correctness"
        >
          <PracticeRhythmChart data={data.practiceRhythm} />
        </AnalyticsChartPanel>
        <AnalyticsChartPanel
          description={metricDefinitions.ratingsMix.explanation}
          id="ratings-mix"
          title="Ratings mix"
        >
          <RatingsMixChart data={data.ratingsMix} summary={data.hardAgain} />
        </AnalyticsChartPanel>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <AnalyticsChartPanel
          description={metricDefinitions.weakestTopics.explanation}
          id="weakest-topics"
          title="Weakest topics"
        >
          <WeakestTopicsChart data={data.topics} />
        </AnalyticsChartPanel>
        <AnalyticsChartPanel
          description={metricDefinitions.memoryStrength.explanation}
          id="memory-strength"
          title="Memory strength"
        >
          <MemoryStrengthChart data={data.stability} />
        </AnalyticsChartPanel>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <AnalyticsChartPanel
          description={metricDefinitions.overdueBacklog.explanation}
          id="overdue-backlog"
          title="Recent overdue backlog"
        >
          <OverdueBacklogChart
            data={data.overdueBacklog}
            historyAvailableFrom={data.overdueHistoryAvailableFrom}
          />
        </AnalyticsChartPanel>
        <AnalyticsChartPanel
          description={metricDefinitions.upcomingLoad.explanation}
          id="upcoming-review-load"
          title="Upcoming review load"
        >
          <UpcomingReviewLoadChart data={data.upcomingLoad} />
        </AnalyticsChartPanel>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <AnalyticsChartPanel
          description={`${metricDefinitions.retentionHealth.explanation} ${metricDefinitions.predictedRecall.explanation}`}
          id="retention-health"
          title="Retention health"
        >
          <RetentionHealthChart
            data={data.retentionHealth}
            targetRetention={data.targetRetention}
          />
        </AnalyticsChartPanel>
        <FragileKnowledgeTable rows={data.fragileKnowledge} />
      </div>
    </div>
  )
}
