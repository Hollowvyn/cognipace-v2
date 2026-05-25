# Tracks Progress Target Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish Tracks progress and target-date presentation across `/tracks`, track create/edit modals, and popup without changing queue or FSRS scheduling behavior.

**Architecture:** Add one pure Tracks-owned target-status helper, then reuse it in the Tracks screen and popup view-model layer. Keep server cache in React Query/runtime responses, persisted state in SQLite, form state in the existing reducer, and URL modal state in existing routes.

**Tech Stack:** React, TypeScript, TanStack Query, Vitest, React Testing Library, native `input[type="date"]`, lucide icons, existing CogniPace UI primitives/tokens.

---

## File Structure

- Create `src/features/tracks/domain/track-target-status.ts`
  - Owns calendar-date parsing, date-only comparison, target status derivation, date labels, popup labels, catalog labels, and date-input validation helpers.
- Create `src/features/tracks/domain/track-target-status.test.ts`
  - Covers status derivation, complete-overdue precedence, UTC-midnight date-only behavior, and date-input validation helpers.
- Modify `src/features/tracks/domain/index.ts`
  - Exports the target-status helper and safe public types.
- Modify `src/features/tracks/index.ts`
  - Re-exports helper/types through the public feature barrel for app-shell popup view code.
- Modify `src/features/tracks/components/tracks-screen.tsx`
  - Passes `workspace.generatedAt` to active workspace and all-tracks accordion.
- Modify `src/features/tracks/components/active-track-workspace.tsx`
  - Replaces old header progress/date rendering with equal-weight Progress and Target summary panels.
  - Keeps `Due Reviews` and `Next` operational metrics below the summary panels.
- Modify `src/features/tracks/components/other-tracks-accordion.tsx`
  - Uses compact progress ring and target metadata in all-tracks rows.
- Modify `src/features/tracks/components/tracks-screen.test.tsx`
  - Updates active header expectations and adds target metadata coverage.
- Modify `src/features/tracks/hooks/use-track-form.ts`
  - Adds original target-date tracking and create/edit date validation.
- Modify `src/features/tracks/components/track-form.tsx`
  - Adds min date, clear control, helper copy, and target-date validation display.
- Modify `src/features/tracks/components/track-form.test.tsx`
  - Adds create/edit target-date validation and clear tests.
- Modify `src/features/app-shell/domain/popup-app-shell.ts`
  - Derives compact target badge text/tone in the popup view model.
- Modify `src/app/popup/components/study-mode-card.tsx`
  - Replaces full due-date badge with compact target-status badge.
- Modify `src/app/popup/popup-shell.test.tsx`
  - Updates popup active-track badge expectations and verifies free practice still hides target/progress.

## Task 1: Tracks Target Status Helper

**Files:**
- Create: `src/features/tracks/domain/track-target-status.ts`
- Create: `src/features/tracks/domain/track-target-status.test.ts`
- Modify: `src/features/tracks/domain/index.ts`
- Modify: `src/features/tracks/index.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `src/features/tracks/domain/track-target-status.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import {
  getDateInputMin,
  getTodayDateInputValue,
  getTrackTargetStatus,
  isPastDateInputValue,
} from './track-target-status'

const generatedAt = '2026-05-25T16:30:00.000Z'

describe('getTrackTargetStatus', () => {
  it('returns none when no target date exists', () => {
    expect(
      getTrackTargetStatus({
        dueAt: null,
        generatedAt,
        progress: { completedCount: 0, totalCount: 10, percent: 0 },
      }),
    ).toMatchObject({
      hasTarget: false,
      kind: 'none',
      dateLabel: null,
      compactDateLabel: null,
      statusLabel: null,
      detailLabel: null,
      catalogLabel: null,
      popupLabel: null,
      tone: 'neutral',
    })
  })

  it('labels upcoming target dates with days left', () => {
    expect(
      getTrackTargetStatus({
        dueAt: '2026-06-15T00:00:00.000Z',
        generatedAt,
        progress: { completedCount: 17, totalCount: 101, percent: 17 },
      }),
    ).toMatchObject({
      hasTarget: true,
      kind: 'upcoming',
      dateLabel: 'Jun 15, 2026',
      compactDateLabel: 'Jun 15',
      statusLabel: '21 days left',
      detailLabel: null,
      catalogLabel: 'Target Jun 15 · 21 days left',
      popupLabel: '21 days left',
      tone: 'success',
    })
  })

  it('labels target dates due today', () => {
    expect(
      getTrackTargetStatus({
        dueAt: '2026-05-25T00:00:00.000Z',
        generatedAt,
        progress: { completedCount: 2, totalCount: 5, percent: 40 },
      }),
    ).toMatchObject({
      kind: 'due-today',
      dateLabel: 'May 25, 2026',
      statusLabel: 'Due today',
      catalogLabel: 'Target May 25 · Due today',
      popupLabel: 'Due today',
      tone: 'warning',
    })
  })

  it('labels overdue target dates with days late', () => {
    expect(
      getTrackTargetStatus({
        dueAt: '2026-05-21T00:00:00.000Z',
        generatedAt,
        progress: { completedCount: 17, totalCount: 101, percent: 17 },
      }),
    ).toMatchObject({
      kind: 'overdue',
      dateLabel: 'May 21, 2026',
      statusLabel: 'Overdue',
      detailLabel: '4 days late',
      catalogLabel: 'Target May 21 · Overdue · 4 days late',
      popupLabel: 'Overdue',
      tone: 'danger',
    })
  })

  it('lets completed tracks win over overdue target dates', () => {
    expect(
      getTrackTargetStatus({
        dueAt: '2026-05-21T00:00:00.000Z',
        generatedAt,
        progress: { completedCount: 10, totalCount: 10, percent: 100 },
      }),
    ).toMatchObject({
      kind: 'complete',
      statusLabel: 'Complete',
      detailLabel: null,
      catalogLabel: 'Target May 21 · Complete',
      popupLabel: 'Complete',
      tone: 'success',
    })
  })

  it('uses date-only comparisons for UTC-midnight persisted dates', () => {
    expect(
      getTrackTargetStatus({
        dueAt: '2026-05-25T00:00:00.000Z',
        generatedAt: '2026-05-25T23:59:59.000Z',
        progress: { completedCount: 0, totalCount: 1, percent: 0 },
      }),
    ).toMatchObject({
      kind: 'due-today',
      dateLabel: 'May 25, 2026',
    })
  })
})

describe('date input helpers', () => {
  it('formats today for date inputs in UTC date-key form', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-25T16:30:00.000Z'))

    expect(getTodayDateInputValue()).toBe('2026-05-25')

    vi.useRealTimers()
  })

  it('detects past date input values by calendar date', () => {
    const now = new Date('2026-05-25T16:30:00.000Z')

    expect(isPastDateInputValue('2026-05-24', now)).toBe(true)
    expect(isPastDateInputValue('2026-05-25', now)).toBe(false)
    expect(isPastDateInputValue('2026-05-26', now)).toBe(false)
  })

  it('does not set a native min that invalidates an unchanged saved past date', () => {
    const now = new Date('2026-05-25T16:30:00.000Z')

    expect(getDateInputMin('2026-05-21', '2026-05-21', now)).toBeUndefined()
    expect(getDateInputMin('2026-05-22', '2026-05-21', now)).toBe('2026-05-25')
    expect(getDateInputMin('', '2026-05-21', now)).toBe('2026-05-25')
  })
})
```

- [ ] **Step 2: Run helper tests and verify they fail**

Run:

```bash
npm run test -- src/features/tracks/domain/track-target-status.test.ts
```

Expected: fail because `track-target-status.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/features/tracks/domain/track-target-status.ts`:

```ts
import type { TrackProgress } from './track'

export type TrackTargetStatusKind =
  | 'none'
  | 'upcoming'
  | 'due-today'
  | 'overdue'
  | 'complete'

export type TrackTargetStatusTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'

export interface TrackTargetStatus {
  catalogLabel: string | null
  compactDateLabel: string | null
  dateLabel: string | null
  daysDelta: number | null
  detailLabel: string | null
  hasTarget: boolean
  kind: TrackTargetStatusKind
  popupLabel: string | null
  statusLabel: string | null
  tone: TrackTargetStatusTone
}

export interface TrackTargetStatusInput {
  dueAt: string | null
  generatedAt: string
  progress: Pick<TrackProgress, 'completedCount' | 'percent' | 'totalCount'>
}

type DateKey = {
  day: number
  month: number
  value: string
  year: number
}

const dateKeyPattern = /^(\d{4})-(\d{2})-(\d{2})/
const dayMs = 24 * 60 * 60 * 1000

export function getTrackTargetStatus({
  dueAt,
  generatedAt,
  progress,
}: TrackTargetStatusInput): TrackTargetStatus {
  const targetKey = parseDateKey(dueAt)

  if (!targetKey) {
    return {
      catalogLabel: null,
      compactDateLabel: null,
      dateLabel: null,
      daysDelta: null,
      detailLabel: null,
      hasTarget: false,
      kind: 'none',
      popupLabel: null,
      statusLabel: null,
      tone: 'neutral',
    }
  }

  const generatedKey = parseDateKey(generatedAt) ?? parseDateKey(new Date().toISOString())
  const daysDelta = generatedKey
    ? dateKeyToDayNumber(targetKey) - dateKeyToDayNumber(generatedKey)
    : 0
  const dateLabel = formatDateKey(targetKey, { includeYear: true })
  const compactDateLabel = formatDateKey(targetKey, { includeYear: false })

  if (
    progress.totalCount > 0 &&
    (progress.percent === 100 ||
      progress.completedCount === progress.totalCount)
  ) {
    return createTargetStatus({
      compactDateLabel,
      dateLabel,
      daysDelta,
      detailLabel: null,
      kind: 'complete',
      statusLabel: 'Complete',
      tone: 'success',
    })
  }

  if (daysDelta < 0) {
    return createTargetStatus({
      compactDateLabel,
      dateLabel,
      daysDelta,
      detailLabel: `${Math.abs(daysDelta)} ${pluralize('day', Math.abs(daysDelta))} late`,
      kind: 'overdue',
      statusLabel: 'Overdue',
      tone: 'danger',
    })
  }

  if (daysDelta === 0) {
    return createTargetStatus({
      compactDateLabel,
      dateLabel,
      daysDelta,
      detailLabel: null,
      kind: 'due-today',
      statusLabel: 'Due today',
      tone: 'warning',
    })
  }

  return createTargetStatus({
    compactDateLabel,
    dateLabel,
    daysDelta,
    detailLabel: null,
    kind: 'upcoming',
    statusLabel: `${daysDelta} ${pluralize('day', daysDelta)} left`,
    tone: 'success',
  })
}

export function getTodayDateInputValue(now = new Date()) {
  return toDateInputValue(now.toISOString())
}

export function isPastDateInputValue(value: string, now = new Date()) {
  const candidateKey = parseDateKey(value)
  const todayKey = parseDateKey(now.toISOString())

  if (!candidateKey || !todayKey) {
    return false
  }

  return dateKeyToDayNumber(candidateKey) < dateKeyToDayNumber(todayKey)
}

export function getDateInputMin(
  currentValue: string,
  initialValue: string,
  now = new Date(),
) {
  if (
    currentValue.length > 0 &&
    currentValue === initialValue &&
    isPastDateInputValue(currentValue, now)
  ) {
    return undefined
  }

  return getTodayDateInputValue(now)
}

export function toDateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : ''
}

function createTargetStatus({
  compactDateLabel,
  dateLabel,
  daysDelta,
  detailLabel,
  kind,
  statusLabel,
  tone,
}: {
  compactDateLabel: string
  dateLabel: string
  daysDelta: number
  detailLabel: string | null
  kind: Exclude<TrackTargetStatusKind, 'none'>
  statusLabel: string
  tone: TrackTargetStatusTone
}): TrackTargetStatus {
  const catalogParts = [`Target ${compactDateLabel}`, statusLabel]

  if (detailLabel) {
    catalogParts.push(detailLabel)
  }

  return {
    catalogLabel: catalogParts.join(' · '),
    compactDateLabel,
    dateLabel,
    daysDelta,
    detailLabel,
    hasTarget: true,
    kind,
    popupLabel: statusLabel,
    statusLabel,
    tone,
  }
}

function parseDateKey(value: string | null | undefined): DateKey | null {
  const match = value?.match(dateKeyPattern)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  return {
    day,
    month,
    value: `${match[1]}-${match[2]}-${match[3]}`,
    year,
  }
}

function dateKeyToDayNumber(dateKey: DateKey) {
  return Date.UTC(dateKey.year, dateKey.month - 1, dateKey.day) / dayMs
}

function formatDateKey(
  dateKey: DateKey,
  { includeYear }: { includeYear: boolean },
) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    ...(includeYear ? { year: 'numeric' } : {}),
  }).format(new Date(Date.UTC(dateKey.year, dateKey.month - 1, dateKey.day)))
}

function pluralize(unit: string, count: number) {
  return count === 1 ? unit : `${unit}s`
}
```

- [ ] **Step 4: Export the helper through Tracks domain and feature barrels**

Modify `src/features/tracks/domain/index.ts`:

```ts
export type { ActiveTrack, Track, TrackGroup, TrackProgress } from './track'
export {
  getDateInputMin,
  getTodayDateInputValue,
  getTrackTargetStatus,
  isPastDateInputValue,
  toDateInputValue,
  type TrackTargetStatus,
  type TrackTargetStatusInput,
  type TrackTargetStatusKind,
  type TrackTargetStatusTone,
} from './track-target-status'
```

Modify the first export line in `src/features/tracks/index.ts`:

```ts
export type { ActiveTrack, Track, TrackGroup, TrackProgress } from './domain'
export {
  getDateInputMin,
  getTodayDateInputValue,
  getTrackTargetStatus,
  isPastDateInputValue,
  toDateInputValue,
  type TrackTargetStatus,
  type TrackTargetStatusInput,
  type TrackTargetStatusKind,
  type TrackTargetStatusTone,
} from './domain'
```

- [ ] **Step 5: Run helper tests and commit**

Run:

```bash
npm run test -- src/features/tracks/domain/track-target-status.test.ts
```

Expected: pass.

Commit:

```bash
git add src/features/tracks/domain/track-target-status.ts src/features/tracks/domain/track-target-status.test.ts src/features/tracks/domain/index.ts src/features/tracks/index.ts
git commit -m "feat: add track target status helper"
```

## Task 2: Tracks Screen Progress And Target UI

**Files:**
- Modify: `src/features/tracks/components/tracks-screen.tsx`
- Modify: `src/features/tracks/components/active-track-workspace.tsx`
- Modify: `src/features/tracks/components/other-tracks-accordion.tsx`
- Modify: `src/features/tracks/components/tracks-screen.test.tsx`

- [ ] **Step 1: Update Tracks screen tests first**

In `src/features/tracks/components/tracks-screen.test.tsx`, update the active workspace test so it expects the summary panels and no duplicated old progress metric:

```ts
expect(screen.getByRole('region', { name: 'Progress summary' })).toBeVisible()
expect(screen.getByText('1 of 3')).toBeVisible()
expect(screen.getByText('2 problems left')).toBeVisible()
expect(screen.queryByLabelText('Progress metric')).not.toBeInTheDocument()
const dueMetric = screen.getByLabelText('Due reviews metric')
expect(within(dueMetric).getByText('Due Reviews')).toBeVisible()
expect(dueMetric).toHaveTextContent('2')
expect(screen.getByLabelText('Next metric')).toHaveTextContent('Two Sum')
```

Replace the date-only test expectations with target status copy:

```ts
expect(await screen.findByText('Target')).toBeVisible()
expect(screen.getByText('Jun 15, 2026')).toBeVisible()
expect(screen.getByText('14 days left')).toBeVisible()

await userEvent.click(screen.getByRole('button', { name: 'Show all tracks' }))

expect(screen.getByText('Target Jun 15 · 14 days left')).toBeVisible()
```

Add an overdue all-tracks row expectation:

```ts
const overdueTarget = screen.getByText(
  'Target May 21 · Overdue · 11 days late',
)

expect(overdueTarget).toBeVisible()
expect(overdueTarget).toHaveAttribute('data-cp-tone', 'danger')
```

- [ ] **Step 2: Run Tracks screen tests and verify they fail**

Run:

```bash
npm run test -- src/features/tracks/components/tracks-screen.test.tsx
```

Expected: fail because the UI still renders the old `Due Jun 15, 2026` line and old Progress metric.

- [ ] **Step 3: Pass `generatedAt` through Tracks screen**

Modify both `OtherTracksAccordion` calls and the `ActiveTrackWorkspace` call in `src/features/tracks/components/tracks-screen.tsx`:

```tsx
<ActiveTrackWorkspace
  activeTrack={workspace.activeTrack}
  dueCount={workspace.dueCount}
  generatedAt={workspace.generatedAt}
  groups={workspace.activeTrackGroups}
  renderEditProblemAction={renderEditProblemAction}
  renderEditTrackAction={renderEditTrackAction}
  rows={workspace.activeTrackRows}
/>
<OtherTracksAccordion
  activeTrackId={workspace.activeTrack.track.id}
  generatedAt={workspace.generatedAt}
  newTrackAction={newTrackAction}
  renderEditTrackAction={renderEditTrackAction}
  tracks={workspace.tracks}
/>
```

Also pass `generatedAt={workspace.generatedAt}` in the no-active-track branch.

- [ ] **Step 4: Replace the active header summary area**

Modify imports in `src/features/tracks/components/active-track-workspace.tsx`:

```ts
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ListChecks,
} from 'lucide-react'
import { type CSSProperties, useState, type ReactNode } from 'react'
import { getTrackTargetStatus, type TrackTargetStatus } from '../domain'
```

Add `generatedAt` to `ActiveTrackWorkspace` props and pass it to `ActiveTrackHeader`.

Replace the due-date paragraph and old three-column metric grid in `ActiveTrackHeader` with:

```tsx
const targetStatus = getTrackTargetStatus({
  dueAt: activeTrack.track.dueAt,
  generatedAt,
  progress: activeTrack.progress,
})

return (
  <div className="grid gap-4 px-4 pb-4 pt-4 md:px-5 lg:px-7 lg:py-5">
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
      <div className="min-w-0">
        <h2 className="m-0 break-words text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
          {activeTrack.track.title}
        </h2>
        {activeTrack.track.description ? (
          <p className="m-0 mt-2 max-w-3xl break-words text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
            {activeTrack.track.description}
          </p>
        ) : null}
      </div>
      <TrackActions
        ariaLabel={`${activeTrack.track.title} track actions`}
        className="justify-start md:justify-end"
        renderEditTrackAction={renderEditTrackAction}
        showClearActive
        track={activeTrack.track}
      />
    </div>
    <div
      className={cn(
        'grid gap-3',
        targetStatus.hasTarget
          ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
          : 'grid-cols-1',
      )}
    >
      <ProgressSummaryPanel progress={activeTrack.progress} />
      {targetStatus.hasTarget ? (
        <TargetSummaryPanel status={targetStatus} />
      ) : null}
    </div>
    <div className="grid gap-3 border-y border-border py-3 sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-border">
      <MetricBlock
        ariaLabel="Due reviews metric"
        icon={<CalendarClock aria-hidden="true" />}
        label="Due Reviews"
        value={<span className="tabular-nums">{dueCount}</span>}
      />
      <MetricBlock
        ariaLabel="Next metric"
        icon={<ListChecks aria-hidden="true" />}
        label="Next"
        value={
          activeTrack.nextProblem ? (
            <a
              className="truncate font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href={createLeetCodeProblemUrl(activeTrack.nextProblem.slug)}
              rel="noreferrer"
              target="_blank"
            >
              {activeTrack.nextProblem.title}
            </a>
          ) : (
            <span className="text-muted-foreground">None</span>
          )
        }
      />
    </div>
  </div>
)
```

Add these local components below `MetricBlock`:

```tsx
function ProgressSummaryPanel({
  progress,
}: {
  progress: NonNullable<SerializedActiveTrack>['progress']
}) {
  const remainingCount = Math.max(
    progress.totalCount - progress.completedCount,
    0,
  )

  return (
    <section
      aria-label="Progress summary"
      className="grid min-h-24 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[var(--cp-radius-md)] border border-border bg-muted/40 p-3"
    >
      <ProgressRing percent={progress.percent} />
      <div className="min-w-0">
        <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
          Progress
        </p>
        <p className="m-0 mt-1 truncate text-[length:var(--cp-copy-font-size)] font-bold text-foreground">
          {progress.completedCount} of {progress.totalCount}
        </p>
        <p className="m-0 mt-1 truncate text-[length:var(--cp-badge-font-size)] font-semibold text-muted-foreground">
          {remainingCount} {remainingCount === 1 ? 'problem' : 'problems'} left
        </p>
      </div>
    </section>
  )
}

function TargetSummaryPanel({ status }: { status: TrackTargetStatus }) {
  const isOverdue = status.kind === 'overdue'

  return (
    <section
      aria-label="Target summary"
      className={cn(
        'grid min-h-24 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[var(--cp-radius-md)] border border-border bg-muted/40 p-3',
        isOverdue &&
          'border-destructive/40 bg-destructive/10 shadow-[inset_3px_0_0_var(--cp-color-danger)]',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-10 place-items-center rounded-full border border-border text-muted-foreground',
          isOverdue && 'border-destructive/40 text-destructive',
        )}
      >
        <CalendarDays className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
          Target
        </p>
        <p className="m-0 mt-1 truncate text-[length:var(--cp-copy-font-size)] font-bold text-foreground">
          {status.dateLabel}
        </p>
        <p
          className={cn(
            'm-0 mt-1 truncate text-[length:var(--cp-badge-font-size)] font-bold',
            isOverdue ? 'text-destructive' : 'text-primary',
          )}
        >
          {status.statusLabel}
          {status.detailLabel ? (
            <span className="text-muted-foreground"> · {status.detailLabel}</span>
          ) : null}
        </p>
      </div>
    </section>
  )
}

function ProgressRing({ percent }: { percent: number }) {
  const normalizedPercent = Math.min(Math.max(percent, 0), 100)
  const style = {
    background: `radial-gradient(circle at center, var(--card) 55%, transparent 57%), conic-gradient(var(--primary) ${normalizedPercent}%, var(--muted) 0)`,
  } satisfies CSSProperties

  return (
    <span
      aria-hidden="true"
      className="grid size-12 shrink-0 place-items-center rounded-full text-[0.75rem] font-bold tabular-nums text-foreground"
      style={style}
    >
      {normalizedPercent}%
    </span>
  )
}
```

Delete the old local `formatDateCell` function from this file.

- [ ] **Step 5: Update all-tracks rows**

Modify `src/features/tracks/components/other-tracks-accordion.tsx` imports:

```ts
import { CalendarDays, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { getTrackTargetStatus } from '../domain'
```

Add `generatedAt` to `OtherTracksAccordion` props and pass it into `OtherTrackRow`.

Inside `OtherTrackRow`, derive target status:

```ts
const targetStatus = getTrackTargetStatus({
  dueAt: row.track.dueAt,
  generatedAt,
  progress: row.progress,
})
```

Replace the metadata row with:

```tsx
<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[length:var(--cp-badge-font-size)] text-muted-foreground">
  <ProgressText row={row} />
  <span>{row.progress.totalCount} problems</span>
  {targetStatus.catalogLabel ? (
    <span
      data-cp-tone={
        targetStatus.kind === 'overdue' ? 'danger' : undefined
      }
      className={cn(
        'inline-flex items-center gap-1',
        targetStatus.kind === 'overdue' && 'text-destructive',
      )}
    >
      <CalendarDays aria-hidden="true" className="size-3.5" />
      {targetStatus.catalogLabel}
    </span>
  ) : null}
</div>
```

Replace `ProgressText` with a tiny circular indicator:

```tsx
function ProgressText({ row }: { row: SerializedTrackWorkspaceRow }) {
  const style = {
    background: `radial-gradient(circle at center, var(--card) 52%, transparent 54%), conic-gradient(var(--primary) ${row.progress.percent}%, var(--muted) 0)`,
  } satisfies CSSProperties

  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className="size-4 rounded-full" style={style} />
      <span className="tabular-nums">
        {row.progress.completedCount} of {row.progress.totalCount}
      </span>
    </span>
  )
}
```

Add `type CSSProperties` to the React import. Delete `formatDateCell`.

- [ ] **Step 6: Run Tracks screen tests and commit**

Run:

```bash
npm run test -- src/features/tracks/components/tracks-screen.test.tsx
```

Expected: pass.

Commit:

```bash
git add src/features/tracks/components/tracks-screen.tsx src/features/tracks/components/active-track-workspace.tsx src/features/tracks/components/other-tracks-accordion.tsx src/features/tracks/components/tracks-screen.test.tsx
git commit -m "feat: polish track progress and target summaries"
```

## Task 3: Track Form Date Input Behavior

**Files:**
- Modify: `src/features/tracks/hooks/use-track-form.ts`
- Modify: `src/features/tracks/components/track-form.tsx`
- Modify: `src/features/tracks/components/track-form.test.tsx`

- [ ] **Step 1: Add failing form tests**

In `src/features/tracks/components/track-form.test.tsx`, add `afterEach` to the Vitest import:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
```

Then add `afterEach` and keep the existing `beforeEach` focused on mocks:

```ts
beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})
```

Add tests:

```ts
it('blocks past target dates in create mode', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-25T16:30:00.000Z'))
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  mockTrackFormRuntime(createTrackDefaults())

  renderTrackForm(
    <TrackForm mode="create" onCancel={vi.fn()} onSaved={vi.fn()} />,
  )

  await user.type(await screen.findByLabelText('Title'), 'Past Target')
  await user.type(screen.getByLabelText('Target date'), '2026-05-21')
  await user.click(screen.getByRole('button', { name: 'SAVE' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Target date must be today or later.',
  )
  expect(sendMessage).not.toHaveBeenCalledWith(
    'tracks.createTrack',
    expect.anything(),
  )
})

it('allows an unchanged saved past target date in edit mode', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-25T16:30:00.000Z'))
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  mockTrackFormRuntime(
    createTrackForEditResponse({
      track: createSerializedTrack({
        description: 'Past target.',
        dueAt: '2026-05-21T00:00:00.000Z',
        id: 'past-track',
        slug: 'past-track',
        title: 'Past Track',
      }),
      groups: [
        {
          id: 'past-track:main',
          position: 1,
          problemSlugs: [],
          title: 'Main',
          trackId: 'past-track',
        },
      ],
      problemRows: [],
    }),
  )

  renderTrackForm(
    <TrackForm
      mode="edit"
      onCancel={vi.fn()}
      onLoaded={vi.fn()}
      onSaved={vi.fn()}
      trackId="past-track"
    />,
  )

  await user.clear(await screen.findByLabelText('Description'))
  await user.type(screen.getByLabelText('Description'), 'Updated only')
  await user.click(screen.getByRole('button', { name: 'SAVE' }))

  await waitFor(() => {
    expect(sendMessage).toHaveBeenCalledWith(
      'tracks.updateTrack',
      expect.objectContaining({
        dueAt: '2026-05-21T00:00:00.000Z',
      }),
    )
  })
})

it('blocks newly changed past target dates in edit mode', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-25T16:30:00.000Z'))
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  mockTrackFormRuntime(createEditResponse())

  renderTrackForm(
    <TrackForm
      mode="edit"
      onCancel={vi.fn()}
      onLoaded={vi.fn()}
      onSaved={vi.fn()}
      trackId="leetcode-75"
    />,
  )

  await user.clear(await screen.findByLabelText('Target date'))
  await user.type(screen.getByLabelText('Target date'), '2026-05-21')
  await user.click(screen.getByRole('button', { name: 'SAVE' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Target date must be today or later.',
  )
  expect(sendMessage).not.toHaveBeenCalledWith(
    'tracks.updateTrack',
    expect.anything(),
  )
})

it('clears a target date from the form', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-25T16:30:00.000Z'))
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  mockTrackFormRuntime(createEditResponse())

  renderTrackForm(
    <TrackForm
      mode="edit"
      onCancel={vi.fn()}
      onLoaded={vi.fn()}
      onSaved={vi.fn()}
      trackId="leetcode-75"
    />,
  )

  await screen.findByDisplayValue('2026-06-15')
  await user.click(screen.getByRole('button', { name: 'Clear target date' }))
  await user.click(screen.getByRole('button', { name: 'SAVE' }))

  await waitFor(() => {
    expect(sendMessage).toHaveBeenCalledWith(
      'tracks.updateTrack',
      expect.objectContaining({
        dueAt: null,
      }),
    )
  })
})
```

- [ ] **Step 2: Run form tests and verify they fail**

Run:

```bash
npm run test -- src/features/tracks/components/track-form.test.tsx
```

Expected: fail because past-date validation, clear control, and helper copy are missing.

- [ ] **Step 3: Add target-date validation to the form hook**

Modify imports in `src/features/tracks/hooks/use-track-form.ts`:

```ts
import {
  isPastDateInputValue,
  toDateInputValue,
} from '../domain'
```

Add `initialDueAt` to `TrackFormState`:

```ts
export interface TrackFormState {
  description: string
  dueAt: string
  groupBy: TrackFormGroupBy
  groups: TrackFormGroupState[]
  initialDueAt: string
  nextGroupNumber: number
  selectedGroupKey: string
  setActiveAfterCreate: boolean
  title: string
}
```

Add `dueAt` to `TrackFormFieldErrors`:

```ts
export interface TrackFormFieldErrors {
  dueAt: string | null
  groupTitles: Record<string, string>
  groups: string | null
  problemSlugs: string | null
  title: string | null
}
```

In `createInitialTrackFormState`, compute and store the initial value:

```ts
const dueAt = toDateInputValue(source.track?.dueAt ?? null)

return {
  description: source.track?.description ?? '',
  dueAt,
  groupBy: 'none',
  groups,
  initialDueAt: dueAt,
  nextGroupNumber: groups.length + 1,
  selectedGroupKey: firstGroup.key,
  setActiveAfterCreate: false,
  title: source.track?.title ?? '',
}
```

Add target-date validation in `deriveFieldErrors`:

```ts
const dueAtError =
  state.dueAt.length > 0 &&
  state.dueAt !== state.initialDueAt &&
  isPastDateInputValue(state.dueAt)
    ? 'Target date must be today or later.'
    : null

return {
  dueAt: dueAtError,
  groupTitles,
  groups:
    state.groups.length === 0 ? 'At least one group is required.' : null,
  problemSlugs: duplicateProblemSlug
    ? `Problem "${duplicateProblemSlug}" can only appear once in a track.`
    : null,
  title: state.title.trim().length === 0 ? 'Title is required.' : null,
}
```

Update `isFieldErrorFree`:

```ts
return (
  fieldErrors.title === null &&
  fieldErrors.dueAt === null &&
  fieldErrors.groups === null &&
  fieldErrors.problemSlugs === null &&
  Object.keys(fieldErrors.groupTitles).length === 0
)
```

Delete the local `toDateInputValue` function at the bottom of the file.

- [ ] **Step 4: Add min date, clear control, and helper copy in the form component**

Modify imports in `src/features/tracks/components/track-form.tsx`:

```ts
import { getDateInputMin } from '../domain'
```

Add `dueAt` to `getFirstFieldError`:

```ts
function getFirstFieldError(fieldErrors: TrackFormFieldErrors) {
  return (
    fieldErrors.title ??
    fieldErrors.dueAt ??
    fieldErrors.groups ??
    fieldErrors.problemSlugs ??
    Object.values(fieldErrors.groupTitles)[0] ??
    null
  )
}
```

Replace the target-date `TrackTextField` props:

```tsx
<TrackTextField
  describedBy={
    submitAttempted && fieldErrors.dueAt ? errorId : 'track-due-at-help'
  }
  helperText="Optional finish target for this track."
  invalid={submitAttempted && Boolean(fieldErrors.dueAt)}
  label="Target date"
  min={getDateInputMin(state.dueAt, state.initialDueAt)}
  name="track-due-at"
  onChange={(dueAt) => dispatch({ type: 'set-due-at', dueAt })}
  onClear={
    state.dueAt
      ? () => dispatch({ dueAt: '', type: 'set-due-at' })
      : undefined
  }
  type="date"
  value={state.dueAt}
/>
```

Extend `TrackTextField` props:

```ts
function TrackTextField({
  describedBy,
  helperText,
  invalid = false,
  label,
  min,
  name,
  onChange,
  onClear,
  required = false,
  type = 'text',
  value,
}: {
  describedBy?: string
  helperText?: string
  invalid?: boolean
  label: string
  min?: string
  name: string
  onChange: (value: string) => void
  onClear?: () => void
  required?: boolean
  type?: 'date' | 'search' | 'text'
  value: string
}) {
  const helperId = helperText ? `${name}-help` : undefined
  const ariaDescribedBy = describedBy ?? helperId

  return (
    <div className="grid gap-1">
      <label className="grid gap-1 text-[length:var(--cp-control-font-size)] font-semibold text-muted-foreground">
        <span>{label}</span>
        <span className="relative">
          <input
            aria-describedby={ariaDescribedBy}
            aria-invalid={invalid || undefined}
            className={cn(
              'h-[var(--cp-control-height)] w-full rounded-[var(--cp-radius-sm)] border border-input bg-background px-3 text-[length:var(--cp-control-font-size)] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring',
              onClear && value && 'pr-10',
            )}
            min={min}
            name={name}
            onChange={(event) => onChange(event.target.value)}
            required={required}
            type={type}
            value={value}
          />
          {onClear && value ? (
            <IconButton
              className="absolute right-1 top-1/2 -translate-y-1/2"
              label="Clear target date"
              onClick={onClear}
              size="sm"
              tooltip="Clear target date"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" />
            </IconButton>
          ) : null}
        </span>
      </label>
      {helperText ? (
        <p
          className="m-0 text-[length:var(--cp-badge-font-size)] text-muted-foreground"
          id={helperId}
        >
          {helperText}
        </p>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 5: Run form tests and commit**

Run:

```bash
npm run test -- src/features/tracks/components/track-form.test.tsx
```

Expected: pass.

Commit:

```bash
git add src/features/tracks/hooks/use-track-form.ts src/features/tracks/components/track-form.tsx src/features/tracks/components/track-form.test.tsx
git commit -m "feat: validate track target dates"
```

## Task 4: Popup Compact Target Badge

**Files:**
- Modify: `src/features/app-shell/domain/popup-app-shell.ts`
- Modify: `src/app/popup/components/study-mode-card.tsx`
- Modify: `src/app/popup/popup-shell.test.tsx`

- [ ] **Step 1: Update popup tests first**

In `src/app/popup/popup-shell.test.tsx`, replace:

```ts
expect(within(activeTrack).getByText('Due Mar 1, 2026')).toBeInTheDocument()
```

with:

```ts
expect(within(activeTrack).getByText('59 days left')).toBeInTheDocument()
expect(within(activeTrack).queryByText('Due Mar 1, 2026')).toBeNull()
```

Add an overdue popup badge case:

```ts
it('renders overdue target status as a compact active-track badge', () => {
  render(
    <PopupShell
      controller={createController({
        data: {
          ...shellData,
          generatedAt: '2026-03-05T00:00:00.000Z',
          activeTrack: {
            ...shellData.activeTrack,
            dueAt: '2026-03-01T00:00:00.000Z',
          },
        },
      })}
    />,
  )

  const activeTrack = screen.getByRole('region', { name: 'LeetCode 75' })

  expect(within(activeTrack).getByText('Overdue')).toBeInTheDocument()
  expect(within(activeTrack).queryByText('Due Mar 1, 2026')).toBeNull()
})
```

In the free-practice test, add:

```ts
expect(screen.queryByText('59 days left')).toBeNull()
expect(screen.queryByText('Overdue')).toBeNull()
```

- [ ] **Step 2: Run popup tests and verify they fail**

Run:

```bash
npm run test -- src/app/popup/popup-shell.test.tsx
```

Expected: fail because popup still renders the full due date badge.

- [ ] **Step 3: Derive popup target badge in the view model**

Modify imports in `src/features/app-shell/domain/popup-app-shell.ts`. Import from the Tracks domain public surface instead of the broad feature barrel so app-shell does not pull component/API exports into its domain module:

```ts
import {
  getTrackTargetStatus,
  type TrackTargetStatusTone,
} from '@/features/tracks/domain'
```

Add target fields to `PopupStudyPlanView`:

```ts
type PopupStudyPlanView = {
  kind: 'studyPlan'
  title: string
  body: string
  groupTitle: string | null
  progressPercent: number | null
  targetStatusLabel: string | null
  targetStatusTone: TrackTargetStatusTone | null
  nextProblem: AppShellProblemSummary | null
  modeActionLabel: string
}
```

In `createPopupStudyModeView`, derive target status only for active tracks:

```ts
const targetStatus = hasActiveTrack
  ? getTrackTargetStatus({
      dueAt: activeTrack.dueAt,
      generatedAt: data.generatedAt,
      progress: activeTrack.progress,
    })
  : null

return {
  kind: 'studyPlan',
  title: readActiveTrackTitle(data),
  body: readActiveTrackBody(data),
  groupTitle: hasActiveTrack ? activeTrack.groupTitle : null,
  progressPercent: hasActiveTrack ? activeTrack.progress.percent : null,
  targetStatusLabel: targetStatus?.popupLabel ?? null,
  targetStatusTone: targetStatus?.tone ?? null,
  nextProblem: activeTrack.nextProblem,
  modeActionLabel: 'Start freestyle mode',
}
```

Remove `dueAt` from `PopupStudyPlanView`; the runtime contract still includes `activeTrack.dueAt`.

- [ ] **Step 4: Render the compact popup badge**

In `src/app/popup/components/study-mode-card.tsx`, delete:

```ts
const dueDate = view.dueAt ? formatDueDate(view.dueAt) : null
```

Replace the `TrackProgressBadges` call:

```tsx
<TrackProgressBadges
  groupTitle={view.groupTitle}
  progressPercent={view.progressPercent}
  targetStatusLabel={view.targetStatusLabel}
  targetStatusTone={view.targetStatusTone}
/>
```

Replace `TrackProgressBadges` props and render logic:

```tsx
function TrackProgressBadges({
  groupTitle,
  progressPercent,
  targetStatusLabel,
  targetStatusTone,
}: {
  groupTitle: string | null
  progressPercent: number | null
  targetStatusLabel: string | null
  targetStatusTone: 'neutral' | 'success' | 'warning' | 'danger' | null
}) {
  if (progressPercent === null) {
    return null
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {groupTitle ? (
        <Badge tone="neutral" variant="outline">
          {groupTitle}
        </Badge>
      ) : null}
      <Badge
        aria-label={`Track progress ${progressPercent} percent complete`}
        tone="neutral"
        variant="outline"
      >
        {progressPercent}%
      </Badge>
      {targetStatusLabel ? (
        <Badge tone={targetStatusTone ?? 'neutral'} variant="outline">
          {targetStatusLabel}
        </Badge>
      ) : null}
    </div>
  )
}
```

Delete `formatDueDate` from this file.

- [ ] **Step 5: Run popup tests and commit**

Run:

```bash
npm run test -- src/app/popup/popup-shell.test.tsx
```

Expected: pass.

Commit:

```bash
git add src/features/app-shell/domain/popup-app-shell.ts src/app/popup/components/study-mode-card.tsx src/app/popup/popup-shell.test.tsx
git commit -m "feat: show compact track target status in popup"
```

## Task 5: Final Verification

**Files:**
- Verify all files touched by Tasks 1-4.

- [ ] **Step 1: Run the focused test set**

Run:

```bash
npm run test -- src/features/tracks/domain/track-target-status.test.ts src/features/tracks/components/tracks-screen.test.tsx src/features/tracks/components/track-form.test.tsx src/app/popup/popup-shell.test.tsx
```

Expected: pass.

- [ ] **Step 2: Run the full project check**

Run:

```bash
npm run check
```

Expected: pass.

- [ ] **Step 3: Inspect the branch diff**

Run:

```bash
git status --short
git diff --stat main...HEAD
git diff -- src/features/tracks/domain/track-target-status.ts src/features/tracks/components/active-track-workspace.tsx src/features/tracks/components/other-tracks-accordion.tsx src/features/tracks/components/track-form.tsx src/features/app-shell/domain/popup-app-shell.ts src/app/popup/components/study-mode-card.tsx
```

Expected:
- `.superpowers/` remains untracked if local mockups still exist.
- No unrelated files are staged.
- No queue/FSRS scheduling code changed.

- [ ] **Step 4: Browser smoke test**

Start or reuse the local dev server. Open the dashboard in the in-app browser.

Verify manually:
- `/tracks` active header shows equal-width Progress and Target panels when a target exists.
- `/tracks` active header shows only the Progress panel when no target exists.
- `Due Reviews` and `Next` remain below the panels.
- All-tracks rows show compact progress and target metadata.
- Track create/edit target date blocks new past dates, allows unchanged saved past dates, and can be cleared.
- Popup shows group, percent, and compact target-status badges in Study Plan mode.
- Popup free-practice card does not show active-track target/progress badges.

- [ ] **Step 5: Commit any verification fixes**

If verification required fixes, commit only those files:

```bash
git add <fixed-files>
git commit -m "fix: stabilize track target polish"
```

If no fixes were needed, do not create an empty commit.

## Self-Review Notes

- Spec coverage:
  - Target status helper is covered in Task 1.
  - `/tracks` active progress/target panels are covered in Task 2.
  - All-tracks compact target/progress metadata is covered in Task 2.
  - Track form native date input, clear control, min date, and edit-mode past-date rule are covered in Task 3.
  - Popup compact target badge and free-practice guard are covered in Task 4.
  - No Overview, queue ordering, FSRS scheduling, analytics, or custom date-picker work is included.
- Type consistency:
  - `TrackTargetStatusTone` values match existing UI tone names from `Badge`.
  - `generatedAt` is passed through component props and used for deterministic target display.
  - `dueAt` stays in runtime contracts; popup view model stops rendering it directly.
- Execution:
  - Each task has a failing-test step, implementation step, verification command, and commit.
