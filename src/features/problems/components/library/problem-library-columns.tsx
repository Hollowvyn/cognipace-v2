import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { ColumnDef, Row, SortingFn } from '@tanstack/react-table'

import { ProblemDifficultyBadge } from '@/features/problems/components/problem-difficulty-badge'
import { createLeetCodeProblemUrl } from '@/lib/leetcode'
import { cn } from '@/utils/cn'

import type { ProblemLibraryRow } from '../../api/problems-contracts'
import {
  formatDateCell,
  formatPercentMetric,
} from './problem-library-formatting'
import {
  problemLibraryExcludeTrueFilter,
  problemLibraryColumnIds,
  problemLibraryIncludesAnyFilter,
} from './problem-library-filtering'
import { ProblemStatusBadge } from './problem-status-badge'

export function createProblemLibraryColumns(): ColumnDef<ProblemLibraryRow>[] {
  return [
    {
      id: problemLibraryColumnIds.selection,
      enableSorting: false,
      header: ({ table }) => (
        <ProblemSelectionCheckbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          label="Select current page"
          onChange={(checked) => table.toggleAllPageRowsSelected(checked)}
        />
      ),
      cell: ({ row }) => (
        <ProblemSelectionCheckbox
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          indeterminate={row.getIsSomeSelected()}
          label={`Select ${row.original.problem.title}`}
          onChange={(checked) => row.toggleSelected(checked)}
        />
      ),
    },
    {
      id: problemLibraryColumnIds.expander,
      enableSorting: false,
      header: () => <span className="sr-only">Expand row</span>,
      cell: ({ row }) => <ProblemRowDisclosure row={row} />,
    },
    {
      id: problemLibraryColumnIds.title,
      accessorFn: (row) => row.problem.title,
      header: 'Problem',
      cell: ({ row }) => <ProblemTitleCell row={row.original} />,
      sortDescFirst: false,
    },
    {
      id: problemLibraryColumnIds.difficulty,
      accessorFn: (row) => row.problem.difficulty,
      header: 'Difficulty',
      filterFn: problemLibraryIncludesAnyFilter,
      sortingFn: problemDifficultySorting,
      sortDescFirst: false,
      cell: ({ row }) => (
        <ProblemDifficultyBadge difficulty={row.original.problem.difficulty} />
      ),
    },
    {
      id: problemLibraryColumnIds.status,
      accessorFn: (row) => row.status,
      header: 'Status',
      filterFn: problemLibraryIncludesAnyFilter,
      sortingFn: problemStatusSorting,
      sortDescFirst: false,
      cell: ({ row }) => <ProblemStatusBadge status={row.original.status} />,
    },
    {
      id: problemLibraryColumnIds.retention,
      accessorFn: (row) => row.summary.retrievability ?? undefined,
      header: 'Retention',
      sortDescFirst: false,
      sortUndefined: 'last',
      sortingFn: 'basic',
      cell: ({ row }) => (
        <span className="tabular-nums text-foreground">
          {formatPercentMetric(row.original.summary.retrievability)}
        </span>
      ),
    },
    {
      id: problemLibraryColumnIds.lastReviewedAt,
      accessorFn: (row) => row.lastReviewedAt ?? undefined,
      header: 'Last Review',
      sortDescFirst: false,
      sortUndefined: 'last',
      sortingFn: problemIsoDateSorting,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {formatDateCell(row.original.lastReviewedAt, 'Never reviewed')}
        </span>
      ),
    },
    {
      id: problemLibraryColumnIds.nextReviewAt,
      accessorFn: (row) => row.nextReviewAt ?? undefined,
      header: 'Next Review',
      sortDescFirst: false,
      sortUndefined: 'last',
      sortingFn: problemIsoDateSorting,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {formatDateCell(row.original.nextReviewAt, 'Unscheduled')}
        </span>
      ),
    },
    {
      id: problemLibraryColumnIds.topicIds,
      accessorFn: (row) => row.topics.map((topic) => topic.id),
      filterFn: problemLibraryIncludesAnyFilter,
    },
    {
      id: problemLibraryColumnIds.companyIds,
      accessorFn: (row) => row.companies.map((company) => company.id),
      filterFn: problemLibraryIncludesAnyFilter,
    },
    {
      id: problemLibraryColumnIds.isPremium,
      accessorFn: (row) => row.problem.isPremium,
      filterFn: problemLibraryExcludeTrueFilter,
    },
    {
      id: problemLibraryColumnIds.isSuspended,
      accessorFn: (row) => row.status === 'suspended',
      filterFn: problemLibraryExcludeTrueFilter,
    },
  ]
}

function ProblemSelectionCheckbox({
  checked,
  disabled = false,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  indeterminate?: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  const checkboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate && !checked
    }
  }, [checked, indeterminate])

  return (
    <input
      aria-label={label}
      checked={checked}
      className="size-4 rounded-[var(--cp-radius-sm)] border border-border bg-background accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
      disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.checked)}
      ref={checkboxRef}
      type="checkbox"
    />
  )
}

function ProblemRowDisclosure({ row }: { row: Row<ProblemLibraryRow> }) {
  const isExpanded = row.getIsExpanded()
  const problem = row.original.problem

  return (
    <button
      aria-expanded={isExpanded}
      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${problem.title}`}
      className="inline-flex size-7 items-center justify-center rounded-[var(--cp-control-radius)] text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onClick={row.getToggleExpandedHandler()}
      type="button"
    >
      {isExpanded ? (
        <ChevronDown aria-hidden="true" className="size-4" />
      ) : (
        <ChevronRight aria-hidden="true" className="size-4" />
      )}
    </button>
  )
}

function ProblemTitleCell({ row }: { row: ProblemLibraryRow }) {
  return (
    <a
      className={cn(
        'block min-w-0 truncate font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        row.status === 'suspended' &&
          'text-muted-foreground line-through decoration-muted-foreground/80 hover:text-foreground',
      )}
      href={createLeetCodeProblemUrl(row.problem.slug)}
      onClick={(event) => event.stopPropagation()}
      rel="noreferrer"
      target="_blank"
    >
      <span className="truncate">{row.problem.title}</span>
    </a>
  )
}

const difficultySortOrder = {
  easy: 0,
  medium: 1,
  hard: 2,
  unknown: 3,
} as const

const statusSortOrder = {
  'not-started': 0,
  due: 1,
  scheduled: 2,
  suspended: 3,
} as const

const problemDifficultySorting: SortingFn<ProblemLibraryRow> = (rowA, rowB) =>
  difficultySortOrder[rowA.original.problem.difficulty] -
  difficultySortOrder[rowB.original.problem.difficulty]

const problemStatusSorting: SortingFn<ProblemLibraryRow> = (rowA, rowB) =>
  statusSortOrder[rowA.original.status] - statusSortOrder[rowB.original.status]

const problemIsoDateSorting: SortingFn<ProblemLibraryRow> = (
  rowA,
  rowB,
  columnId,
) =>
  String(rowA.getValue<string | undefined>(columnId) ?? '').localeCompare(
    String(rowB.getValue<string | undefined>(columnId) ?? ''),
  )
