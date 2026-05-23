import { ArrowDown, ArrowUp, ChevronDown, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { ProblemDifficultyBadge } from '@/features/problems/components/problem-difficulty-badge'
import { cn } from '@/utils/cn'

import type { ProblemLibraryRow } from '../../api/problems-contracts'
import { ProblemChipList } from './problem-chip-list'
import {
  type ProblemLibrarySort,
  type ProblemLibrarySortKey,
} from './problem-library-filtering'
import {
  formatDateCell,
  formatMetric,
  formatPercentMetric,
} from './problem-library-formatting'
import { ProblemStatusBadge } from './problem-status-badge'

export function ProblemLibraryTable({
  expandedProblemSlug,
  onSortChange,
  onToggleExpanded,
  rows,
  sort,
}: {
  expandedProblemSlug: string | null
  onSortChange: (sort: ProblemLibrarySort) => void
  onToggleExpanded: (problemSlug: string) => void
  rows: readonly ProblemLibraryRow[]
  sort: ProblemLibrarySort
}) {
  function requestSort(key: ProblemLibrarySortKey) {
    onSortChange({
      direction: sort.key === key && sort.direction === 'asc' ? 'desc' : 'asc',
      key,
    })
  }

  return (
    <div className="overflow-x-auto border-t border-border">
      <table className="w-full min-w-[72rem] border-collapse text-left text-[length:var(--cp-copy-font-size)]">
        <thead>
          <tr className="border-b border-border bg-muted/60 text-[length:var(--cp-badge-font-size)] uppercase text-muted-foreground">
            <th className="w-10 px-3 py-2 font-semibold">
              <span className="sr-only">Expand row</span>
            </th>
            <SortableHeader
              label="Problem"
              onSort={() => requestSort('title')}
              sort={sort}
              sortKey="title"
            />
            <SortableHeader
              label="Difficulty"
              onSort={() => requestSort('difficulty')}
              sort={sort}
              sortKey="difficulty"
            />
            <SortableHeader
              label="Status"
              onSort={() => requestSort('status')}
              sort={sort}
              sortKey="status"
            />
            <th className="px-3 py-2 font-semibold">Topics</th>
            <th className="px-3 py-2 font-semibold">Companies</th>
            <th className="px-3 py-2 font-semibold">Tracks</th>
            <SortableHeader
              label="Next Review"
              onSort={() => requestSort('nextReviewAt')}
              sort={sort}
              sortKey="nextReviewAt"
            />
            <SortableHeader
              label="Last Solved"
              onSort={() => requestSort('lastSolvedAt')}
              sort={sort}
              sortKey="lastSolvedAt"
            />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ProblemLibraryTableRow
              isExpanded={expandedProblemSlug === row.problem.slug}
              key={row.problem.slug}
              onToggleExpanded={onToggleExpanded}
              row={row}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SortableHeader({
  label,
  onSort,
  sort,
  sortKey,
}: {
  label: string
  onSort: () => void
  sort: ProblemLibrarySort
  sortKey: ProblemLibrarySortKey
}) {
  const isSorted = sort.key === sortKey

  return (
    <th
      aria-sort={
        isSorted
          ? sort.direction === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none'
      }
      className="px-3 py-2 font-semibold"
      scope="col"
    >
      <button
        className="inline-flex items-center gap-1 rounded-[var(--cp-radius-sm)] text-left uppercase hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={onSort}
        type="button"
      >
        {label}
        {isSorted ? (
          sort.direction === 'asc' ? (
            <ArrowUp aria-hidden="true" className="size-3" />
          ) : (
            <ArrowDown aria-hidden="true" className="size-3" />
          )
        ) : null}
      </button>
    </th>
  )
}

function ProblemLibraryTableRow({
  isExpanded,
  onToggleExpanded,
  row,
}: {
  isExpanded: boolean
  onToggleExpanded: (problemSlug: string) => void
  row: ProblemLibraryRow
}) {
  const tracks = row.trackMemberships.map((membership) => ({
    id: membership.groupId,
    label: membership.trackTitle,
  }))

  return (
    <>
      <tr
        className={cn(
          'border-b border-border transition-colors hover:bg-muted/50',
          isExpanded && 'bg-muted/60',
        )}
      >
        <td className="px-3 py-2 align-middle">
          <button
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${row.problem.title}`}
            className="inline-flex size-7 items-center justify-center rounded-[var(--cp-control-radius)] text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={() => onToggleExpanded(row.problem.slug)}
            type="button"
          >
            {isExpanded ? (
              <ChevronDown aria-hidden="true" className="size-4" />
            ) : (
              <ChevronRight aria-hidden="true" className="size-4" />
            )}
          </button>
        </td>
        <td className="max-w-[18rem] px-3 py-2 align-middle">
          <div className="min-w-0">
            <div className="truncate font-semibold text-foreground">
              {row.problem.title}
            </div>
            <div className="truncate text-[length:var(--cp-badge-font-size)] text-muted-foreground">
              {row.problem.slug}
            </div>
          </div>
        </td>
        <td className="px-3 py-2 align-middle">
          <ProblemDifficultyBadge difficulty={row.problem.difficulty} />
        </td>
        <td className="px-3 py-2 align-middle">
          <ProblemStatusBadge status={row.status} />
        </td>
        <td className="max-w-[12rem] px-3 py-2 align-middle">
          <ProblemChipList items={row.topics} />
        </td>
        <td className="max-w-[12rem] px-3 py-2 align-middle">
          <ProblemChipList items={row.companies} />
        </td>
        <td className="max-w-[12rem] px-3 py-2 align-middle">
          <ProblemChipList items={tracks} />
        </td>
        <td className="whitespace-nowrap px-3 py-2 align-middle text-muted-foreground">
          {formatDateCell(row.nextReviewAt, 'Unscheduled')}
        </td>
        <td className="whitespace-nowrap px-3 py-2 align-middle text-muted-foreground">
          {formatDateCell(row.lastSolvedAt, 'Never solved')}
        </td>
      </tr>
      {isExpanded ? (
        <tr className="border-b border-border bg-muted/30">
          <td colSpan={9} className="px-4 py-4">
            <ProblemLibraryDetails row={row} />
          </td>
        </tr>
      ) : null}
    </>
  )
}

function ProblemLibraryDetails({ row }: { row: ProblemLibraryRow }) {
  return (
    <div className="grid gap-4 text-[length:var(--cp-copy-font-size)] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <dl className="grid gap-3">
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
          <ProblemChipList
            items={row.trackMemberships.map((membership) => ({
              id: membership.groupId,
              label: `${membership.trackTitle}: ${membership.groupTitle}`,
            }))}
            limit={8}
            wrap
          />
        </ProblemDetailLine>
      </dl>
      <dl className="grid gap-3">
        <ProblemDetailLine label="Last reviewed">
          {formatDateCell(row.lastReviewedAt, 'Never reviewed')}
        </ProblemDetailLine>
        <ProblemDetailLine label="Review count">
          {row.summary.reviewCount}
        </ProblemDetailLine>
        <ProblemDetailLine label="Retrievability">
          {formatPercentMetric(row.summary.retrievability)}
        </ProblemDetailLine>
        <ProblemDetailLine label="Stability">
          {formatMetric(row.summary.stability, ' days')}
        </ProblemDetailLine>
      </dl>
    </div>
  )
}

function ProblemDetailLine({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
      <dt className="text-[length:var(--cp-badge-font-size)] font-bold uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="m-0 min-w-0 text-foreground">{children}</dd>
    </div>
  )
}
