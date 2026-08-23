# Analytics Dashboard Phase 5 Workload and Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the daily overdue backlog and fixed 14-day upcoming load, complete the approved page story, remove superseded compatibility code, align authority docs, and finish automated and human validation.

**Architecture:** Add one workload presentation builder over reconstructed due intervals and current scheduled cards, serialize both locked views, migrate the final screen row, then remove old payload/components only after every new consumer is green.

**Tech Stack:** TypeScript, Zod, React, Recharts LineChart/BarChart, Vitest, Testing Library, WXT build.

---

## Task 1: Build daily overdue backlog observations

**Files:**

- Create: `src/features/analytics/domain/workload-presentation.ts`
- Create: `src/features/analytics/domain/workload-presentation.test.ts`
- Modify: `src/features/analytics/domain/chart-data.ts`
- Modify: `src/features/analytics/domain/chart-data.test.ts`

- [ ] **Step 1: Write failing reconstruction and boundary tests**

Cover past-day observation immediately before next local date, today at `asOf`,
active/suspended state, due interval clearing after review, missing history,
known zero, all unknown, partial today, DST, daily 14/30/90 row counts, threshold
equality, known-day summary, and two-observation takeaway gate.

```ts
it.each([
  [14, 14],
  [30, 30],
  [90, 90],
])('keeps %i-day backlog daily with %i rows', (range, rows) => {
  const view = buildOverdueBacklogView({ cards, events, frame: frames[range] })
  expect(view.rows).toHaveLength(rows)
})

it('keeps unknown reconstruction separate from a measured zero', () => {
  expect(view.rows[0]).toMatchObject({ overdueProblems: null, measured: false })
  expect(view.rows[1]).toMatchObject({ overdueProblems: 0, measured: true })
})
```

- [ ] **Step 2: Run and verify RED**

```sh
npm run test -- src/features/analytics/domain/workload-presentation.test.ts
```

Expected: FAIL because the builder does not exist.

- [ ] **Step 3: Implement the locked daily row contract**

```ts
export interface OverdueBacklogRow {
  key: string
  dateKey: string
  observationAt: string
  overdueProblems: number | null
  measured: boolean
  isPartial: boolean
}

export interface OverdueBacklogView {
  datasetKey: string
  rows: OverdueBacklogRow[]
  domain: readonly [number, number]
  watchThreshold: 5
  knownDays: number
  selectedDays: number
  daysWithinZone: number
  current: number | null
  peak: number | null
  trend: 'grew' | 'shrunk' | 'flat' | null
}
```

Never sum daily stock values. Break across unmeasured days; do not use the
generic short-gap bridge helper for this view.

- [ ] **Step 4: Run and commit**

```sh
npm run test -- src/features/analytics/domain/workload-presentation.test.ts src/features/analytics/domain/chart-data.test.ts
```

Expected: PASS.

```sh
git add src/features/analytics/domain/workload-presentation.ts src/features/analytics/domain/workload-presentation.test.ts src/features/analytics/domain/chart-data.ts src/features/analytics/domain/chart-data.test.ts
git commit -m "feat(analytics): build daily overdue backlog"
```

## Task 2: Build the fixed upcoming schedule snapshot

**Files:**

- Modify: `src/features/analytics/domain/workload-presentation.ts`
- Modify: `src/features/analytics/domain/workload-presentation.test.ts`
- Modify: `src/features/analytics/data/analytics-repository.ts`
- Modify: `src/features/analytics/data/analytics-repository.test.ts`

- [ ] **Step 1: Write failing half-open forecast tests**

Cover `dueAt < asOf`, `dueAt === asOf`, later today, day-13 inclusion,
day-14 exclusion, suspended cards, new/learning/review/relearning states,
explicit zero rows, chronological order, no overdue repetition, and historical-
range independence.

```ts
it('places equality at asOf in Due rather than Overdue', () => {
  const view = buildUpcomingReviewLoadView({
    cards: [{ dueAt: asOf, suspended: false }],
    asOf,
    timeZone: 'America/New_York',
  })
  expect(view.rows[0]).toMatchObject({ due: 1, overdue: 0, today: true })
})

it('always returns today plus thirteen chronological dates', () => {
  expect(view.rows).toHaveLength(14)
  expect(view.rows.map((row) => row.dateKey)).toEqual(
    [...view.rows.map((row) => row.dateKey)].sort(),
  )
})
```

- [ ] **Step 2: Verify RED**

```sh
npm run test -- src/features/analytics/domain/workload-presentation.test.ts -t "Upcoming Review Load"
```

Expected: FAIL on missing builder.

- [ ] **Step 3: Implement exact rows**

```ts
export interface UpcomingReviewLoadRow {
  key: string
  dateKey: string
  due: number
  overdue: number
  total: number
  today: boolean
}

export interface UpcomingReviewLoadView {
  datasetKey: string
  rows: UpcomingReviewLoadRow[]
  domain: readonly [number, number]
  allZero: boolean
  forecastStart: string
  forecastEnd: string
}
```

Query all active non-suspended FSRS cards with a finite due instant before the
forecast end. Put every overdue card only in today's Overdue segment.

- [ ] **Step 4: Run and commit**

```sh
npm run test -- src/features/analytics/domain/workload-presentation.test.ts src/features/analytics/data/analytics-repository.test.ts
```

Expected: PASS.

```sh
git add src/features/analytics/domain/workload-presentation.ts src/features/analytics/domain/workload-presentation.test.ts src/features/analytics/data/analytics-repository.ts src/features/analytics/data/analytics-repository.test.ts
git commit -m "feat(analytics): build review load snapshot"
```

## Task 3: Serialize workload contracts

**Files:**

- Modify: `src/features/analytics/api/analytics-presentation-contracts.ts`
- Modify: `src/features/analytics/api/analytics-presentation-contracts.test.ts`
- Modify: `src/features/analytics/api/analytics-contracts.ts`
- Modify: `src/features/analytics/server/analytics-service.ts`
- Modify: `src/features/analytics/server/analytics-service.test.ts`
- Modify: `src/extension/background/register-handlers.test.ts`

- [ ] **Step 1: Write failing schema invariants**

Require 14/30/90 daily backlog lengths matching the requested range, 14 exact
forecast rows, chronological stable keys, `total === due + overdue`, nullable
backlog only when `measured === false`, threshold literal 5, and half-open
forecast metadata.

- [ ] **Step 2: Verify RED**

```sh
npm run test -- src/features/analytics/api/analytics-presentation-contracts.test.ts src/features/analytics/server/analytics-service.test.ts src/extension/background/register-handlers.test.ts
```

Expected: FAIL because the workload view schemas are absent.

- [ ] **Step 3: Add schemas and service orchestration**

```ts
export const workloadViewsSchema = z.object({
  'overdue-backlog': overdueBacklogViewSchema,
  'upcoming-review-load': upcomingReviewLoadViewSchema,
})

export type OverdueBacklogView = z.infer<typeof overdueBacklogViewSchema>
export type UpcomingReviewLoadView = z.infer<
  typeof upcomingReviewLoadViewSchema
>
```

Build both from the same `asOf` and timezone used by presentation metadata.
Historical range changes rebuild backlog but leave forecast dates/count logic
independent.

- [ ] **Step 4: Run and commit**

```sh
npm run test -- src/features/analytics/api/analytics-presentation-contracts.test.ts src/features/analytics/api/analytics-contracts.test.ts src/features/analytics/server/analytics-service.test.ts src/extension/background/register-handlers.test.ts
```

Expected: PASS.

```sh
git add src/features/analytics/api/analytics-presentation-contracts.ts src/features/analytics/api/analytics-presentation-contracts.test.ts src/features/analytics/api/analytics-contracts.ts src/features/analytics/server/analytics-service.ts src/features/analytics/server/analytics-service.test.ts src/extension/background/register-handlers.test.ts
git commit -m "feat(analytics): serialize workload views"
```

## Task 4: Render Recent Overdue Backlog

**Files:**

- Replace: `src/features/analytics/components/charts/overdue-backlog-chart.tsx`
- Create: `src/features/analytics/components/charts/overdue-backlog-chart.test.tsx`
- Modify: `src/features/analytics/components/charts/index.ts`

- [ ] **Step 1: Write failing visual and exact-value tests**

Require daily step geometry, zero baseline, green at/below five, yellow above,
exact threshold crossings, restrained labelled regions, no permanent dots,
full-date/count-only tooltip plus In progress, Date/Overdue table, seven/page,
known-day summaries, all-unknown state, known all-zero chart, one tab stop, and
daily keyboard order.

- [ ] **Step 2: Verify RED**

```sh
npm run test -- src/features/analytics/components/charts/overdue-backlog-chart.test.tsx
```

Expected: FAIL against the old area/bucket tooltip.

- [ ] **Step 3: Implement explicit threshold-clipped step segments**

```ts
export function splitThresholdSegment(
  left: OverdueBacklogRow,
  right: OverdueBacklogRow,
  threshold: 5,
): Array<{
  from: OverdueBacklogRow
  to: OverdueBacklogRow
  zone: 'within' | 'above'
}>
```

Return no segment when either side is unmeasured. Use the returned segments to
draw green/yellow step lines; show an active marker only for inspected rows.
Do not put daily change or status in tooltip content.

- [ ] **Step 4: Run and commit**

```sh
npm run test -- src/features/analytics/components/charts/overdue-backlog-chart.test.tsx
```

Expected: PASS.

```sh
git add src/features/analytics/components/charts/overdue-backlog-chart.tsx src/features/analytics/components/charts/overdue-backlog-chart.test.tsx src/features/analytics/components/charts/index.ts
git commit -m "feat(analytics): render overdue control trend"
```

## Task 5: Render Upcoming Review Load

**Files:**

- Replace: `src/features/analytics/components/charts/upcoming-review-load-chart.tsx`
- Create: `src/features/analytics/components/charts/upcoming-review-load-chart.test.tsx`
- Modify: `src/features/analytics/components/charts/index.ts`

- [ ] **Step 1: Write failing chart/table/a11y tests**

Require 14 stacked columns, zero baseline, solid Due, hatched Overdue, Today and
endpoint ticks, tooltip exactly Date/Due/Overdue, both zero rows present,
three-column table, seven/page, all-zero plot replacement with table retained,
one tab stop, chronological arrows, polite announcement, and no animation.

- [ ] **Step 2: Verify RED**

```sh
npm run test -- src/features/analytics/components/charts/upcoming-review-load-chart.test.tsx
```

Expected: FAIL against current chart/table behavior.

- [ ] **Step 3: Implement the locked figure**

Use explicit `BarChart` stacks. Define a reusable SVG pattern inside this
component for overdue hatching and pair it with the semantic overdue token.
Do not add Good/Hard/Again scenario projections.

```tsx
<Bar dataKey="due" fill="var(--cp-analytics-due)" stackId="load" isAnimationActive={false} />
<Bar dataKey="overdue" fill="url(#analytics-overdue-hatch)" stackId="load" isAnimationActive={false} />
```

- [ ] **Step 4: Run and commit**

```sh
npm run test -- src/features/analytics/components/charts/upcoming-review-load-chart.test.tsx
```

Expected: PASS.

```sh
git add src/features/analytics/components/charts/upcoming-review-load-chart.tsx src/features/analytics/components/charts/upcoming-review-load-chart.test.tsx src/features/analytics/components/charts/index.ts
git commit -m "feat(analytics): render upcoming review load"
```

## Task 6: Complete story integration and remove compatibility code

**Files:**

- Modify: `src/features/analytics/components/analytics-screen.tsx`
- Modify: `src/features/analytics/components/analytics-screen.test.tsx`
- Modify: `src/features/analytics/api/analytics-contracts.ts`
- Modify: `src/features/analytics/api/analytics-contracts.test.ts`
- Modify: `src/features/analytics/domain/summary.ts`
- Modify: `src/features/analytics/domain/summary.test.ts`
- Modify: `src/features/analytics/server/analytics-service.ts`
- Modify: `src/features/analytics/server/analytics-service.test.ts`
- Modify: `src/features/analytics/components/charts/chart-catalogue.ts`
- Modify: `src/features/analytics/components/charts/chart-shared.tsx`
- Modify: `src/features/analytics/components/charts/types.ts`
- Modify: `src/features/analytics/components/index.ts`
- Delete: `src/features/analytics/components/analytics-chart-panel.tsx`
- Delete: `src/features/analytics/components/analytics-chart-panel.test.tsx`
- Delete: `src/features/analytics/components/analytics-readiness-state.tsx`
- Delete: `src/features/analytics/components/analytics-readiness-state.test.tsx`
- Delete: `src/features/analytics/components/analytics-metric-row.tsx`
- Delete: `src/features/analytics/components/analytics-memory-profile.tsx`
- Delete: `src/features/analytics/components/fragile-knowledge-table.tsx`
- Delete: `src/features/analytics/components/fragile-knowledge-table.test.tsx`
- Delete: `src/features/analytics/components/charts/recall-quality-chart.tsx`
- Delete: `src/features/analytics/components/charts/retention-health-chart.tsx`
- Delete: `src/features/analytics/components/charts/retention-health-tooltip.tsx`
- Delete: `src/features/analytics/components/charts/retention-health-tooltip.test.tsx`
- Delete: `src/features/analytics/domain/metric-definitions.ts`
- Delete: `src/features/analytics/components/charts/chart-definitions.ts`
- Delete: `src/features/analytics/components/charts/chart-definitions.test.ts`

- [ ] **Step 1: Write failing final inventory and story tests**

Require all nine stable catalogue IDs in approved order, eight Chart/Table
controls, Memory Signals table-native, one evidence summary, no old names/copy,
range-dependent Views 1–5/8, range-independent Views 6–7/9, and route loading,
refresh, Zod error, retry, empty, sparse, and partial states.

- [ ] **Step 2: Verify RED**

```sh
npm run test -- src/features/analytics/components/analytics-screen.test.tsx src/features/analytics/api/analytics-contracts.test.ts
```

Expected: FAIL until final workload integration and legacy removal.

- [ ] **Step 3: Integrate the workload row**

```tsx
<div className="grid min-w-0 gap-4 lg:grid-cols-2">
  <OverdueBacklogFigure view={data.views['overdue-backlog']} />
  <UpcomingReviewLoadFigure view={data.views['upcoming-review-load']} />
</div>
```

- [ ] **Step 4: Remove superseded response fields and components**

Make `analyticsSummarySchema` contain shared metadata/evidence plus the nine
validated `views`. Remove correctness-based, reference-curve, old retention,
fragile, duplicate definition, and repeated readiness presentation fields only
after all new tests compile. Preserve unrelated summary data only if another
current consumer proves it is still required.

- [ ] **Step 5: Run focused tests and commit**

```sh
npm run test -- src/features/analytics src/extension/background/register-handlers.test.ts src/testing/architecture-boundaries.test.ts
```

Expected: PASS.

```sh
git add -A src/features/analytics src/extension/background/register-handlers.test.ts
git commit -m "refactor(analytics): complete dashboard view migration"
```

## Task 7: Update authority docs and manual smoke contract

**Files:**

- Modify: `docs/product.md`
- Modify: `docs/architecture.md`
- Modify: `docs/testing.md`
- Modify: `design.md`
- Modify: `docs/superpowers/README.md`

- [ ] **Step 1: Update current behavior only after implementation is true**

Document canonical view names/formulas, Overview/Analytics boundary, timezone/
range semantics, evidence sufficiency, Chart/Table parity, Retention Map detail,
Memory Signals, daily backlog exception, and fixed forecast. Keep deferred
metrics explicitly deferred.

- [ ] **Step 2: Replace the Analytics smoke flow**

Add exact human steps for all nine views, 14/30/90, timezone and DST fixtures,
partial today, null/zero/gaps, table pagination, keyboard/live announcements,
Retention Map pin lifecycle, LeetCode links, all-zero/unknown states, narrow
width, zoom, forced colors/grayscale, and reduced motion.

- [ ] **Step 3: Format and commit docs**

```sh
npx prettier --check docs/product.md docs/architecture.md docs/testing.md design.md docs/superpowers/README.md
git diff --check
```

Expected: PASS.

```sh
git add docs/product.md docs/architecture.md docs/testing.md design.md docs/superpowers/README.md
git commit -m "docs(analytics): align dashboard authority"
```

## Task 8: Final automated and human proof gate

**Files:** fixes only; PR evidence is supplied by the human engineer.

- [ ] **Step 1: Run all focused Analytics and boundary tests**

```sh
npm run test -- src/features/analytics src/lib/fsrs src/components/ui/chart.test.tsx src/styles/tokens.test.ts src/extension/background/register-handlers.test.ts src/testing/architecture-boundaries.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run required full validation**

```sh
npm run lint
npm run check
npm run build
```

Expected: all PASS. Do not run `db:generate`; this plan contains no schema
change. `npm run check` still runs `db:check`.

- [ ] **Step 3: Check formatting and final diff**

```sh
npx prettier --check src docs/product.md docs/architecture.md docs/testing.md design.md
git diff --check
git status --short --branch
```

Expected: formatting/diff checks PASS; only intended branch changes remain.

- [ ] **Step 4: Human runs realtime happy-path and edge-case smoke**

Use the updated `docs/testing.md` Analytics checklist. Attach desktop and narrow
screenshots or a recording, including Retention Map interaction and Chart/Table
parity. Record exact flows, environment, and failures/fixes in the PR.

- [ ] **Step 5: Commit validation-only fixes if needed**

```sh
git add -A src docs/product.md docs/architecture.md docs/testing.md design.md docs/superpowers/README.md
git commit -m "test(analytics): close dashboard validation"
```

Do not create an empty commit when no fixes were required. Handoff must list
exact commands run, commands skipped with reasons, remaining risk, release
impact, rollback notes, and the human visual proof.
