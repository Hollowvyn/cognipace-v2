// src/features/analytics/components/analytics-metric-row.tsx
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'
import type { SerializedAnalyticsSummary } from '../api/analytics-contracts'
import { metricDefinitions } from '../domain/metric-definitions'
import { cn } from '@/utils/cn'

export function AnalyticsMetricRow({
  summary,
}: {
  summary: SerializedAnalyticsSummary
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[var(--cp-surface-gap)]">
      {summary.lowSample ? (
        <InlineStatus role="status" tone="warning">
          {metricDefinitions.observedCorrectness.label} needs more data — check
          back after at least 10 reviews in the selected {summary.range}-day
          period.
        </InlineStatus>
      ) : null}

      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <Surface
          aria-label="Review Days metric"
          className="grid min-h-[6rem] gap-2 !p-4"
        >
          <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            Review days
          </div>
          <div className="text-3xl font-bold leading-none text-foreground tabular-nums">
            {summary.reviewDays}
          </div>
          <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
            Days with at least one review in the selected {summary.range}-day
            period
          </p>
        </Surface>

        <Surface
          aria-label="Total Reviews metric"
          className="grid min-h-[6rem] gap-2 !p-4"
        >
          <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            Total reviews
          </div>
          <div className="text-3xl font-bold leading-none text-foreground tabular-nums">
            {summary.totalReviews}
          </div>
          <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
            All-time review attempts
          </p>
        </Surface>

        <Surface
          aria-label={`${metricDefinitions.observedCorrectness.label} metric`}
          className="grid min-h-[6rem] gap-2 !p-4"
        >
          <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            {metricDefinitions.observedCorrectness.label}
          </div>
          <div
            className={cn(
              'text-3xl font-bold leading-none tabular-nums',
              summary.lowSample ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {summary.observedRatingQuality.value === null
              ? '—'
              : `${Math.round(summary.observedRatingQuality.value * 100)}%`}
          </div>
          <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
            {summary.lowSample
              ? `Fewer than 10 reviews in the selected ${summary.range}-day period`
              : `${summary.observedRatingSampleSize} reviews in the selected ${summary.range}-day period`}
          </p>
        </Surface>
      </div>
    </div>
  )
}
