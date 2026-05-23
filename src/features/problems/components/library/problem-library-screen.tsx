import { RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'

import { useProblemLibrary } from '../../api/problems-api'
import { ProblemLibraryHeader } from './problem-library-header'
import {
  defaultProblemLibraryFilters,
  defaultProblemLibrarySort,
  filterProblemLibraryRows,
  sortProblemLibraryRows,
  summarizeVisibleLibraryRows,
  type ProblemLibraryFilters,
  type ProblemLibrarySort,
} from './problem-library-filtering'
import { ProblemLibraryTable } from './problem-library-table'
import { ProblemLibraryToolbar } from './problem-library-toolbar'

export function ProblemLibraryScreen({
  newProblemAction,
}: {
  newProblemAction: ReactNode
}) {
  const libraryQuery = useProblemLibrary({ surface: 'dashboard' })
  const [filters, setFilters] = useState<ProblemLibraryFilters>(
    defaultProblemLibraryFilters,
  )
  const [sort, setSort] = useState<ProblemLibrarySort>(
    defaultProblemLibrarySort,
  )
  const [expandedProblemSlug, setExpandedProblemSlug] = useState<string | null>(
    null,
  )
  const library = libraryQuery.data
  const filteredRows = useMemo(
    () => (library ? filterProblemLibraryRows(library.rows, filters) : []),
    [filters, library],
  )
  const rows = useMemo(
    () => sortProblemLibraryRows(filteredRows, sort),
    [filteredRows, sort],
  )
  const summary = library
    ? summarizeVisibleLibraryRows(library, filteredRows)
    : {
        totalCount: 0,
        filteredCount: 0,
        dueCount: 0,
        suspendedCount: 0,
      }

  if (libraryQuery.isPending) {
    return (
      <ProblemLibraryFrame>
        <Surface className="max-w-[72rem]">
          <InlineStatus>Loading Library…</InlineStatus>
        </Surface>
      </ProblemLibraryFrame>
    )
  }

  if (libraryQuery.isError || !library) {
    return (
      <ProblemLibraryFrame>
        <Surface className="grid max-w-[72rem] gap-3">
          <InlineStatus role="alert" tone="danger">
            Failed to load the Library.
          </InlineStatus>
          <div>
            <Button
              onClick={() => {
                void libraryQuery.refetch()
              }}
              size="sm"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" />
              Retry
            </Button>
          </div>
        </Surface>
      </ProblemLibraryFrame>
    )
  }

  return (
    <ProblemLibraryFrame>
      <Surface className="grid w-full max-w-[88rem] gap-3 p-0">
        <ProblemLibraryHeader
          newProblemAction={newProblemAction}
          summary={summary}
        />
        {library.rows.length === 0 ? (
          <ProblemLibraryEmptyState />
        ) : (
          <>
            <ProblemLibraryToolbar
              filters={filters}
              library={library}
              onChange={setFilters}
            />
            {rows.length === 0 ? (
              <ProblemLibraryNoResults />
            ) : (
              <ProblemLibraryTable
                expandedProblemSlug={expandedProblemSlug}
                onSortChange={setSort}
                onToggleExpanded={(problemSlug) =>
                  setExpandedProblemSlug((current) =>
                    current === problemSlug ? null : problemSlug,
                  )
                }
                rows={rows}
                sort={sort}
              />
            )}
          </>
        )}
      </Surface>
    </ProblemLibraryFrame>
  )
}

function ProblemLibraryFrame({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-[var(--cp-surface-gap)]">{children}</div>
  )
}

function ProblemLibraryEmptyState() {
  return (
    <div className="px-4 pb-5 md:px-5">
      <InlineStatus>No problems are tracked yet.</InlineStatus>
    </div>
  )
}

function ProblemLibraryNoResults() {
  return (
    <div className="px-4 pb-5 md:px-5">
      <InlineStatus>No problems match these filters.</InlineStatus>
    </div>
  )
}
