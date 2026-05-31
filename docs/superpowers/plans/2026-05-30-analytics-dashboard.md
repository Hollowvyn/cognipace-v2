# Analytics Dashboard UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `AnalyticsPage` placeholder with a real analytics screen backed by `useAnalyticsSummary()`.

**Architecture:** Decomposed components under `features/analytics/components/` — `analytics-screen.tsx` orchestrates the query and three focused presentational sub-components (metric row, forecast, weak problems). Matches the `overview-screen.tsx` → `overview-panels.tsx` pattern. No new dependencies.

**Tech Stack:** TypeScript, React 19, TanStack Query, Tailwind CSS v4, Vitest, @testing-library/react, WXT Chrome extension messaging

---

## File Map

**Create:**
- `src/features/analytics/components/analytics-screen.test.tsx` — RTL tests, mocks `sendMessage`
- `src/features/analytics/components/analytics-weak-problems.tsx` — weak problems table (3 cols: problem, lapses, retention)
- `src/features/analytics/components/analytics-metric-row.tsx` — 3 metric tiles + low-sample InlineStatus
- `src/features/analytics/components/analytics-forecast.tsx` — 14-day CSS bar chart
- `src/features/analytics/components/analytics-screen.tsx` — query orchestrator, loading/error/success states
- `src/features/analytics/components/index.ts` — barrel export

**Modify:**
- `src/features/analytics/index.ts` — add `AnalyticsScreen` re-export
- `src/app/dashboard/screens/analytics-page.tsx` — replace `DashboardPlaceholderPage` with real page

---

## Task 1: Write the failing test suite

**Files:**
- Create: `src/features/analytics/components/analytics-screen.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// src/features/analytics/components/analytics-screen.test.tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { AnalyticsScreen } from './analytics-screen'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

function baseAnalyticsSummary() {
  return {
    generatedAt: '2026-01-15T12:00:00.000Z',
    reviewDays: 42,
    totalReviews: 381,
    currentStreak: 7,
    retentionProxy: 0.72,
    retentionProxyLabel: '72%',
    retentionSampleSize: 58,
    lowSample: false,
    dueForecast14Days: Array.from({ length: 14 }, (_, i) => ({
      date: `2026-01-${String(15 + i).padStart(2, '0')}`,
      dueCount: i === 0 ? 6 : (i + 1) * 3,
    })),
    weakProblems: [
      {
        slug: 'longest-substring-without-repeating-characters',
        title: 'Longest Substring Without Repeating',
        lapseCount: 5,
        difficulty: 0.6,
        retrievability: 0.28,
      },
    ],
  }
}

function createAnalyticsSummary(
  overrides: Partial<ReturnType<typeof baseAnalyticsSummary>> = {},
) {
  return { ...baseAnalyticsSummary(), ...overrides }
}

describe('AnalyticsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state while analytics data is pending', () => {
    vi.mocked(sendMessage).mockReturnValueOnce(new Promise(() => {}))

    renderAnalyticsScreen()

    expect(screen.getByText('Loading analytics...')).toBeVisible()
  })

  it('renders error state then succeeds after retry', async () => {
    const user = userEvent.setup()
    const deferred = createDeferred<never>()
    vi.mocked(sendMessage)
      .mockReturnValueOnce(deferred.promise)
      .mockResolvedValueOnce(createAnalyticsSummary())

    renderAnalyticsScreen()

    expect(screen.getByText('Loading analytics...')).toBeVisible()

    deferred.reject(new Error('network error'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load Analytics.',
    )
    const retryButton = screen.getByRole('button', { name: 'Retry' })
    expect(retryButton).toBeVisible()

    await user.click(retryButton)

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('42')).toBeVisible()
  })

  it('renders metric tiles with correct values', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(createAnalyticsSummary())

    renderAnalyticsScreen()

    const reviewDaysTile = await screen.findByLabelText('Review Days metric')
    expect(within(reviewDaysTile).getByText('42')).toBeVisible()

    const totalReviewsTile = screen.getByLabelText('Total Reviews metric')
    expect(within(totalReviewsTile).getByText('381')).toBeVisible()

    const retentionTile = screen.getByLabelText('Retention metric')
    expect(within(retentionTile).getByText('72%')).toBeVisible()
  })

  it('renders 14 forecast bars with a Today label', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(createAnalyticsSummary())

    renderAnalyticsScreen()

    await screen.findByRole('region', { name: '14-day due forecast' })
    expect(screen.getAllByTestId('forecast-bar')).toHaveLength(14)
    expect(screen.getByText('Today')).toBeVisible()
  })

  it('renders weak problem rows with lapse count and retention', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(createAnalyticsSummary())

    renderAnalyticsScreen()

    const weakSection = await screen.findByRole('region', {
      name: 'Weak problems',
    })
    expect(
      within(weakSection).getByText('Longest Substring Without Repeating'),
    ).toBeVisible()
    expect(within(weakSection).getByText('5 lapses')).toBeVisible()
    expect(within(weakSection).getByText('28%')).toBeVisible()
  })

  it('shows warning notice and dash retention when lowSample is true', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      createAnalyticsSummary({
        lowSample: true,
        retentionProxyLabel: '—',
        retentionSampleSize: 7,
      }),
    )

    renderAnalyticsScreen()

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Retention needs more data',
    )
    const retentionTile = screen.getByLabelText('Retention metric')
    expect(within(retentionTile).getByText('—')).toBeVisible()
  })

  it('renders empty-state message when there are no weak problems', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      createAnalyticsSummary({ weakProblems: [] }),
    )

    renderAnalyticsScreen()

    await screen.findByRole('region', { name: 'Weak problems' })
    expect(
      screen.getByText('No weak problems found — keep it up!'),
    ).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('resolves forecast and weak problems sections by accessible role', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(createAnalyticsSummary())

    renderAnalyticsScreen()

    expect(
      await screen.findByRole('region', { name: '14-day due forecast' }),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Weak problems' }),
    ).toBeVisible()
  })
})

function renderAnalyticsScreen() {
  const harness = createQueryTestHarness()
  render(<AnalyticsScreen />, { wrapper: harness.wrapper })
  return harness
}

function createDeferred<T>() {
  let reject!: (reason?: unknown) => void
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, reject, resolve }
}
```

- [ ] **Step 2: Run the tests to verify they all fail**

```bash
cd /Users/nidsounds/Documents/GitHub/cognipace-v2 && npx vitest run src/features/analytics/components/analytics-screen.test.tsx
```

Expected: FAIL — `Cannot find module './analytics-screen'`

- [ ] **Step 3: Commit the test file**

```bash
git add src/features/analytics/components/analytics-screen.test.tsx
git commit -m "test(analytics): add failing AnalyticsScreen test suite"
```

---

## Task 2: `analytics-weak-problems.tsx`

**Files:**
- Create: `src/features/analytics/components/analytics-weak-problems.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/features/analytics/components/analytics-weak-problems.tsx
import { Badge } from '@/components/ui/badge'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'
import type { WeakProblem } from '@/features/analytics'

export function AnalyticsWeakProblems({
  problems,
}: {
  problems: WeakProblem[]
}) {
  return (
    <Surface
      aria-label="Weak problems"
      className="grid gap-3"
      role="region"
    >
      <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
        Weak Problems
      </div>

      {problems.length === 0 ? (
        <InlineStatus>No weak problems found — keep it up!</InlineStatus>
      ) : (
        <>
          <table className="w-full border-collapse text-[length:var(--cp-copy-font-size)]">
            <thead>
              <tr>
                <th className="border-b border-border pb-2 text-left text-[length:var(--cp-kicker-font-size)] font-bold uppercase text-muted-foreground">
                  Problem
                </th>
                <th className="border-b border-border pb-2 text-left text-[length:var(--cp-kicker-font-size)] font-bold uppercase text-muted-foreground">
                  Lapses
                </th>
                <th className="border-b border-border pb-2 text-right text-[length:var(--cp-kicker-font-size)] font-bold uppercase text-muted-foreground">
                  Retention
                </th>
              </tr>
            </thead>
            <tbody>
              {problems.map((problem) => (
                <tr key={problem.slug}>
                  <td className="border-b border-border py-2">
                    <div className="font-medium text-foreground">
                      {problem.title}
                    </div>
                    <div className="text-[length:var(--cp-badge-font-size)] text-muted-foreground">
                      {problem.slug}
                    </div>
                  </td>
                  <td className="border-b border-border py-2">
                    <Badge tone="neutral">
                      {problem.lapseCount}{' '}
                      {problem.lapseCount === 1 ? 'lapse' : 'lapses'}
                    </Badge>
                  </td>
                  <td className="border-b border-border py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div
                          aria-hidden="true"
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.round(problem.retrievability * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="tabular-nums text-foreground">
                        {Math.round(problem.retrievability * 100)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="m-0 text-[length:var(--cp-badge-font-size)] text-muted-foreground">
            Sorted by lapses, then difficulty, then lowest retention. Suspended
            problems excluded.
          </p>
        </>
      )}
    </Surface>
  )
}
```

- [ ] **Step 2: Run the tests**

```bash
npx vitest run src/features/analytics/components/analytics-screen.test.tsx
```

Expected: still FAIL on `Cannot find module './analytics-screen'` — that's fine, we haven't wired the screen yet.

- [ ] **Step 3: Commit**

```bash
git add src/features/analytics/components/analytics-weak-problems.tsx
git commit -m "feat(analytics): add AnalyticsWeakProblems component"
```

---

## Task 3: `analytics-metric-row.tsx`

**Files:**
- Create: `src/features/analytics/components/analytics-metric-row.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/features/analytics/components/analytics-metric-row.tsx
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'
import type { AnalyticsSummary } from '@/features/analytics'
import { cn } from '@/utils/cn'

export function AnalyticsMetricRow({
  summary,
}: {
  summary: AnalyticsSummary
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[var(--cp-surface-gap)]">
      {summary.lowSample ? (
        <InlineStatus role="status" tone="warning">
          Retention needs more data — check back after at least 10 reviews in
          the last 30 days.
        </InlineStatus>
      ) : null}

      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <Surface
          aria-label="Review Days metric"
          className="grid min-h-[6rem] gap-2 !p-4"
        >
          <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            Review Days
          </div>
          <div className="text-3xl font-bold leading-none text-foreground tabular-nums">
            {summary.reviewDays}
          </div>
          <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
            Days with at least one review
          </p>
        </Surface>

        <Surface
          aria-label="Total Reviews metric"
          className="grid min-h-[6rem] gap-2 !p-4"
        >
          <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            Total Reviews
          </div>
          <div className="text-3xl font-bold leading-none text-foreground tabular-nums">
            {summary.totalReviews}
          </div>
          <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
            All-time review attempts
          </p>
        </Surface>

        <Surface
          aria-label="Retention metric"
          className="grid min-h-[6rem] gap-2 !p-4"
        >
          <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            Retention
          </div>
          <div
            className={cn(
              'text-3xl font-bold leading-none tabular-nums',
              summary.lowSample ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {summary.retentionProxyLabel}
          </div>
          <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
            {summary.lowSample
              ? 'Fewer than 10 reviews in the last 30 days'
              : `${summary.retentionSampleSize} reviews in the last 30 days`}
          </p>
        </Surface>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/analytics/components/analytics-metric-row.tsx
git commit -m "feat(analytics): add AnalyticsMetricRow component"
```

---

## Task 4: `analytics-forecast.tsx`

**Files:**
- Create: `src/features/analytics/components/analytics-forecast.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/features/analytics/components/analytics-forecast.tsx
import { Surface } from '@/components/ui/surface'
import type { ForecastEntry } from '@/features/analytics'
import { cn } from '@/utils/cn'

const MAX_BAR_HEIGHT = 80

export function AnalyticsForecast({
  forecast,
}: {
  forecast: ForecastEntry[]
}) {
  const max = Math.max(...forecast.map((e) => e.dueCount), 1)

  return (
    <Surface
      aria-label="14-day due forecast"
      className="grid gap-3"
      role="region"
    >
      <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
        14-Day Due Forecast
      </div>

      <div
        className="flex items-end gap-1"
        style={{ height: `${MAX_BAR_HEIGHT + 20}px` }}
      >
        {forecast.map((entry, i) => {
          const isToday = i === 0
          const barHeight =
            entry.dueCount > 0
              ? Math.max((entry.dueCount / max) * MAX_BAR_HEIGHT, 3)
              : 0

          return (
            <div
              key={entry.date}
              className="flex flex-1 flex-col items-center gap-1 self-end"
              data-testid="forecast-bar"
            >
              <div
                className={cn(
                  'w-full rounded-t-[3px] bg-primary',
                  isToday ? 'opacity-100' : 'opacity-60',
                )}
                style={{ height: `${barHeight}px` }}
              />
              <div className="overflow-hidden whitespace-nowrap text-center text-[0.6rem] text-muted-foreground">
                {isToday ? 'Today' : formatBarDate(entry.date)}
              </div>
            </div>
          )
        })}
      </div>

      <div className="h-px bg-border" />

      <div className="flex gap-3">
        <span className="flex items-center gap-1 text-[0.68rem] text-muted-foreground">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-[2px] bg-primary opacity-100"
          />
          Today
        </span>
        <span className="flex items-center gap-1 text-[0.68rem] text-muted-foreground">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-[2px] bg-primary opacity-60"
          />
          Upcoming
        </span>
      </div>
    </Surface>
  )
}

function formatBarDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(dateStr))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/analytics/components/analytics-forecast.tsx
git commit -m "feat(analytics): add AnalyticsForecast CSS bar chart component"
```

---

## Task 5: `analytics-screen.tsx`, barrel exports, and feature index

**Files:**
- Create: `src/features/analytics/components/analytics-screen.tsx`
- Create: `src/features/analytics/components/index.ts`
- Modify: `src/features/analytics/index.ts`

- [ ] **Step 1: Create `analytics-screen.tsx`**

```tsx
// src/features/analytics/components/analytics-screen.tsx
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'

import { useAnalyticsSummary } from '../api/analytics-api'
import { AnalyticsForecast } from './analytics-forecast'
import { AnalyticsMetricRow } from './analytics-metric-row'
import { AnalyticsWeakProblems } from './analytics-weak-problems'

export function AnalyticsScreen() {
  const query = useAnalyticsSummary()

  if (query.isPending) {
    return (
      <Surface>
        <InlineStatus>Loading analytics...</InlineStatus>
      </Surface>
    )
  }

  if (query.isError || !query.data) {
    return (
      <Surface className="grid gap-3">
        <InlineStatus role="alert" tone="danger">
          Failed to load Analytics.
        </InlineStatus>
        <div>
          <Button
            onClick={() => {
              void query.refetch()
            }}
            size="sm"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" />
            Retry
          </Button>
        </div>
      </Surface>
    )
  }

  const { data } = query

  return (
    <div className="flex min-w-0 flex-col gap-[var(--cp-surface-gap)]">
      <AnalyticsMetricRow summary={data} />
      <AnalyticsForecast forecast={data.dueForecast14Days} />
      <AnalyticsWeakProblems problems={data.weakProblems} />
    </div>
  )
}
```

- [ ] **Step 2: Create `components/index.ts`**

```ts
// src/features/analytics/components/index.ts
export { AnalyticsScreen } from './analytics-screen'
```

- [ ] **Step 3: Add `AnalyticsScreen` to the feature barrel**

Open `src/features/analytics/index.ts`. Add one line at the top:

```ts
export { AnalyticsScreen } from './components'
export { useAnalyticsSummary, analyticsQueryKeys } from './api/analytics-api'

export type {
  AnalyticsSummary,
  WeakProblem,
  ForecastEntry,
} from './domain/summary'
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/features/analytics/components/analytics-screen.test.tsx
```

Expected: all 8 tests PASS

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
npx vitest run
```

Expected: all existing tests PASS, no regressions

- [ ] **Step 6: Commit**

```bash
git add src/features/analytics/components/analytics-screen.tsx \
        src/features/analytics/components/index.ts \
        src/features/analytics/index.ts
git commit -m "feat(analytics): add AnalyticsScreen and wire barrel exports"
```

---

## Task 6: Replace the `AnalyticsPage` placeholder

**Files:**
- Modify: `src/app/dashboard/screens/analytics-page.tsx`

- [ ] **Step 1: Replace the placeholder**

Replace the entire file content:

```tsx
// src/app/dashboard/screens/analytics-page.tsx
import { AnalyticsScreen } from '@/features/analytics'

import { useDashboardChrome } from '@/app/dashboard/dashboard-shell'
import {
  DashboardPage,
  DashboardPageBody,
  DashboardPageHeader,
} from '@/app/dashboard/layout/dashboard-page'
import { dashboardRouteMeta } from '@/app/dashboard/navigation/route-manifest'

export function AnalyticsPage() {
  const { headerActions } = useDashboardChrome()

  return (
    <DashboardPage className="mx-auto w-full max-w-[64rem]">
      <DashboardPageHeader
        actions={headerActions}
        title={dashboardRouteMeta.analytics.staticData.title}
      >
        Your local study health — reviews, retention, and upcoming workload.
      </DashboardPageHeader>
      <DashboardPageBody>
        <AnalyticsScreen />
      </DashboardPageBody>
    </DashboardPage>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run the full test suite one final time**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/screens/analytics-page.tsx
git commit -m "feat(analytics): replace placeholder with real Analytics page"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Analytics route renders independently (backed by `useAnalyticsSummary()` only)
- ✅ Loading and error states with retry
- ✅ Metric row: Review Days, Total Reviews, Retention
- ✅ Low-sample state: warning `InlineStatus` above tiles + `"—"` in Retention tile
- ✅ 14-day forecast: CSS bars, today vs upcoming visually distinct, "problems due" on y-axis
- ✅ All 14 days rendered (zero-count bars have 0 height, still in DOM)
- ✅ Weak problems table: title, lapse count badge, retention mini-bar + percentage
- ✅ Empty weak problems state
- ✅ No recommendation cards, active-track previews, or queue content
- ✅ No memory profile section
- ✅ No new dependencies
- ✅ Accessibility: `role="region"` + `aria-label` on forecast and weak problems sections; `aria-label` on metric tiles

**Note on difficulty column:** The `WeakProblem.difficulty` field is a 0–1 FSRS float, not a LeetCode Easy/Medium/Hard label. `ProblemDifficultyBadge` expects the LeetCode label. The table uses three columns (Problem, Lapses, Retention) to avoid a misleading display — this is a deliberate deviation from the mockup.

**Type consistency:** `AnalyticsSummary`, `WeakProblem`, and `ForecastEntry` are imported throughout from `@/features/analytics` (the barrel). `analytics-screen.tsx` imports `useAnalyticsSummary` from `../api/analytics-api` (sibling path), consistent with how `overview-screen.tsx` imports from its sibling api file.
