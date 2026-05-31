import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'

import { useAnalyticsSummary } from '../api/analytics-api'
import { AnalyticsForecast } from './analytics-forecast'
import { AnalyticsMetricRow } from './analytics-metric-row'
import { AnalyticsWeakProblems } from './analytics-weak-problems'

export function AnalyticsScreen() {
  const query = useAnalyticsSummary()

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
      <AnalyticsForecast forecast={data.dueForecast14Days} />
      <AnalyticsWeakProblems problems={data.weakProblems} />
    </div>
  )
}
