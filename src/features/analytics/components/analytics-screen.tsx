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
  ConsistencyChart,
  MemoryStrengthChart,
  OverdueBacklogChart,
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
        description="Observed correctness shows the share of review outcomes marked correct. Predicted recall is FSRS's estimate immediately before reviews, not a guaranteed result."
        id="recall-quality"
        title="Recall quality"
      >
        <RecallQualityChart data={data.recallQuality} />
      </AnalyticsChartPanel>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <AnalyticsChartPanel
          description={metricDefinitions.consistency.explanation}
          id="consistency"
          title="Consistency vs observed correctness"
        >
          <ConsistencyChart data={data.consistency} />
        </AnalyticsChartPanel>
        <AnalyticsChartPanel
          description="See how your Again, Hard, Good, and Easy ratings mix over time. Hard + Again is the share of ratings that signal friction or failure."
          id="ratings-mix"
          title="Ratings mix"
        >
          <RatingsMixChart data={data.ratingsMix} />
        </AnalyticsChartPanel>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <AnalyticsChartPanel
          description="Topics are ordered by observed correctness so you can see where practice needs attention first."
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
          description="A recent view of how overdue work has been building. The watch zone helps keep the backlog from quietly growing."
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
          description="Retention health shows each reviewed problem's current FSRS retrievability against your target. Retrievability is the model's estimate of recall right now."
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
