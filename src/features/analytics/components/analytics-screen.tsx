import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'

import { useAnalyticsSummary } from '../api/analytics-api'
import type { AnalyticsRange } from '../api/analytics-contracts'
import { metricDefinitions } from '../domain/metric-definitions'
import { AnalyticsChartPanel } from './analytics-chart-panel'
import { AnalyticsForecast } from './analytics-forecast'
import { AnalyticsMemoryProfile } from './analytics-memory-profile'
import { AnalyticsMetricRow } from './analytics-metric-row'
import { AnalyticsRetentionScatter } from './analytics-retention-scatter'
import { AnalyticsWeakProblems } from './analytics-weak-problems'

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
      <AnalyticsForecast forecast={data.dueForecast14Days} />
      <AnalyticsRetentionScatter
        scatter={data.retentionScatter}
        referenceCurve={data.retentionScatterCurve}
        targetRetention={data.targetRetention}
      />
      <AnalyticsWeakProblems problems={data.weakProblems} />
    </div>
  )
}
