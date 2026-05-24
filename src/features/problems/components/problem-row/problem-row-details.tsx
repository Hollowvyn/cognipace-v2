import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils/cn'

import type { ProblemLibraryRow } from '../../api/problems-contracts'
import { ProblemChipList } from '../library/problem-chip-list'
import {
  formatDateCell,
  formatMetric,
  formatPercentMetric,
} from '../library/problem-library-formatting'

export function ProblemRowDetails({
  actions,
  row,
}: {
  actions: ReactNode
  row: ProblemLibraryRow
}) {
  return (
    <div className="grid gap-8 text-[length:var(--cp-copy-font-size)] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="min-w-0">
        <h3 className="m-0 pb-3 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
          Details
        </h3>
        <dl>
          <ProblemDetailLine label="Premium">
            {row.problem.isPremium ? (
              <Badge tone="premium">Premium</Badge>
            ) : (
              <Badge tone="neutral" variant="outline">
                Free
              </Badge>
            )}
          </ProblemDetailLine>
          <ProblemDetailLine label="Topics">
            <ProblemChipList items={row.topics} limit={8} wrap />
          </ProblemDetailLine>
          <ProblemDetailLine label="Companies">
            <ProblemChipList items={row.companies} limit={8} wrap />
          </ProblemDetailLine>
          <ProblemDetailLine label="Tracks">
            <ProblemChipList items={createTrackChips(row)} limit={8} wrap />
          </ProblemDetailLine>
        </dl>
      </section>
      <section className="min-w-0">
        <h3 className="m-0 pb-3 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
          Analytics and history
        </h3>
        <dl>
          <ProblemDetailLine label="Stability">
            {formatMetric(row.summary.stability, ' days')}
          </ProblemDetailLine>
          <ProblemDetailLine label="Difficulty">
            {formatMetric(row.summary.difficulty, ' / 10')}
          </ProblemDetailLine>
          <ProblemDetailLine
            label="Retrievability"
            valueClassName={
              row.summary.retrievability === null ? undefined : 'text-secondary'
            }
          >
            {formatPercentMetric(row.summary.retrievability)}
          </ProblemDetailLine>
          <ProblemDetailLine label="Reps">
            {row.summary.reviewCount}
          </ProblemDetailLine>
          <ProblemDetailLine label="Last reviewed">
            {formatDateCell(row.lastReviewedAt, 'Never reviewed')}
          </ProblemDetailLine>
          <ProblemDetailLine label="Last solved">
            {formatDateCell(row.lastSolvedAt, 'Never solved')}
          </ProblemDetailLine>
        </dl>
      </section>
      <div className="md:col-span-2">{actions}</div>
    </div>
  )
}

function createTrackChips(row: ProblemLibraryRow) {
  const tracksById = new Map<string, { id: string; label: string }>()

  for (const membership of row.trackMemberships) {
    tracksById.set(membership.trackId, {
      id: membership.trackId,
      label: membership.trackTitle,
    })
  }

  return [...tracksById.values()]
}

function ProblemDetailLine({
  children,
  label,
  valueClassName,
}: {
  children: ReactNode
  label: string
  valueClassName?: string | undefined
}) {
  return (
    <div className="grid gap-1 border-t border-border py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
      <dt className="text-[length:var(--cp-badge-font-size)] font-bold uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className={cn('m-0 min-w-0 text-foreground', valueClassName)}>
        {children}
      </dd>
    </div>
  )
}
