import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'
import type { SerializedAnalyticsSummary } from '@/features/analytics/api/analytics-contracts'
import { metricDefinitions } from '@/features/analytics/domain/metric-definitions'
import { cn } from '@/utils/cn'
import { useState } from 'react'

import { formatDays, formatPercent } from './charts/chart-shared'

type FragileKnowledgeRow =
  SerializedAnalyticsSummary['fragileKnowledge'][number]

export function FragileKnowledgeTable({
  rows,
}: {
  rows: FragileKnowledgeRow[]
}) {
  const [showAll, setShowAll] = useState(false)
  const visibleRows = showAll ? rows : rows.slice(0, 10)
  const titleId = 'fragile-knowledge-title'
  const descriptionId = 'fragile-knowledge-description'

  return (
    <Surface
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="grid min-w-0 gap-4"
      role="region"
    >
      <header className="grid min-w-0 gap-1">
        <h2
          className="m-0 text-[length:var(--cp-section-title-font-size)] font-bold leading-tight text-foreground"
          id={titleId}
        >
          Fragile knowledge
        </h2>
        <p
          className="m-0 max-w-3xl text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground"
          id={descriptionId}
        >
          {metricDefinitions.fragileKnowledge.explanation}
        </p>
      </header>

      {rows.length === 0 ? (
        <InlineStatus>
          No fragile knowledge detected. Keep reviewing to keep this list
          honest.
        </InlineStatus>
      ) : (
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-left text-[length:var(--cp-copy-font-size)]">
            <caption className="sr-only">
              Reviewed problems with fragile memory signals
            </caption>
            <thead>
              <tr className="border-b border-border text-[length:var(--cp-badge-font-size)] uppercase tracking-normal text-muted-foreground">
                <th className="px-2 pb-2" scope="col">
                  Problem
                </th>
                <th className="px-2 pb-2" scope="col">
                  Topics
                </th>
                <th className="px-2 pb-2 text-right" scope="col">
                  Recall
                </th>
                <th className="px-2 pb-2 text-right" scope="col">
                  Stability
                </th>
                <th className="px-2 pb-2 text-right" scope="col">
                  Difficulty
                </th>
                <th className="px-2 pb-2 text-right" scope="col">
                  Lapses
                </th>
                <th className="px-2 pb-2 text-right" scope="col">
                  Overdue
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <FragileKnowledgeTableRow key={row.slug} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 10 ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-[length:var(--cp-badge-font-size)] text-muted-foreground">
            Showing {visibleRows.length} of {rows.length} fragile problems.
          </p>
          <Button
            aria-expanded={showAll}
            onClick={() => {
              setShowAll((current) => !current)
            }}
            size="sm"
            variant="outline"
          >
            {showAll ? 'Show fewer' : `Show ${rows.length - 10} more`}
          </Button>
        </div>
      ) : null}

      <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
        These are signals to investigate, not a diagnosis. Suspended problems
        are excluded.
      </p>
    </Surface>
  )
}

function FragileKnowledgeTableRow({ row }: { row: FragileKnowledgeRow }) {
  return (
    <tr className="border-b border-border align-top last:border-b-0">
      <th className="px-2 py-3 text-left font-medium" scope="row">
        <div className="text-foreground">{row.title}</div>
        <div className="text-[length:var(--cp-badge-font-size)] font-normal text-muted-foreground">
          {row.slug}
        </div>
      </th>
      <td className="px-2 py-3">
        <div className="flex max-w-[12rem] flex-wrap gap-1">
          {row.topics.length > 0 ? (
            row.topics.map((topic) => (
              <Badge key={topic} tone="neutral" variant="outline">
                {topic}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground">Uncategorized</span>
          )}
        </div>
      </td>
      <td className="px-2 py-3 text-right tabular-nums text-foreground">
        {formatPercent(row.retrievability)}
      </td>
      <td className="px-2 py-3 text-right tabular-nums text-foreground">
        {formatDays(row.stabilityDays)}
      </td>
      <td className="px-2 py-3 text-right tabular-nums text-foreground">
        {row.difficulty.toFixed(1)}
      </td>
      <td className="px-2 py-3 text-right tabular-nums text-foreground">
        {row.lapseCount}
      </td>
      <td
        className={cn(
          'px-2 py-3 text-right tabular-nums text-foreground',
          row.overdueDays > 0 &&
            'font-semibold text-[color:var(--cp-tone-warning-fg)]',
        )}
      >
        {row.overdueDays > 0 ? `${row.overdueDays}d` : '—'}
      </td>
    </tr>
  )
}
