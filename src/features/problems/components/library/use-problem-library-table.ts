import { useCallback, useMemo, useState } from 'react'
import {
  useTable,
  type ExpandedState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type Updater,
  type ColumnVisibilityState,
} from '@tanstack/react-table'

import type { ProblemLibraryRow } from '../../api/problems-contracts'
import { createProblemLibraryColumns } from './problem-library-columns'
import {
  createProblemLibraryColumnFilters,
  defaultProblemLibraryFilters,
  problemLibraryColumnIds,
  problemLibraryGlobalFilter,
  type ProblemLibraryFilters,
} from './problem-library-filtering'

const hiddenFilterColumns = {
  [problemLibraryColumnIds.companyIds]: false,
  [problemLibraryColumnIds.isPremium]: false,
  [problemLibraryColumnIds.isSuspended]: false,
  [problemLibraryColumnIds.topicIds]: false,
  [problemLibraryColumnIds.trackIds]: false,
} as const satisfies ColumnVisibilityState

const defaultPagination = {
  pageIndex: 0,
  pageSize: 20,
} as const satisfies PaginationState
import { problemLibraryTableFeatures } from './problem-library-table-features'

export function useProblemLibraryTable(rows: readonly ProblemLibraryRow[]) {
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [filters, setFiltersState] = useState<ProblemLibraryFilters>(
    defaultProblemLibraryFilters,
  )
  const [pagination, setPagination] =
    useState<PaginationState>(defaultPagination)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [sorting, setSorting] = useState<SortingState>([
    { desc: false, id: problemLibraryColumnIds.title },
  ])
  const columns = useMemo(() => createProblemLibraryColumns(), [])
  const data = useMemo(() => [...rows], [rows])
  const columnFilters = useMemo(
    () => createProblemLibraryColumnFilters(filters),
    [filters],
  )

  const setFilters = useCallback((nextFilters: ProblemLibraryFilters) => {
    setFiltersState(nextFilters)
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 },
    )
  }, [])

  const table = useTable({
    features: problemLibraryTableFeatures,
    columns,
    data,
    enableRowSelection: true,
    enableSortingRemoval: false,
    globalFilterFn: problemLibraryGlobalFilter,
    getRowCanExpand: () => true,
    getRowId: (row) => row.problem.slug,
    onExpandedChange: setSingleExpandedRow,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: {
      columnFilters,
      columnVisibility: hiddenFilterColumns,
      expanded,
      globalFilter: filters.search,
      pagination,
      rowSelection,
      sorting,
    },
  })

  function setSingleExpandedRow(updater: Updater<ExpandedState>) {
    setExpanded((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater

      if (next === true) {
        return current
      }

      const expandedRowIds = Object.keys(next).filter((rowId) => next[rowId])
      const rowId = expandedRowIds[expandedRowIds.length - 1]

      return rowId ? { [rowId]: true } : {}
    })
  }

  return {
    filters,
    setFilters,
    table,
  }
}
