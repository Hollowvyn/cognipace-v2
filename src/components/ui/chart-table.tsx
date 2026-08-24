import type { ReactNode } from 'react'
import { useId, useState } from 'react'

import { cn } from '@/utils/cn'

type ChartTableView = 'chart' | 'table'

export interface ChartTableProps {
  chart: ReactNode
  chartLabel?: string
  className?: string
  defaultView?: ChartTableView
  table: ReactNode
  tableLabel?: string
}

/** A visible, semantic exact-value alternative for a feature-owned chart. */
export function ChartTable({
  chart,
  chartLabel = 'Chart',
  className,
  defaultView = 'chart',
  table,
  tableLabel = 'Table',
}: ChartTableProps) {
  const [view, setView] = useState<ChartTableView>(defaultView)
  const tabListId = useId()
  const chartTabId = `${tabListId}-chart-tab`
  const chartPanelId = `${tabListId}-chart-panel`
  const tableTabId = `${tabListId}-table-tab`
  const tablePanelId = `${tabListId}-table-panel`

  const selectView = (nextView: ChartTableView) => setView(nextView)

  return (
    <div className={cn('grid min-w-0 gap-3', className)}>
      <div aria-label="Chart display" className="flex gap-1" role="tablist">
        <button
          aria-controls={chartPanelId}
          aria-selected={view === 'chart'}
          className={tabClassName(view === 'chart')}
          id={chartTabId}
          onClick={() => selectView('chart')}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault()
              selectView('table')
              document.getElementById(tableTabId)?.focus()
            }
          }}
          role="tab"
          tabIndex={view === 'chart' ? 0 : -1}
          type="button"
        >
          {chartLabel}
        </button>
        <button
          aria-controls={tablePanelId}
          aria-selected={view === 'table'}
          className={tabClassName(view === 'table')}
          id={tableTabId}
          onClick={() => selectView('table')}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault()
              selectView('chart')
              document.getElementById(chartTabId)?.focus()
            }
          }}
          role="tab"
          tabIndex={view === 'table' ? 0 : -1}
          type="button"
        >
          {tableLabel}
        </button>
      </div>
      <div
        aria-labelledby={chartTabId}
        hidden={view !== 'chart'}
        id={chartPanelId}
        role="tabpanel"
      >
        {chart}
      </div>
      <div
        aria-labelledby={tableTabId}
        className="min-w-0 overflow-x-auto"
        hidden={view !== 'table'}
        id={tablePanelId}
        role="tabpanel"
      >
        {table}
      </div>
    </div>
  )
}

function tabClassName(selected: boolean) {
  return cn(
    'rounded-[var(--cp-control-radius)] border px-3 py-2 text-sm font-semibold',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
    selected
      ? 'border-primary bg-primary text-primary-foreground'
      : 'border-border bg-card text-card-foreground hover:bg-muted',
  )
}
