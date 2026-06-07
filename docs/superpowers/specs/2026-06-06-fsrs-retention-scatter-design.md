# FSRS Retention Scatter — Analytics Page Enhancement

**Date:** 2026-06-06
**Branch:** o.olaosebikan/arcjotecture-audit-v1

## Summary

Add a Retention Health scatter chart to the analytics page, inspired by the Anki FSRS Visualizer. Each practiced problem appears as a dot positioned by days since last review (X) and current retrievability % (Y). A sloping forgetting curve and a horizontal target retention threshold line give immediate visual context for which problems are well-retained vs. at risk. Hovering a dot shows full problem details.

The new panel joins the existing analytics page without replacing anything:

```
Metric Row (Review Days · Total Reviews · Retention)
14-Day Due Forecast
Retention Health  ← NEW
Weak Problems
```

---

## Motivation

The existing retention number is a single global proxy (% Good+Easy in last 30 days). It tells you *how well you're doing overall* but not *which problems are slipping*. The scatter chart makes the per-problem memory state visible, turning a one-number summary into an explorable view of the whole problem set.

---

## Approach

Extend the existing `getAnalyticsSummary` pipeline (Approach A). The analytics service already fetches settings (for `targetRetention`), already calls `getRetrievability()`, and already has a `buildMinimalCard` helper. The scatter data slots in as a fourth enrichment step alongside the existing weak-problems enrichment. No new API endpoints, no new hooks, no architecture violations.

---

## Data Layer

### Repository — `analytics-repository.ts`

New function:

```ts
getRetentionScatterCandidates(db: Db): Promise<RetentionScatterCandidate[]>
```

- Joins `fsrs_cards` + `problems` + `problem_practice`
- Filters: `state != 'new'`, `isSuspended = false`, `lastReviewAt IS NOT NULL`, `cardKind = 'default'`
- Returns: `slug`, `title`, `stability`, `difficulty`, `lapseCount`, `lastReviewAt`, `state`
- No row limit (weak problems caps at 100; scatter needs all practiced cards)

### Domain — `domain/summary.ts`

New types:

```ts
interface RetentionScatterEntry {
  slug: string
  title: string
  retrievability: number      // 0–1
  daysSinceReview: number     // integer, >= 0
  difficulty: number          // FSRS difficulty (approx 1–10)
  stability: number           // FSRS stability in days
  lapseCount: number
  lastReviewAt: string        // ISO date string
}

interface ReferenceCurvePoint {
  days: number
  retrievability: number      // 0–1
}
```

New builder:

```ts
buildRetentionScatter(
  candidates: RetentionScatterCandidate[],
  medianStability: number,
  now: Date,
): {
  scatter: RetentionScatterEntry[]
  referenceCurve: ReferenceCurvePoint[]
}
```

- Excludes candidates with null `lastReviewAt`
- Computes `retrievability` via `getRetrievability(buildMinimalCard(...), now)`
- Computes `daysSinceReview = Math.round((now - lastReviewAt) / dayMs)`
- Returns `scatter` sorted ascending by `daysSinceReview`
- `referenceCurve`: array of `{days, retrievability}` from day 0 to `maxDays`, where `maxDays = Math.max(14, maxDaysSinceReview)`. Uses `getRetrievability` at each integer day with the median stability — server pre-computes this so the frontend has no FSRS math. If the candidate set is empty, `medianStability` falls back to 21 days and `maxDays` to 14.

`AnalyticsSummary` gains three new fields:

```ts
targetRetention: number              // e.g. 0.9
retentionScatter: RetentionScatterEntry[]
retentionScatterCurve: ReferenceCurvePoint[]
```

### Service — `analytics-service.ts`

- Adds `getRetentionScatterCandidates(db)` to the `Promise.all` parallel read block (step 1)
- After reads, enriches candidates into `RetentionScatterEntry[]` — same pattern as the existing `enrichedCandidates` block for weak problems
- Computes `medianStability` from the candidate set; passes to `buildRetentionScatter`
- Passes `targetRetention: settings.review.targetRetention` into `buildAnalyticsSummary`

### Contracts — `analytics-contracts.ts`

Extends `analyticsSummarySchema` with:

```ts
targetRetention: z.number().min(0).max(1),
retentionScatter: z.array(retentionScatterEntrySchema),
retentionScatterCurve: z.array(referenceCurvePointSchema),
```

---

## UI Component

**File:** `src/features/analytics/components/analytics-retention-scatter.tsx`

```ts
Props: {
  scatter: RetentionScatterEntry[]
  referenceCurve: ReferenceCurvePoint[]
  targetRetention: number
}
```

### Chart

Plain SVG — same approach as `analytics-forecast.tsx`. No charting library.

- **X-axis:** `daysSinceReview`, range 0 → max + 10% padding
- **Y-axis:** retrievability 0–100%
- **Reference curve:** smooth SVG `<path>` from `referenceCurve` points, dashed purple
- **Threshold line:** horizontal `<line>` at `targetRetention * 100%`, dashed, labelled with the percentage
- **Dots:** `<circle>` per entry, radius 5px
  - Green: `retrievability >= targetRetention`
  - Orange: `retrievability >= targetRetention - 0.10`
  - Red: below both

### Hover Tooltip

- `hoveredSlug` state controls visibility
- `onMouseEnter` / `onMouseLeave` on each `<circle>`
- Tooltip is an absolutely-positioned `<div>` outside the SVG (not `<foreignObject>`), positioned via a `ref` map of circle screen coordinates
- Shows: problem title, last reviewed, difficulty, stability, lapses, retrievability % vs target

### Mini Summary Strip

Three small stat cards above the chart, derived from the `scatter` prop in the component (no extra data needed):
- **Target** — `targetRetention` from settings
- **Above** — count of entries where `retrievability >= targetRetention`
- **Below** — count of entries where `retrievability < targetRetention`

### Empty State

If `scatter.length === 0`, renders:
```tsx
<InlineStatus>
  No reviewed problems yet. Complete some reviews to see retention health.
</InlineStatus>
```

### Page Integration

`analytics-screen.tsx` adds `<AnalyticsRetentionScatter>` between `<AnalyticsForecast>` and `<AnalyticsWeakProblems>`, reading `targetRetention`, `retentionScatter`, and `retentionScatterCurve` from the existing `useAnalyticsSummary` data.

---

## Testing

### `domain/summary.test.ts`
- `buildRetentionScatter` returns entries sorted ascending by `daysSinceReview`
- Correctly computes `daysSinceReview` from `lastReviewAt` and `now`
- Excludes candidates with null `lastReviewAt`
- `referenceCurve` point count matches `maxDays`, all retrievability values in range 0–1

### `analytics-contracts.test.ts`
- `analyticsSummarySchema` parses a valid payload with all three new fields
- Rejects missing `targetRetention`, `retentionScatter`, `retentionScatterCurve`
- `retentionScatterEntrySchema` rejects negative `daysSinceReview`

### `analytics-repository.test.ts` (in-memory SQLite)
- `getRetentionScatterCandidates` returns only non-new, non-suspended cards with a `lastReviewAt`
- Excludes cards in `new` state
- Excludes suspended problems

### `analytics-screen.test.tsx`
- Renders `<AnalyticsRetentionScatter>` when scatter data is present
- Renders empty state message when `scatter` is empty

---

## Non-Goals

- No changes to the metric row, forecast chart, or weak problems list
- No user-facing control to adjust the threshold (it comes from FSRS settings only)
- No animation or zoom on the scatter chart
- No click-to-navigate from a dot to the problem page (hover only for MVP)

---

## Architecture Boundaries

Follows existing constraints from issue #13:
- Analytics UI must not import `src/lib/fsrs` — retrievability is computed server-side in the service
- The reference curve is pre-computed on the server and passed as plain data to the frontend
- No Dashboard/app-shell changes required — this is entirely within the analytics feature boundary
