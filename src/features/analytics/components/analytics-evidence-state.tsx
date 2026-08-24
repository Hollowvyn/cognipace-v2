import { InlineStatus } from '@/components/ui/inline-status'

import type { AnalyticsEvidenceClassification } from '../api/analytics-contracts'

type AnalyticsEvidenceStateProps =
  | {
      evidence: AnalyticsEvidenceClassification
      summary?: false
      title?: string
    }
  | {
      evidence?: never
      summary: true
      title?: never
    }

export function AnalyticsEvidenceState(props: AnalyticsEvidenceStateProps) {
  if (props.summary) {
    return (
      <InlineStatus
        aria-label="Historical analytics evidence"
        className="text-sm text-muted-foreground"
        role="status"
      >
        Historical views qualify trends using eligible history, measured
        buckets, and observations. Exact values remain available in each Table.
      </InlineStatus>
    )
  }

  const { evidence, title } = props

  return (
    <p
      aria-label={title ? `${title} evidence` : 'Historical view evidence'}
      className="m-0 grid gap-0.5 text-xs leading-snug text-muted-foreground"
      role="status"
    >
      <span>
        {evidence.historyDays} eligible history{' '}
        {evidence.historyDays === 1 ? 'day' : 'days'} ·{' '}
        {evidence.measuredBuckets} measured{' '}
        {evidence.measuredBuckets === 1 ? 'bucket' : 'buckets'} ·{' '}
        {evidence.observations} observation
        {evidence.observations === 1 ? '' : 's'}
      </span>
      <span>{displayCopy(evidence)}</span>
    </p>
  )
}

function displayCopy(evidence: AnalyticsEvidenceClassification): string {
  switch (evidence.displayMode) {
    case 'table':
      return 'Exact values are available; fewer than 30 eligible history days do not support a trend chart.'
    case 'single':
      return 'One measurement is shown without a trend line.'
    case 'marks':
      return 'Measurements are shown without a trend line.'
    case 'trend':
      return 'The available evidence supports a descriptive trend.'
  }
}
