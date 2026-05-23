import { RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'

import { useProblemLibrary } from '../../api/problems-api'
import type { SerializedProblem } from '../../api/problems-contracts'
import { ProblemLibraryHeader } from './problem-library-header'
import {
  getFilteredOriginalRows,
  summarizeVisibleLibraryRows,
} from './problem-library-filtering'
import { ProblemLibraryTable } from './problem-library-table'
import { ProblemLibraryToolbar } from './problem-library-toolbar'
import { useProblemLibraryTable } from './use-problem-library-table'

export function ProblemLibraryScreen({
  newProblemAction,
  renderEditProblemAction,
}: {
  newProblemAction: ReactNode
  renderEditProblemAction: (problem: SerializedProblem) => ReactNode
}) {
  const libraryQuery = useProblemLibrary({ surface: 'dashboard' })
  const library = libraryQuery.data
  const tableModel = useProblemLibraryTable(library?.rows ?? [])
  const table = tableModel.table
  const filteredRows = getFilteredOriginalRows(
    table.getFilteredRowModel().rows,
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
        <Surface className="w-full">
          <InlineStatus>Loading Library…</InlineStatus>
        </Surface>
      </ProblemLibraryFrame>
    )
  }

  if (libraryQuery.isError || !library) {
    return (
      <ProblemLibraryFrame>
        <Surface className="grid w-full gap-3">
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
      <Surface className="grid w-full overflow-hidden p-0">
        <ProblemLibraryHeader
          newProblemAction={newProblemAction}
          summary={summary}
        />
        {library.rows.length === 0 ? (
          <ProblemLibraryEmptyState />
        ) : (
          <>
            <ProblemLibraryToolbar
              filters={tableModel.filters}
              library={library}
              onChange={tableModel.setFilters}
              visibleCount={filteredRows.length}
            />
            {filteredRows.length === 0 ? (
              <ProblemLibraryNoResults />
            ) : (
              <ProblemLibraryTable
                renderEditProblemAction={renderEditProblemAction}
                table={table}
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
    <div className="border-t border-border px-4 py-5 md:px-5">
      <InlineStatus>No problems are tracked yet.</InlineStatus>
    </div>
  )
}

function ProblemLibraryNoResults() {
  return (
    <div className="border-t border-border px-4 py-5 md:px-5">
      <InlineStatus>No problems match these filters.</InlineStatus>
    </div>
  )
}
