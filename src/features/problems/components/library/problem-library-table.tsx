import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import type { Header, Row, ReactTable } from '@tanstack/react-table'

import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

import type {
  ProblemLibraryOptions,
  ProblemLibraryRow,
} from '../../api/problems-contracts'
import {
  ProblemBulkActionBar,
  type RenderSelectedRowsAction,
} from './problem-bulk-action-bar'
import { problemLibraryColumnIds } from './problem-library-filtering'
import { ProblemLibraryRowDetails } from './problem-library-row-details'
import type { RenderProblemEditAction } from './problem-row-actions'
import type { problemLibraryTableFeatures } from './problem-library-table-features'

export function ProblemLibraryTable({
  options,
  renderEditProblemAction,
  renderSelectedRowsAction,
  table,
}: {
  options: ProblemLibraryOptions
  renderEditProblemAction: RenderProblemEditAction
  renderSelectedRowsAction?: RenderSelectedRowsAction | undefined
  table: ReactTable<typeof problemLibraryTableFeatures, ProblemLibraryRow>
}) {
  const selectedRows = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original)

  return (
    <>
      <div className="overflow-x-auto border-t border-border bg-card">
        <table className="w-full min-w-[58rem] border-collapse text-left text-[length:var(--cp-copy-font-size)]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                className="border-b border-border bg-muted/50 text-[length:var(--cp-badge-font-size)] uppercase tracking-normal text-muted-foreground"
                key={headerGroup.id}
              >
                {headerGroup.headers.map((header) => (
                  <SortableHeader
                    header={header}
                    key={header.id}
                    table={table}
                  />
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <ProblemLibraryTableRow
                key={row.id}
                renderEditProblemAction={renderEditProblemAction}
                row={row}
                table={table}
              />
            ))}
          </tbody>
        </table>
      </div>
      <ProblemLibraryPagination
        bulkActions={
          <ProblemBulkActionBar
            onClearSelection={() => table.resetRowSelection()}
            options={options}
            renderSelectedRowsAction={renderSelectedRowsAction}
            selectedRows={selectedRows}
          />
        }
        table={table}
      />
    </>
  )
}

function SortableHeader({
  header,
  table,
}: {
  table: ReactTable<typeof problemLibraryTableFeatures, ProblemLibraryRow>
  header: Header<typeof problemLibraryTableFeatures, ProblemLibraryRow, unknown>
}) {
  const sortDirection = header.column.getIsSorted()
  const canSort = header.column.getCanSort()

  return (
    <th
      aria-sort={
        sortDirection
          ? sortDirection === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none'
      }
      className={getHeaderClassName(header.column.id)}
      scope="col"
    >
      {header.isPlaceholder ? null : canSort ? (
        <button
          className="inline-flex items-center gap-1 rounded-[var(--cp-radius-sm)] text-left uppercase hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onClick={header.column.getToggleSortingHandler()}
          type="button"
        >
          <table.FlexRender header={header} />
          {sortDirection ? (
            sortDirection === 'asc' ? (
              <ArrowUp aria-hidden="true" className="size-3" />
            ) : (
              <ArrowDown aria-hidden="true" className="size-3" />
            )
          ) : null}
        </button>
      ) : (
        <table.FlexRender header={header} />
      )}
    </th>
  )
}

function ProblemLibraryTableRow({
  table,
  renderEditProblemAction,
  row,
}: {
  renderEditProblemAction: RenderProblemEditAction
  table: ReactTable<typeof problemLibraryTableFeatures, ProblemLibraryRow>
  row: Row<typeof problemLibraryTableFeatures, ProblemLibraryRow>
}) {
  function handleRowClick(event: MouseEvent<HTMLTableRowElement>) {
    if (shouldIgnoreRowExpansionClick(event.target)) {
      return
    }

    row.toggleExpanded()
  }

  return (
    <>
      <tr
        className={cn(
          'cursor-pointer border-b border-border transition-colors hover:bg-muted/45',
          row.getIsExpanded() && 'bg-muted/55',
        )}
        onClick={handleRowClick}
      >
        {row.getVisibleCells().map((cell) =>
          cell.column.id === problemLibraryColumnIds.title ? (
            <th
              className={getCellClassName(cell.column.id)}
              key={cell.id}
              scope="row"
            >
              <table.FlexRender cell={cell} />
            </th>
          ) : (
            <td className={getCellClassName(cell.column.id)} key={cell.id}>
              <table.FlexRender cell={cell} />
            </td>
          ),
        )}
      </tr>
      {row.getIsExpanded() ? (
        <tr className="border-b border-border bg-background/35">
          <td
            className="px-6 py-5 md:px-8"
            colSpan={row.getVisibleCells().length}
          >
            <ProblemLibraryRowDetails
              renderEditProblemAction={renderEditProblemAction}
              row={row.original}
            />
          </td>
        </tr>
      ) : null}
    </>
  )
}

function shouldIgnoreRowExpansionClick(target: EventTarget) {
  if (!(target instanceof Element)) {
    return false
  }

  return Boolean(
    target.closest(
      'a,button,input,label,select,textarea,[role="button"],[role="link"]',
    ),
  )
}

function getHeaderClassName(columnId: string) {
  if (
    columnId === problemLibraryColumnIds.selection ||
    columnId === problemLibraryColumnIds.expander
  ) {
    return 'w-10 px-4 py-2.5 text-center font-semibold'
  }

  return 'px-3 py-2.5 font-semibold'
}

function getCellClassName(columnId: string) {
  switch (columnId) {
    case problemLibraryColumnIds.selection:
    case problemLibraryColumnIds.expander:
      return 'px-4 py-2.5 text-center align-middle'
    case problemLibraryColumnIds.title:
      return 'max-w-[22rem] px-3 py-2.5 align-middle'
    case problemLibraryColumnIds.retention:
    case problemLibraryColumnIds.lastReviewedAt:
    case problemLibraryColumnIds.nextReviewAt:
      return 'whitespace-nowrap px-3 py-2.5 align-middle'
    default:
      return 'px-3 py-2.5 align-middle'
  }
}

function ProblemLibraryPagination({
  bulkActions,
  table,
}: {
  bulkActions: ReactNode
  table: ReactTable<typeof problemLibraryTableFeatures, ProblemLibraryRow>
}) {
  const filteredCount = table.getFilteredRowModel().rows.length
  const { pageIndex, pageSize } = table.state.pagination
  const firstRow = filteredCount === 0 ? 0 : pageIndex * pageSize + 1
  const lastRow = Math.min(filteredCount, (pageIndex + 1) * pageSize)

  if (filteredCount === 0) {
    return null
  }

  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-4 py-2 text-[length:var(--cp-copy-font-size)] text-muted-foreground md:px-5">
      <div className="min-w-0 flex-1">{bulkActions}</div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <label className="inline-flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            aria-label="Rows per page"
            className="h-8 rounded-[var(--cp-control-radius)] border border-border bg-background px-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onChange={(event) => {
              table.setPageSize(Number(event.target.value))
            }}
            value={pageSize}
          >
            {[20, 30, 50].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <span className="min-w-28 text-right tabular-nums">
          {firstRow}-{lastRow} of {filteredCount}
        </span>
        <div className="inline-flex items-center gap-1">
          <Button
            aria-label="Previous page"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            size="icon"
            variant="ghost"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            aria-label="Next page"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            size="icon"
            variant="ghost"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}
