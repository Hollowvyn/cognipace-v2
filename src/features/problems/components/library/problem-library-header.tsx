import type { ReactNode } from 'react'

export interface ProblemLibraryHeaderSummary {
  dueCount: number
  filteredCount: number
  suspendedCount: number
  totalCount: number
}

export function ProblemLibraryHeader({
  newProblemAction,
  summary,
}: {
  newProblemAction: ReactNode
  summary: ProblemLibraryHeaderSummary
}) {
  return (
    <header className="flex min-w-0 flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
      <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-baseline">
        <h2 className="m-0 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
          Library
        </h2>
        <dl className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[length:var(--cp-copy-font-size)]">
          <ProblemLibraryCount label="Total" value={summary.totalCount} />
          <ProblemLibraryCount label="Filtered" value={summary.filteredCount} />
          <ProblemLibraryCount label="Due" value={summary.dueCount} />
          <ProblemLibraryCount
            label="Suspended"
            value={summary.suspendedCount}
          />
        </dl>
      </div>
      {newProblemAction}
    </header>
  )
}

function ProblemLibraryCount({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="inline-flex items-baseline gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 font-semibold text-foreground">{value}</dd>
    </div>
  )
}
