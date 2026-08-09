import { useState } from 'react'

import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'

import type { ReferenceCurvePoint, RetentionScatterEntry } from '../domain/summary'

const SVG_W = 560
const SVG_H = 200
const PAD_TOP = 10
const PAD_RIGHT = 40
const PAD_BOTTOM = 28
const PAD_LEFT = 30
const CHART_W = SVG_W - PAD_LEFT - PAD_RIGHT
const CHART_H = SVG_H - PAD_TOP - PAD_BOTTOM

function toX(days: number, maxDays: number): number {
  return PAD_LEFT + (maxDays === 0 ? 0 : (days / maxDays) * CHART_W)
}

function toY(retrievability: number): number {
  return PAD_TOP + (1 - retrievability) * CHART_H
}

function dotColor(retrievability: number, targetRetention: number): string {
  if (retrievability >= targetRetention) return '#22c55e'
  if (retrievability >= targetRetention - 0.1) return '#f59e0b'
  return '#ef4444'
}

interface HoveredEntry {
  entry: RetentionScatterEntry
  clientX: number
  clientY: number
}

export function AnalyticsRetentionScatter({
  scatter,
  referenceCurve,
  targetRetention,
}: {
  scatter: RetentionScatterEntry[]
  referenceCurve: ReferenceCurvePoint[]
  targetRetention: number
}) {
  const [hovered, setHovered] = useState<HoveredEntry | null>(null)

  const aboveCount = scatter.filter((e) => e.retrievability >= targetRetention).length
  const belowCount = scatter.length - aboveCount
  const targetPct = Math.round(targetRetention * 100)

  if (scatter.length === 0) {
    return (
      <Surface aria-label="Retention health" className="grid gap-3" role="region">
        <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
          Retention Health
        </div>
        <InlineStatus>
          No reviewed problems yet. Complete some reviews to see retention health.
        </InlineStatus>
      </Surface>
    )
  }

  // ⚡ Bolt: Replace Math.max(...map()) with reduce to prevent call stack exceeded errors and avoid allocating intermediate array
  const maxDays = scatter.reduce((acc, e) => Math.max(acc, e.daysSinceReview), 14)
  const thresholdY = toY(targetRetention)

  const curvePath =
    referenceCurve.length > 0
      ? referenceCurve
          .map((pt, i) => {
            const x = toX(pt.days, maxDays)
            const y = toY(pt.retrievability)
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
          })
          .join(' ')
      : ''

  return (
    <Surface aria-label="Retention health" className="grid gap-3" role="region">
      <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
        Retention Health
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <div className="grid gap-1 rounded-md border border-border p-3">
          <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            Target
          </div>
          <div className="text-3xl font-bold leading-none tabular-nums">{targetPct}%</div>
          <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
            from FSRS settings
          </p>
        </div>
        <div className="grid gap-1 rounded-md border border-border p-3">
          <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            Above
          </div>
          <div className="text-3xl font-bold leading-none tabular-nums">{aboveCount}</div>
          <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
            problems well retained
          </p>
        </div>
        <div className="grid gap-1 rounded-md border border-border p-3">
          <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            Below
          </div>
          <div className="text-3xl font-bold leading-none tabular-nums">{belowCount}</div>
          <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
            problems need review
          </p>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          aria-hidden="true"
          className="w-full"
        >
          {[0.2, 0.4, 0.6, 0.8, 1.0].map((v) => (
            <line
              key={v}
              x1={PAD_LEFT}
              y1={toY(v)}
              x2={SVG_W - PAD_RIGHT}
              y2={toY(v)}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
          ))}

          {[100, 80, 60, 40, 20].map((pct) => (
            <text
              key={pct}
              x={PAD_LEFT - 4}
              y={toY(pct / 100) + 3}
              fill="currentColor"
              fillOpacity={0.4}
              fontSize={8}
              textAnchor="end"
            >
              {pct}%
            </text>
          ))}

          {curvePath !== '' && (
            <path
              d={curvePath}
              fill="none"
              stroke="#7c6af7"
              strokeWidth={1.5}
              strokeDasharray="5,3"
              strokeOpacity={0.6}
            />
          )}

          <line
            x1={PAD_LEFT}
            y1={thresholdY}
            x2={SVG_W - PAD_RIGHT}
            y2={thresholdY}
            stroke="#7c6af7"
            strokeWidth={1.2}
            strokeDasharray="3,3"
            strokeOpacity={0.5}
          />
          <text
            x={SVG_W - PAD_RIGHT + 2}
            y={thresholdY + 3}
            fill="#7c6af7"
            fillOpacity={0.8}
            fontSize={7}
          >
            {targetPct}%
          </text>

          <line
            x1={PAD_LEFT}
            y1={PAD_TOP}
            x2={PAD_LEFT}
            y2={SVG_H - PAD_BOTTOM}
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={1}
          />
          <line
            x1={PAD_LEFT}
            y1={SVG_H - PAD_BOTTOM}
            x2={SVG_W - PAD_RIGHT}
            y2={SVG_H - PAD_BOTTOM}
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={1}
          />

          {scatter.map((entry) => (
            <circle
              key={entry.slug}
              cx={toX(entry.daysSinceReview, maxDays)}
              cy={toY(entry.retrievability)}
              r={5}
              fill={dotColor(entry.retrievability, targetRetention)}
              opacity={0.85}
              data-testid="scatter-dot"
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) =>
                setHovered({ entry, clientX: e.clientX, clientY: e.clientY })
              }
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>

        {hovered !== null && (
          <ScatterTooltip
            entry={hovered.entry}
            targetRetention={targetRetention}
            clientX={hovered.clientX}
            clientY={hovered.clientY}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-[length:var(--cp-badge-font-size)] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full bg-[#22c55e]"
          />
          Above target
        </span>
        <span className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full bg-[#f59e0b]"
          />
          Approaching
        </span>
        <span className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full bg-[#ef4444]"
          />
          Below target
        </span>
      </div>
    </Surface>
  )
}

const tooltipDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function ScatterTooltip({
  entry,
  targetRetention,
  clientX,
  clientY,
}: {
  entry: RetentionScatterEntry
  targetRetention: number
  clientX: number
  clientY: number
}) {
  const pct = Math.round(entry.retrievability * 100)
  const targetPct = Math.round(targetRetention * 100)
  const isBelow = entry.retrievability < targetRetention
  const lastReview = tooltipDateFormatter.format(new Date(entry.lastReviewAt))

  return (
    <div
      className="pointer-events-none fixed z-50 max-w-[220px] rounded-md border border-border bg-popover p-3 text-[length:var(--cp-badge-font-size)] shadow-md"
      style={{ left: clientX + 12, top: clientY - 10 }}
    >
      <div className="mb-1 font-semibold text-foreground">{entry.title}</div>
      <div className="text-muted-foreground">Last review: {lastReview}</div>
      <div className="text-muted-foreground">
        Difficulty: {entry.difficulty.toFixed(1)}
      </div>
      <div className="text-muted-foreground">
        Stability: {entry.stability.toFixed(1)}d
      </div>
      <div className="text-muted-foreground">Lapses: {entry.lapseCount}</div>
      <div className={isBelow ? 'text-destructive' : 'text-[#22c55e]'}>
        {pct}% retrievability{' '}
        {isBelow ? `↓ below ${targetPct}%` : `✓ above ${targetPct}%`}
      </div>
    </div>
  )
}
