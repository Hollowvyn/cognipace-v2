import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'
import type { SerializedAnalyticsSummary } from '@/features/analytics/api/analytics-contracts'
import { metricDefinitions } from '@/features/analytics/domain/metric-definitions'
import { createLeetCodeProblemUrl } from '@/lib/leetcode'
import { cn } from '@/utils/cn'
import { useState } from 'react'

import { formatDays, formatPercent } from './charts/chart-shared'

type FragileKnowledgeRow =
  SerializedAnalyticsSummary['fragileKnowledge'][number]

const pageSize = 5

export function FragileKnowledgeTable({
  rows,
}: {
  rows: FragileKnowledgeRow[]
}) {
  const definition = metricDefinitions.fragileKnowledge
  const [pageIndex, setPageIndex] = useState(0)
  const [previousRows, setPreviousRows] = useState(rows)
  const pageCount = Math.ceil(rows.length / pageSize)
  const needsPageReset = pageIndex >= pageCount

  if (rows !== previousRows) {
    setPreviousRows(rows)
    if (needsPageReset) {
      setPageIndex(0)
    }
  }

  const visiblePageIndex = needsPageReset ? 0 : pageIndex
  const visibleRows = rows.slice(
    visiblePageIndex * pageSize,
    visiblePageIndex * pageSize + pageSize,
  )
  const visibleStart = visiblePageIndex * pageSize + 1
  const visibleEnd = visibleStart + visibleRows.length - 1
  const titleId = 'fragile-knowledge-title'
  const questionId = 'fragile-knowledge-question'
  const descriptionId = 'fragile-knowledge-description'
  const pageStatusId = 'fragile-knowledge-page-status'

  return (
    <Surface
      aria-describedby={`${questionId} ${descriptionId}`}
      aria-labelledby={titleId}
      className="grid min-w-0 gap-4"
      role="region"
    >
      <header className="grid min-w-0 gap-1">
        <h2
          className="m-0 text-[length:var(--cp-section-title-font-size)] font-bold leading-tight text-foreground"
          id={titleId}
        >
          {definition.label}
        </h2>
        <p
          className="m-0 text-[length:var(--cp-copy-font-size)] font-medium leading-relaxed text-foreground"
          id={questionId}
        >
          {definition.question}
        </p>
        <p
          className="m-0 max-w-3xl text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground"
          id={descriptionId}
        >
          {definition.explanation}
        </p>
      </header>

      {rows.length === 0 ? (
        <InlineStatus>
          No fragile knowledge detected. Keep reviewing to keep this list
          honest.
        </InlineStatus>
      ) : (
        <div className="min-w-0 overflow-x-auto">
          <table
            aria-describedby={pageStatusId}
            aria-label={`Fragile knowledge rows ${visibleStart} through ${visibleEnd} of ${rows.length}`}
            className="w-full min-w-[48rem] border-collapse text-left text-[length:var(--cp-copy-font-size)]"
          >
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

      {rows.length > 0 ? (
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
              disabled={visiblePageIndex === 0}
              onClick={() =>
                setPageIndex((current) => Math.max(0, current - 1))
              }
              size="sm"
              variant="outline"
            >
              Previous
            </Button>
            <Button
              aria-label="Next page"
              disabled={visiblePageIndex >= pageCount - 1}
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
      ) : null}

      <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
        {definition.warning}
      </p>
    </Surface>
  )
}

function FragileKnowledgeTableRow({ row }: { row: FragileKnowledgeRow }) {
  return (
    <tr className="border-b border-border align-top last:border-b-0">
      <th className="px-2 py-3 text-left font-medium" scope="row">
        <a
          className="block min-w-0 truncate text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          href={createLeetCodeProblemUrl(row.slug)}
          rel="noopener noreferrer"
          target="_blank"
        >
          {row.title}
        </a>
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
