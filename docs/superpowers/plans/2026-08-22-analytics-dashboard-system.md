# Analytics Long-Range Bucketing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the merged Analytics dashboard's 14/30/90 historical model with the approved 90/120/All-time calendar model, truthful sparse-evidence tiers, bounded gap geometry, and a selector-independent daily 120-day backlog without rebuilding the locked nine views.

**Architecture:** Keep Analytics read-only and preserve `entrypoints -> app -> features -> platform/lib/components`. The service reads complete review history once, replays each card before display filtering, derives selected-zone calendar frames, and sends one Zod-validated presentation model to explicit feature views. Calendar buckets remain elapsed-time positions, including empty periods; the UI only thins labels. Views 1–5 use the selector, Views 6–7 remain current-state, View 8 uses a fixed daily frame, and View 9 remains today plus 13 days.

**Tech Stack:** TypeScript 6, React 19, Recharts 3.10, Zod 4, TanStack Query 5, TanStack Router 1.170, Vitest 4, Testing Library, WXT Chrome MV3, Tailwind CSS 4.

---

## Authority and boundary

Implementation authority:

- `docs/superpowers/specs/2026-08-22-analytics-dashboard-system-design.md`

This is a delta over merge commit `7558bd9`. The nine view components, locked
metrics, tooltips, tables, Retention Map interaction, and semantic visual tokens
already exist. Do not rebuild them.

In scope:

- `90`, `120`, and `all` selector/URL values with 90 as the default;
- clipped Monday-start weeks for 90/120 and adaptive All-time buckets;
- per-metric `H/M/S` display tiers for Views 1–4;
- solid adjacency, one-empty-bucket dashed bridges, and longer breaks;
- Table-only presentation below 30 eligible-history days;
- no All-time previous-period comparison;
- View 8 fixed to 120 daily local rows and View 9 fixed to 14 forecast rows;
- authority docs, automated validation, and human Chrome proof.

Out of scope:

- database/schema changes, Analytics writes, or immutable FSRS capture;
- active-time compression, omitted empty periods, or review-index X axes;
- changes to View 5's 10-rating/3-problem gate;
- changes to Views 6–7 or View 9 metrics/interactions;
- new chart types, permissions, sync, account, or hosted behavior.

Preserve these unrelated untracked user files. Never stage or format them:

- `docs/superpowers/plans/2026-08-02-sync-network-timeout.md`
- `docs/superpowers/plans/2026-08-13-analytics-v1-shadcn-charts.md`

## Target contracts

### Range, frame, and grain

```ts
export type AnalyticsRange = 90 | 120 | 'all'

export type AnalyticsBucketGrain =
  | 'week'
  | 'two-weeks'
  | 'month'
  | 'two-months'
  | 'quarter'
  | 'half-year'
  | 'year'

export interface AnalyticsTimeFrame {
  asOf: string
  timeZone: string
  timeZoneFallback: boolean
  requestedRange: AnalyticsRange
  periodStart: string | null
  periodEnd: string
  bucketGrain: AnalyticsBucketGrain
  buckets: AnalyticsTimeBucket[]
}
```

When All time has no persisted valid rating, `periodStart` is `null` and
`buckets` is empty. Do not invent a lifetime start or a zero-valued bucket.

All-time grain selection uses this order:

```ts
const ALL_TIME_GRAINS: readonly AnalyticsBucketGrain[] = [
  'week',
  'two-weeks',
  'month',
  'two-months',
  'quarter',
  'half-year',
  'year',
]

const selected = ALL_TIME_GRAINS.map((grain) => ({
  grain,
  buckets: buildCalendarBuckets(bounds, grain),
})).find(({ buckets }) => buckets.length <= 48)
```

Weeks start Monday. Two-week blocks use Monday `1970-01-05` as the fixed
anchor. Two-month blocks start Jan/Mar/May/Jul/Sep/Nov; quarters start
Jan/Apr/Jul/Oct; half-years start Jan/Jul. Clip first and last buckets to the
half-open All-time bounds. Prefer the finer qualifying grain even when the
history is too short to reach 24 positions; never invent positions.

Stable row identity remains `YYYY-MM-DD` local-date based. Full dates and
tables use `MM/DD/YY`; bucket spans use `MM/DD/YY–MM/DD/YY`. A compact axis may
use `MM/DD` when its range label already states the year, but must always retain
the first and last label and non-overlapping intermediate labels.

### Evidence tier

```ts
export type AnalyticsDisplayTier =
  'table-only' | 'single-mark' | 'unconnected-marks' | 'trend'

export interface AnalyticsEvidence {
  eligibleHistoryDays: number // H
  measuredBuckets: number // M
  eligibleObservations: number // S
  displayTier: AnalyticsDisplayTier
  supportsLine: boolean
  supportsDirection: boolean
}
```

Classifier:

```ts
const displayTier =
  eligibleHistoryDays < 30
    ? 'table-only'
    : measuredBuckets <= 1
      ? 'single-mark'
      : measuredBuckets <= 5 || eligibleObservations < 30
        ? 'unconnected-marks'
        : 'trend'
```

`H` is the inclusive local-calendar date count from
`max(firstEligibleObservation, selectedPeriodStart)` through `asOf`. `M` counts
selected buckets with eligible metric observations. `S` sums those
observations. Empty practice periods do not independently fail evidence.

### Specification coverage

| Approved behavior                                   | Owning work         |
| --------------------------------------------------- | ------------------- |
| 90/120 local bounds and Monday weeks                | Tasks 1.1–1.2       |
| Adaptive All-time grain and empty lifetime          | Tasks 1.1–1.2, 3.2  |
| Replay before filtering; aggregate before ratios    | Tasks 1.3, 3.2      |
| Per-metric H/M/S display tiers                      | Tasks 2.1, 3.2, 4.2 |
| One-gap dash; longer break; full-width elapsed axis | Tasks 2.2, 4.2      |
| 90/120 comparison; no All-time comparison           | Tasks 2.1, 3.2      |
| Fixed daily 120-day backlog                         | Tasks 3.3, 4.3      |
| Stable current-state and 14-day forecast views      | Task 4.3            |
| URL/query/runtime/a11y/Table parity                 | Tasks 3.1, 4.1–4.2  |
| Current authority and Chrome proof                  | Tasks 5.1–5.3       |

### Line continuity

```ts
if (gap === 0) kind = 'solid'
else if (gap === 1) kind = 'bridge'
else continue
```

`LineSegments` receives `connectSegments={evidence.supportsLine}`. When false,
it keeps measured markers and semantic inspection data but renders no visible
connecting path. Every calendar row remains on the X axis.

### Green-commit sequencing

Phases 1 and 2 are additive: introduce the new calendar builders and evidence
classifier beside the current 14/30/90/readiness implementation so existing
production callers still typecheck. Phases 3 and 4 are one atomic cutover: do
not commit the final Zod/range contract while the old UI still consumes it.
Complete both phases, delete the compatibility functions/files, run the Phase
4 gate, and create one green implementation commit. No temporary range value,
readiness field, or duplicate presentation model may survive that commit.

## Phase 1 — Calendar range and bucket primitives

### Task 1.1: Build selected-zone bounds

**Modify:**

- `src/features/analytics/domain/analytics-time.ts`
- `src/features/analytics/domain/analytics-time.test.ts`

- [ ] Add failing 90/120 tests at New York spring-forward and fall-back
      boundaries. Assert half-open bounds, clipped Monday weeks, partial today,
      and approximately 13–14 versus 17–18 positions.
- [ ] Add a failing All-time test whose start is the local date of an explicit
      earliest valid rating.
- [ ] Add a failing empty-All-time test expecting `periodStart: null` and no
      buckets.
- [ ] Run RED:

```sh
npm run test -- src/features/analytics/domain/analytics-time.test.ts
```

- [ ] Add the target range/grain types and a
      `buildSelectedAnalyticsTimeFrame({ requestedRange, allTimeStart })`
      entrypoint beside the current function. The atomic Phase 3–4 cutover
      renames it to `buildAnalyticsTimeFrame` and removes the legacy type.
- [ ] Preserve timezone fallback, local calendar arithmetic, millisecond
      preservation, half-open intervals, and `buildForecastBounds`.
- [ ] Run GREEN with the RED command.

### Task 1.2: Select deterministic All-time grains

**Modify:**

- `src/features/analytics/domain/analytics-range-policy.ts`
- `src/features/analytics/domain/analytics-range-policy.test.ts`

- [ ] Add table-driven failing tests selecting every approved grain for a
      representative span.
- [ ] Assert at most 48 buckets, stable keys, contiguous calendar coverage,
      clipped edges, and retained empty periods.
- [ ] Run RED:

```sh
npm run test -- src/features/analytics/domain/analytics-range-policy.test.ts
```

- [ ] Add grain selection/calendar boundary builders beside the current
      `{ bucketDays, maximumGapBuckets }` lookup. Keep
      `buildAnalyticsBucketsFromTimeFrame` as the Date adapter. Remove the old
      lookup only during the atomic Phase 3–4 cutover.
- [ ] Run GREEN with the RED command.

### Task 1.3: Protect aggregate-first FSRS presentation

**Modify tests:**

- `src/features/analytics/domain/historical-presentation.test.ts`
- `src/features/analytics/domain/chart-buckets.test.ts`

- [ ] Add regressions proving Views 1, 3, and 4 sum numerators/denominators
      before ratios after coarsening.
- [ ] Add a regression proving full per-card replay precedes display filtering:
      a pre-range review may affect a retained reconstructed state without
      becoming a displayed row.
- [ ] Run:

```sh
npm run test -- src/features/analytics/domain/historical-presentation.test.ts src/features/analytics/domain/chart-buckets.test.ts
```

- [ ] Run the Phase 1 gate:

```sh
npx prettier --check src/features/analytics/domain/analytics-time.ts src/features/analytics/domain/analytics-time.test.ts src/features/analytics/domain/analytics-range-policy.ts src/features/analytics/domain/analytics-range-policy.test.ts src/features/analytics/domain/historical-presentation.test.ts src/features/analytics/domain/chart-buckets.test.ts
npm run lint
git diff --check
```

- [ ] Stage the named files and commit:

```sh
git add src/features/analytics/domain/analytics-time.ts src/features/analytics/domain/analytics-time.test.ts src/features/analytics/domain/analytics-range-policy.ts src/features/analytics/domain/analytics-range-policy.test.ts src/features/analytics/domain/historical-presentation.test.ts src/features/analytics/domain/chart-buckets.test.ts
git commit -m "feat(analytics): add long-range calendar buckets"
```

## Phase 2 — H/M/S evidence and bounded line geometry

### Task 2.1: Add the replacement evidence classifier

**Create:**

- `src/features/analytics/domain/analytics-evidence.ts`
- `src/features/analytics/domain/analytics-evidence.test.ts`

- [ ] Replace active-bucket/gap/recommended-range tests with boundaries for
      `H=29/30`, `M=1/2/5/6`, and `S=29/30`.
- [ ] Add a DST test proving `H` counts local dates, not milliseconds.
- [ ] Add tests for a helper that derives `H/M/S` from a supplied metric
      predicate, selected bounds, bucket counts, `asOf`, and timezone.
- [ ] Run RED:

```sh
npm run test -- src/features/analytics/domain/analytics-evidence.test.ts
```

- [ ] Implement `AnalyticsEvidence` without changing production consumers yet.
      Keep `analytics-readiness.ts` until the atomic Phase 3–4 cutover.
- [ ] Run GREEN with the RED command.

### Task 2.2: Break long gaps and add marker-only rendering

**Modify:**

- `src/features/analytics/domain/chart-buckets.ts`
- `src/features/analytics/domain/chart-buckets.test.ts`
- `src/features/analytics/components/charts/line-segments.tsx`
- `src/features/analytics/components/charts/line-segments.test.tsx`
- `src/features/analytics/components/charts/line-segments.integration.test.tsx`

- [ ] Replace bridge-any-gap tests with adjacent solid, one-null bridge,
      two-or-more-null break, and no leading/trailing synthetic geometry.
- [ ] Add a failing `connectSegments={false}` test that keeps measured dots and
      inspection data but renders no visible path.
- [ ] Add an integration regression that passes every calendar row to Recharts
      and places first/last categories across the full plot width.
- [ ] Run RED then GREEN:

```sh
npm run test -- src/features/analytics/domain/chart-buckets.test.ts src/features/analytics/components/charts/line-segments.test.tsx src/features/analytics/components/charts/line-segments.integration.test.tsx
```

- [ ] Keep evidence vocabulary out of the generic line primitive; it accepts
      only the boolean geometry decision.
- [ ] Run the Phase 2 gate:

```sh
npx prettier --check src/features/analytics/domain/analytics-evidence.ts src/features/analytics/domain/analytics-evidence.test.ts src/features/analytics/domain/chart-buckets.ts src/features/analytics/domain/chart-buckets.test.ts src/features/analytics/components/charts/line-segments.tsx src/features/analytics/components/charts/line-segments.test.tsx src/features/analytics/components/charts/line-segments.integration.test.tsx
npm run lint
git diff --check
```

- [ ] Stage the named files and commit:

```sh
git add src/features/analytics/domain/analytics-evidence.ts src/features/analytics/domain/analytics-evidence.test.ts src/features/analytics/domain/chart-buckets.ts src/features/analytics/domain/chart-buckets.test.ts src/features/analytics/components/charts/line-segments.tsx src/features/analytics/components/charts/line-segments.test.tsx src/features/analytics/components/charts/line-segments.integration.test.tsx
git commit -m "feat(analytics): classify sparse historical evidence"
```

## Phase 3 — Runtime model, service, and fixed View 8

Phase 3 begins the atomic cutover and is not committed independently. Continue
directly through Phase 4 before running the full gate or committing.

### Task 3.1: Migrate Zod and summary contracts

**Modify:**

- `src/features/analytics/api/analytics-contracts.ts`
- `src/features/analytics/api/analytics-contracts.test.ts`
- `src/features/analytics/domain/summary.ts`
- `src/features/analytics/domain/summary.test.ts`
- `src/testing/analytics-fixtures.ts`
- `src/extension/background/register-handlers.test.ts`

- [ ] Add schema tests accepting numeric `90`, numeric `120`, and string `all`,
      while rejecting `14`, `30`, string `90`, and arbitrary values.
- [ ] Test `requestedRange`, `bucketGrain`, nullable All-time start, and the
      empty All-time bucket exception.
- [ ] Test four per-view evidence records and removal of recommended shorter
      ranges.
- [ ] Test that the background handler passes `range: 'all'` unchanged.
- [ ] Run RED:

```sh
npm run test -- src/features/analytics/api/analytics-contracts.test.ts src/features/analytics/domain/summary.test.ts src/extension/background/register-handlers.test.ts
```

- [ ] Implement:

```ts
export const analyticsRangeSchema = z.union([
  z.literal(90),
  z.literal(120),
  z.literal('all'),
])
```

- [ ] Replace `historicalReadiness`/`recommendedRange` with metric evidence for
      Views 1–4. Serialize that evidence inside
      `views.observedRecallVsFsrs`, `views.memoryStrength`,
      `views.practiceRhythm`, and `views.ratingsMix`; do not create a duplicate
      top-level evidence catalogue. Remove serialized bucket-day,
      active-bucket, gap-failure, and leading-trim fields.
- [ ] Require `summary.range === summary.timeFrame.requestedRange`.
- [ ] Update the shared fixture once; keep the handler parse -> service -> parse.
- [ ] Run GREEN with the RED command.

### Task 3.2: Build All time after the full-history read

**Modify:**

- `src/features/analytics/server/analytics-service.ts`
- `src/features/analytics/server/analytics-service.test.ts`
- `src/features/analytics/domain/chart-data.ts`
- `src/features/analytics/domain/chart-data.test.ts`
- `src/features/analytics/domain/historical-presentation.ts`
- `src/features/analytics/domain/historical-presentation.test.ts`

- [ ] Add service tests for default 90, explicit 120, All time with history,
      empty All time, invalid ratings before the first valid rating, partial
      today, and requested-zone DST.
- [ ] Prove 90/120/All-time responses preserve empty calendar periods.
- [ ] Prove the same full sequence replays before all three display filters.
- [ ] Prove 90/120 use equivalent prior local elapsed windows and All time has
      no prior comparison.
- [ ] Run RED:

```sh
npm run test -- src/features/analytics/server/analytics-service.test.ts src/features/analytics/domain/chart-data.test.ts src/features/analytics/domain/historical-presentation.test.ts
```

- [ ] Keep `getReviewHistory(db)` as one full read. Find the earliest valid,
      non-future rating after that read; do not add a repository query.
- [ ] Build the selected frame from that event for All time. Pass explicit
      selected bounds into summaries instead of subtracting numeric range days.
- [ ] Delete `findRecommendedRange`, `trimHistoricalPoints`, and leading-empty
      slicing. Never seed replay from the selected start.
- [ ] Switch callers from the additive Phase 1 entrypoint to the final
      `buildAnalyticsTimeFrame`, then remove the legacy 14/30 time type,
      builder branch, and range-policy lookup.
- [ ] Attach the Phase 2 evidence classifier to Views 1–4 using each metric's
      eligibility predicate. Gate View 4 comparison on `trend` evidence in
      both periods and return the null comparison for All time. Preserve View
      2's per-bucket four-observation IQR rule.
- [ ] Remove `analytics-readiness.ts` and its old test after all imports and
      response fields have moved to `analytics-evidence.ts`.
- [ ] Run GREEN with the RED command.

### Task 3.3: Decouple the 120-day daily backlog

**Modify:**

- `src/features/analytics/domain/analytics-time.ts`
- `src/features/analytics/domain/workload-presentation.ts`
- `src/features/analytics/domain/workload-presentation.test.ts`
- `src/features/analytics/server/analytics-service.ts`
- `src/features/analytics/server/analytics-service.test.ts`

- [ ] Test identical 120 local-date View 8 rows for every selector, including
      known zeroes, unknown reconstruction gaps, and a DST boundary.
- [ ] Retain the View 9 invariant: 14 rows, only row zero is today, and only
      today can contain overdue count.
- [ ] Run RED:

```sh
npm run test -- src/features/analytics/domain/workload-presentation.test.ts src/features/analytics/server/analytics-service.test.ts
```

- [ ] Add an internal `buildFixedDailyTimeFrame({ asOf, days: 120, timeZone })`.
      It is not the selected serialized range frame.
- [ ] Reconstruct backlog snapshots from that frame, remove View 8 from
      selector evidence, and preserve unknown rows as `null` with broken lines.
- [ ] Run GREEN with the RED command.
- [ ] Run the focused Phase 3 suite, then continue directly to Phase 4 without
      committing the temporarily incompatible runtime/UI boundary.

## Phase 4 — Route, selector, and truthful presentation

### Task 4.1: Switch URL/query/default range

**Modify:**

- `src/app/dashboard/navigation/routes.tsx`
- `src/app/dashboard/routes.test.tsx`
- `src/app/dashboard/screens/analytics-page.tsx`
- `src/platform/query/query-keys.ts`
- `src/features/analytics/api/analytics-api.ts`
- `src/features/analytics/api/analytics-api.test.tsx`
- `src/features/analytics/components/analytics-range-control.tsx`

- [ ] Test `range=90`, `range=120`, and `range=all`; absent, malformed, `14`,
      and `30` normalize to `90`.
- [ ] Test that selecting All time preserves unrelated search context and sends
      `range: 'all'` to the runtime.
- [ ] Test distinct cache keys for all three range values in one timezone.
- [ ] Run RED:

```sh
npm run test -- src/app/dashboard/routes.test.tsx src/features/analytics/api/analytics-api.test.tsx
```

- [ ] Parse `all` before numeric coercion:

```ts
const candidate =
  search.range === 'all'
    ? 'all'
    : typeof search.range === 'string'
      ? Number(search.range)
      : search.range
const parsed = analyticsRangeSchema.safeParse(candidate)
return { range: parsed.success ? parsed.data : 90, ...context }
```

- [ ] Default the service, hook, screen, and route to 90. Render `90 days`,
      `120 days`, and `All time` with the existing accessible button group.
- [ ] Run GREEN with the RED command.

### Task 4.2: Render display tiers

**Modify:**

- `src/components/ui/chart-table.tsx`
- `src/features/analytics/components/historical-views.tsx`
- `src/features/analytics/components/historical-views.test.tsx`
- `src/features/analytics/components/analytics-screen.tsx`
- `src/features/analytics/components/analytics-screen.test.tsx`

**Rename:**

- `src/features/analytics/components/analytics-readiness-state.tsx` to
  `src/features/analytics/components/analytics-evidence-state.tsx`
- `src/features/analytics/components/analytics-readiness-state.test.tsx` to
  `src/features/analytics/components/analytics-evidence-state.test.tsx`

- [ ] Test each View 1–4 tier: Table-only has no Chart tab; single mark has no
      path; 2–5 marks remain unconnected; trend has bounded continuity.
- [ ] Test that View 3 count bars and View 4 stacks remain visible in middle
      tiers while line/directional claims stay absent.
- [ ] Test one quiet page evidence summary, compact figure evidence, persisted
      selected Table tab, and pagination reset after a range change.
- [ ] Test all elapsed rows remain in 90/120/All-time chart data while X-axis
      labels are thinned.
- [ ] Test full/table dates as `MM/DD/YY`, multi-date spans as
      `MM/DD/YY–MM/DD/YY`, and retained first/last compact-axis labels.
- [ ] Run RED:

```sh
npm run test -- src/features/analytics/components/historical-views.test.tsx src/features/analytics/components/analytics-screen.test.tsx src/features/analytics/components/analytics-evidence-state.test.tsx
```

- [ ] Let generic `ChartTable` support a semantic table-only mode, but keep the
      metric tier decision in Analytics.
- [ ] Pass `connectSegments={evidence.supportsLine}` to View 1, View 2, and the
      percentage line in View 3.
- [ ] Use `interval="preserveStartEnd"`/`minTickGap` to thin labels only. Never
      filter calendar rows or use review indices.
- [ ] Use approved evidence vocabulary and remove shorter-range links/repeated
      warning banners.
- [ ] Format `Range: All time` versus `Range: 90 days/120 days`; handle null
      All-time start without `Invalid Date`.
- [ ] Keep View 5's independent gate and maximum-five-row presentation.
- [ ] Run GREEN with the RED command.

### Task 4.3: Guard selector-independent views

**Modify tests unless a regression fails:**

- `src/features/analytics/components/current-state-views.test.tsx`
- `src/features/analytics/components/workload-views.test.tsx`
- `src/features/analytics/components/analytics-screen.test.tsx`

- [ ] Rerender across all ranges and assert Views 6–7 retain their cohort,
      View 8 retains 120 daily rows, and View 9 retains 14 rows.
- [ ] Retain View 8 green/yellow segments, no permanent points, no status/daily
      change tooltip fields, and broken unknown days.
- [ ] Retain View 9 Date/Due/Overdue tooltip/table parity.
- [ ] Run the complete Phase 3–4 focused suites, `npm run lint`,
      `npm run typecheck`, `npm run build`, touched-file Prettier, and
      `git diff --check`.
- [ ] Use these exact focused commands before the full checks:

```sh
npm run test -- src/features/analytics/api/analytics-contracts.test.ts src/features/analytics/domain/summary.test.ts src/features/analytics/domain/chart-data.test.ts src/features/analytics/domain/historical-presentation.test.ts src/features/analytics/domain/workload-presentation.test.ts src/features/analytics/server/analytics-service.test.ts src/extension/background/register-handlers.test.ts
npm run test -- src/app/dashboard/routes.test.tsx src/features/analytics/api/analytics-api.test.tsx src/features/analytics/components/historical-views.test.tsx src/features/analytics/components/analytics-screen.test.tsx src/features/analytics/components/analytics-evidence-state.test.tsx src/features/analytics/components/current-state-views.test.tsx src/features/analytics/components/workload-views.test.tsx src/features/analytics/components/charts/line-segments.integration.test.tsx
npm run lint
npm run typecheck
npm run build
npx prettier --check src/features/analytics src/app/dashboard/navigation/routes.tsx src/app/dashboard/routes.test.tsx src/app/dashboard/screens/analytics-page.tsx src/platform/query/query-keys.ts src/components/ui/chart-table.tsx src/testing/analytics-fixtures.ts src/extension/background/register-handlers.test.ts
git diff --check
```

- [ ] Confirm `rg -n "14 \| 30|requestedDays|recommendedRange|historicalReadiness|analytics-readiness" src/features/analytics src/app/dashboard src/platform/query src/extension/background src/testing`
      returns no production compatibility contract.
- [ ] Stage only files named in Phases 3–4, preserve the two user-owned
      untracked plans, and commit the atomic cutover:

```sh
git add src/features/analytics src/app/dashboard/navigation/routes.tsx src/app/dashboard/routes.test.tsx src/app/dashboard/screens/analytics-page.tsx src/platform/query/query-keys.ts src/components/ui/chart-table.tsx src/testing/analytics-fixtures.ts src/extension/background/register-handlers.test.ts
git commit -m "feat(analytics): add long-range evidence-aware bucketing"
```

## Phase 5 — Authority, full validation, and human proof

### Task 5.1: Update current authority

**Modify:**

- `docs/product.md`
- `docs/architecture.md`
- `docs/testing.md`
- `design.md`

- [ ] Replace 14/30/90, leading trim, shorter-range recommendation, and
      bridge-any-gap wording with the approved contract.
- [ ] Document H/M/S tiers, preserved calendar rows, full-history replay order,
      one-gap bridges, longer breaks, fixed daily View 8, and fixed View 9.
- [ ] Update the dashboard smoke flow for 90/120/All time and all evidence tiers.
- [ ] Run:

```sh
npx prettier --check docs/product.md docs/architecture.md docs/testing.md design.md docs/superpowers/specs/2026-08-22-analytics-dashboard-system-design.md docs/superpowers/plans/2026-08-22-analytics-dashboard-system.md
git diff --check
```

- [ ] Commit:

```sh
git add docs/product.md docs/architecture.md docs/testing.md design.md
git commit -m "docs(analytics): document long-range chart behavior"
```

### Task 5.2: Complete automated acceptance

- [ ] Confirm only intended files are tracked with `git status --short` and
      `git diff --stat origin/main...HEAD`.
- [ ] Run:

```sh
npm run lint
npm run check
npm run build
git diff --check
```

- [ ] Confirm `.output/chrome-mv3` exists. Skip `npm run db:generate` because
      there is no schema change; `npm run check` still runs `db:check`.
- [ ] Record every failed or skipped command verbatim in the PR handoff.

### Task 5.3: Human Chrome-extension proof gate

Before PR review or merge, the human engineer loads `.output/chrome-mv3` from
`chrome://extensions` and attaches screenshots or a recording for happy and
sparse paths.

- [ ] Verify default 90 and stable `90`, `120`, `all` URLs after reload.
- [ ] Verify weekly 90/120 and the disclosed adaptive All-time grain.
- [ ] Verify empty periods remain on the full-width timeline as Not measured.
- [ ] Verify Table-only, one mark, unconnected marks, and supported trends.
- [ ] Verify solid adjacency, one-gap dash, and longer line breaks.
- [ ] Verify Chart/Table parity, keyboard inspection, tooltips, pagination,
      reduced motion, narrow layout, 200–400% zoom, and color-independent state.
- [ ] Verify View 4 comparison on 90/120 and absence on All time.
- [ ] Verify Views 6–7 stay unchanged, View 8 stays daily 120, and View 9 stays 14.
- [ ] Verify empty DB and invalid-rating-only All time do not invent dates/zeroes.

## Final done-when checklist

- [ ] Range types expose only `90 | 120 | 'all'` and default to 90.
- [ ] 90/120 use clipped Monday weeks; All time uses the finest approved grain
      at or below 48 positions.
- [ ] Full history replay precedes range filtering and aggregate-first buckets.
- [ ] Views 1–4 use metric-specific H/M/S tiers.
- [ ] Empty periods remain rows/X positions; only one empty line bucket bridges.
- [ ] Under-30 evidence is Table-only; sparse marks are not connected.
- [ ] View 4 has no All-time prior comparison.
- [ ] View 5 retains its gate; Views 6–7 remain current-state.
- [ ] View 8 is fixed daily 120; View 9 is fixed 14.
- [ ] Required automation and human proof are recorded in the PR template.

## PR handoff

Use `.github/PULL_REQUEST_TEMPLATE.md` directly. Suggested title:

```text
feat(analytics): add long-range evidence-aware bucketing
```

Include the approved spec and this plan, exact commands run/skipped, risks
(timezone/DST, All-time grain, runtime schema, geometry, navigation), release
impact, rollback to the previous Analytics range commit, and screenshots or
recording.
