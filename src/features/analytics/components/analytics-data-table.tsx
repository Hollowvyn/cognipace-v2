import { useId, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

export interface AnalyticsTableColumn<Row> {
  id: string
  header: ReactNode
  numeric?: boolean
  render: (row: Row) => ReactNode
  rowHeader?: boolean
}

export interface AnalyticsDataTableProps<Row> {
  caption: string
  columns: readonly AnalyticsTableColumn<Row>[]
  datasetKey: string
  getRowKey: (row: Row) => string
  pageSize?: number
  rows: readonly Row[]
}

const defaultPageSize = 7

export function AnalyticsDataTable<Row>(props: AnalyticsDataTableProps<Row>) {
  return <AnalyticsDataTableContent key={props.datasetKey} {...props} />
}

function AnalyticsDataTableContent<Row>({
  caption,
  columns,
  getRowKey,
  pageSize = defaultPageSize,
  rows,
}: AnalyticsDataTableProps<Row>) {
  const normalizedPageSize = Math.max(1, Math.floor(pageSize))
  const [pageIndex, setPageIndex] = useState(0)
  const instanceId = useId()
  const pageCount = Math.max(1, Math.ceil(rows.length / normalizedPageSize))
  const activePageIndex = Math.min(pageIndex, pageCount - 1)
  const startOffset = activePageIndex * normalizedPageSize
  const visibleRows = rows.slice(startOffset, startOffset + normalizedPageSize)
  const visibleStart = rows.length === 0 ? 0 : startOffset + 1
  const visibleEnd = rows.length === 0 ? 0 : startOffset + visibleRows.length
  const pageStatusId = `analytics-table-${instanceId}-page-status`

  return (
    <div className="grid min-w-0 gap-3">
      <div className="min-w-0 overflow-x-auto">
        <table
          aria-describedby={pageStatusId}
          aria-label={caption}
          className="w-full min-w-[32rem] border-collapse text-left text-[length:var(--cp-copy-font-size)]"
        >
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border text-[length:var(--cp-badge-font-size)] uppercase tracking-normal text-muted-foreground">
              {columns.map((column) => (
                <th
                  className={cn(
                    'px-2 pb-2 font-semibold',
                    column.numeric && 'text-right',
                  )}
                  key={column.id}
                  scope="col"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                className="border-b border-border align-top last:border-b-0"
                key={getRowKey(row)}
              >
                {columns.map((column) => {
                  const className = cn(
                    'px-2 py-3',
                    column.numeric && 'text-right tabular-nums',
                    column.rowHeader && 'text-left font-medium',
                  )

                  return column.rowHeader ? (
                    <th className={className} key={column.id} scope="row">
                      {column.render(row)}
                    </th>
                  ) : (
                    <td className={className} key={column.id}>
                      {column.render(row)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p
          aria-live="polite"
          className="m-0 text-[length:var(--cp-badge-font-size)] text-muted-foreground"
          id={pageStatusId}
          role="status"
        >
          Showing {visibleStart}–{visibleEnd} of {rows.length}
        </p>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Previous page"
            disabled={activePageIndex === 0}
            onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
            size="sm"
            variant="outline"
          >
            Previous
          </Button>
          <Button
            aria-label="Next page"
            disabled={activePageIndex >= pageCount - 1}
            onClick={() =>
              setPageIndex((current) => Math.min(pageCount - 1, current + 1))
            }
            size="sm"
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
