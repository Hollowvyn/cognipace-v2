import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import type { AnalyticsEvidence } from '@/features/analytics/domain/analytics-evidence'
import type { AnalyticsViewDefinition } from '@/features/analytics/components/charts/chart-catalogue'
import { cn } from '@/utils/cn'

import { AnalyticsEvidenceStrip } from './analytics-evidence-summary'

type AnalyticsFigureView = 'chart' | 'table'

export interface AnalyticsFigureProps {
  chart: ReactNode
  datasetKey: string
  definition: AnalyticsViewDefinition
  details?: ReactNode
  evidence: AnalyticsEvidence
  table: ReactNode
  takeaway: ReactNode
}

export function AnalyticsFigure({
  chart,
  datasetKey,
  definition,
  details,
  evidence,
  table,
  takeaway,
}: AnalyticsFigureProps) {
  const [view, setView] = useState<AnalyticsFigureView>('chart')
  const chartTabRef = useRef<HTMLButtonElement>(null)
  const tableTabRef = useRef<HTMLButtonElement>(null)
  const chartId = `${definition.id}-chart-panel`
  const tableId = `${definition.id}-table-panel`
  const chartTabId = `${definition.id}-chart-tab`
  const tableTabId = `${definition.id}-table-tab`
  const titleId = `${definition.id}-title`
  const questionId = `${definition.id}-question`
  const meaningId = `${definition.id}-meaning`

  function selectView(nextView: AnalyticsFigureView, focus = false) {
    setView(nextView)
    if (focus) {
      const nextTabRef = nextView === 'chart' ? chartTabRef : tableTabRef
      nextTabRef.current?.focus()
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let nextView: AnalyticsFigureView | undefined

    if (event.key === 'ArrowLeft' || event.key === 'Home') {
      nextView = 'chart'
    }
    if (event.key === 'ArrowRight' || event.key === 'End') {
      nextView = 'table'
    }
    if (!nextView) return

    event.preventDefault()
    selectView(nextView, true)
  }

  return (
    <Surface
      aria-describedby={`${questionId} ${meaningId}`}
      aria-labelledby={titleId}
      className="grid min-w-0 gap-4"
      data-dataset-key={datasetKey}
      role="region"
    >
      <header className="grid min-w-0 gap-1">
        <h2
          className="m-0 text-[length:var(--cp-section-title-font-size)] font-bold leading-tight text-foreground"
          id={titleId}
        >
          {definition.title}
        </h2>
        <p
          className="m-0 text-[length:var(--cp-copy-font-size)] font-medium leading-relaxed text-foreground"
          id={questionId}
        >
          {definition.question}
        </p>
        <p
          className="m-0 max-w-3xl text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground"
          id={meaningId}
        >
          {definition.metricMeaning}
        </p>
      </header>

      <div
        aria-label={`${definition.title} view`}
        className="flex items-center gap-1"
        role="tablist"
      >
        <Button
          aria-controls={chartId}
          aria-selected={view === 'chart'}
          className={cn(view !== 'chart' && 'opacity-70')}
          id={chartTabId}
          onClick={() => selectView('chart')}
          onKeyDown={handleTabKeyDown}
          ref={chartTabRef}
          role="tab"
          size="sm"
          tabIndex={view === 'chart' ? 0 : -1}
          variant={view === 'chart' ? 'secondary' : 'outline'}
        >
          Chart
        </Button>
        <Button
          aria-controls={tableId}
          aria-selected={view === 'table'}
          className={cn(view !== 'table' && 'opacity-70')}
          id={tableTabId}
          onClick={() => selectView('table')}
          onKeyDown={handleTabKeyDown}
          ref={tableTabRef}
          role="tab"
          size="sm"
          tabIndex={view === 'table' ? 0 : -1}
          variant={view === 'table' ? 'secondary' : 'outline'}
        >
          Table
        </Button>
      </div>

      <div
        aria-labelledby={chartTabId}
        hidden={view !== 'chart'}
        id={chartId}
        role="tabpanel"
      >
        {chart}
      </div>
      <div
        aria-labelledby={tableTabId}
        hidden={view !== 'table'}
        id={tableId}
        role="tabpanel"
      >
        {table}
      </div>

      <div className="min-w-0 text-[length:var(--cp-copy-font-size)] leading-relaxed text-foreground">
        {takeaway}
      </div>
      <AnalyticsEvidenceStrip evidence={evidence} />
      {details ? (
        <details className="text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">
            Calculation details
          </summary>
          <div className="pt-2">{details}</div>
        </details>
      ) : null}
    </Surface>
  )
}
