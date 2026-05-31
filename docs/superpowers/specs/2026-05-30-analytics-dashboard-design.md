# Analytics Dashboard UI Design — Issue #15

**Date:** 2026-05-30
**Issue:** [#15 — Add Analytics dashboard route and lightweight page](https://github.com/Hollowvyn/cognipace-v2/issues/15)
**Depends on:** Issue #14 (`analytics.getSummary` backend — merged)
**Unblocks:** Issue #20

---

## Goal

Replace the `AnalyticsPage` placeholder with a real analytics screen that renders four sections of local study health data. The screen is read-only, fetches nothing beyond `useAnalyticsSummary()`, and imports no FSRS library or queue/tracks APIs.

---

## Architecture

### Approach

**Decomposed files** — `analytics-screen.tsx` handles the query and delegates to three focused sub-components, each in its own file. Mirrors the `overview-screen.tsx` → `overview-panels.tsx` pattern.

### File Map

**Create:**
```
src/features/analytics/components/
├── analytics-screen.tsx         ← query, loading/error states, page layout
├── analytics-metric-row.tsx     ← 3 metric tiles + low-sample InlineStatus
├── analytics-forecast.tsx       ← 14-day CSS bar chart
├── analytics-weak-problems.tsx  ← weak problems table
├── analytics-screen.test.tsx    ← RTL tests with a11y checks
└── index.ts                     ← exports AnalyticsScreen
```

**Modify:**
- `src/features/analytics/index.ts` — add `export { AnalyticsScreen } from './components'`
- `src/app/dashboard/screens/analytics-page.tsx` — replace `DashboardPlaceholderPage` with `DashboardPage/Header/Body` + `AnalyticsScreen`

**No new dependencies.**

---

## Data Contract

The screen calls `useAnalyticsSummary()` exclusively. The hook returns `AnalyticsSummary`:

```typescript
interface AnalyticsSummary {
  generatedAt: string
  reviewDays: number
  totalReviews: number
  currentStreak: number
  retentionProxy: number        // 0–1; 0 when lowSample
  retentionProxyLabel: string   // formatted "72%" or "—" when lowSample
  retentionSampleSize: number
  lowSample: boolean
  dueForecast14Days: Array<{ date: string; dueCount: number }>  // exactly 14 entries
  weakProblems: Array<{
    slug: string
    title: string
    lapseCount: number
    difficulty: number       // 0–1 FSRS scale
    retrievability: number   // 0–1
  }>                                                            // max 10, pre-sorted server-side
}
```

No frontend computation of FSRS values. The only client-side math is bar height normalisation for the forecast chart.

---

## Components

### `analytics-screen.tsx`

Calls `useAnalyticsSummary()` and handles three states:

- **Pending** — `<Surface><InlineStatus>Loading analytics...</InlineStatus></Surface>`
- **Error** — `<Surface>` with a danger `InlineStatus` and a Retry `Button` that calls `query.refetch()`
- **Success** — renders `AnalyticsMetricRow`, `AnalyticsForecast`, `AnalyticsWeakProblems` inside a vertical flex container with `--cp-surface-gap` spacing

The component may not import anything from `@/features/queue`, `@/features/tracks`, or `@/lib/fsrs`.

---

### `analytics-metric-row.tsx`

Props: `{ summary: AnalyticsSummary }`

Renders three metric tiles in a responsive 3-column grid (collapses to 1-column on narrow viewports), matching the `OverviewMetrics` layout:

| Tile | Value | Caption |
|------|-------|---------|
| Review Days | `summary.reviewDays` | "Days with at least one review" |
| Total Reviews | `summary.totalReviews` | "All-time review attempts" |
| Retention | `summary.retentionProxyLabel` | `"${summary.retentionSampleSize} reviews in the last 30 days"` or `"Fewer than 10 reviews in the last 30 days"` when `lowSample` |

When `summary.lowSample` is `true`:
- The Retention tile shows `"—"` (sourced from `retentionProxyLabel`) in muted foreground colour
- An `InlineStatus` with `tone="warning"` renders **above** the metric row: `"Retention needs more data — check back after at least 10 reviews in the last 30 days."`

---

### `analytics-forecast.tsx`

Props: `{ forecast: Array<{ date: string; dueCount: number }> }`

Renders a pure-CSS bar chart. The y-axis measures **problems due** (one problem per FSRS default card, already normalised server-side).

**Bar height computation:**
```ts
const maxCount = Math.max(...forecast.map(e => e.dueCount), 1)
const MAX_PX = 80
const height = Math.max((entry.dueCount / maxCount) * MAX_PX, entry.dueCount > 0 ? 3 : 0)
```

- `min-height: 3px` for non-zero bars so they remain visible at small counts
- Zero-count bars render with `min-height: 0` (invisible)
- Today's bar (index 0) uses `--cp-color-primary` at full opacity; all others use `--cp-color-primary` at 60% opacity
- Date labels below each bar: `"Today"` for index 0, short locale date (`"Jun 1"`) for the rest using `Intl.DateTimeFormat`
- A 1px `--cp-color-border` axis line separates bars from labels
- A two-item legend below the axis: solid primary dot = "Today", 60%-opacity primary dot = "Upcoming"

The section is wrapped in `<Surface>` with `aria-label="14-day due forecast"` and `role="region"`.

---

### `analytics-weak-problems.tsx`

Props: `{ problems: WeakProblem[] }`

Renders a `<Surface>` containing a semantic `<table>` with 4 columns:

| Column | Content |
|--------|---------|
| Problem | Title (`font-weight: 500`) with slug below in `text-muted-foreground` |
| Difficulty | `ProblemDifficultyBadge` (already used across the app) |
| Lapses | `<Badge tone="neutral">{n} lapse{n !== 1 ? 's' : ''}</Badge>` |
| Retention | Mini inline progress bar (60px wide, `--cp-color-primary` fill) + formatted percentage |

Retention percentage from `retrievability`: `${Math.round(problem.retrievability * 100)}%`

Sorting is server-side (lapses DESC → difficulty DESC → retrievability ASC). No client-side sort.

**Empty state:** When `problems.length === 0`, render `<InlineStatus>No weak problems found — keep it up!</InlineStatus>` instead of the table.

**Footer note** in `text-muted-foreground`: `"Sorted by lapses, then difficulty, then lowest retention. Suspended problems excluded."`

---

### `analytics-page.tsx` (modified)

```tsx
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

---

## Error Handling

- **Pending:** neutral loading message, no skeleton shimmer (consistent with `OverviewScreen`)
- **Error:** danger `InlineStatus` + Retry button, calls `query.refetch()`
- **Low sample:** warning `InlineStatus` above metric row; page still renders fully (forecast and weak problems are independent of `lowSample`)
- **Empty weak problems:** `InlineStatus` in place of the table — not an error, just a success state

---

## Testing (`analytics-screen.test.tsx`)

Mock `useAnalyticsSummary` from `@/features/analytics`. Cover:

| Test | Assertion |
|------|-----------|
| Loading state | renders "Loading analytics..." |
| Error state | renders error message; Retry button present and calls `refetch` on click |
| Success — metric tiles | Review Days, Total Reviews, Retention values rendered |
| Success — forecast | 14 bar elements rendered; today bar distinguishable |
| Success — weak problems | table rows rendered with correct titles |
| Low-sample state | warning notice rendered; Retention tile shows "—" |
| Empty weak problems | empty-state message rendered instead of table |
| Accessibility | `getByRole('region')` resolves forecast and weak problems sections |

---

## Constraints

- `AnalyticsScreen` and its sub-components may not import from `@/features/queue`, `@/features/tracks`, or `@/lib/fsrs`
- No `memoryProfile` section — dropped (not in the `AnalyticsSummary` contract)
- No recommendation cards, active-track previews, or queue content
- No new npm dependencies
