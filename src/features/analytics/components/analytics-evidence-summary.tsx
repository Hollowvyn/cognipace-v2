import type { AnalyticsEvidence } from '../domain/analytics-evidence'

export function AnalyticsEvidenceSummary({
  evidence,
}: {
  evidence: AnalyticsEvidence
}) {
  return (
    <aside
      aria-label="Analytics evidence"
      className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground"
    >
      <strong className="font-semibold text-foreground">
        {evidence.sampleSize} eligible observations
      </strong>
      <span>{evidence.activeBuckets} active buckets</span>
      <span>{evidence.labels.join(' · ')}</span>
    </aside>
  )
}

export function AnalyticsEvidenceStrip({
  evidence,
}: {
  evidence: AnalyticsEvidence
}) {
  return (
    <p
      aria-label="Figure evidence"
      className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground"
    >
      {evidence.sampleSize} eligible · {evidence.labels.join(' · ')}
    </p>
  )
}
