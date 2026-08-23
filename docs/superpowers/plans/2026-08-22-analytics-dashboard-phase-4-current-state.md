# Analytics Dashboard Phase 4 Current-State Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Retention Health and Fragile Knowledge with the locked Retention Map and Memory Signals current-state diagnostics, including target-duration derivation, deterministic cohorts, six regions, interactive pinned detail, exact table, and transparent reason lanes.

**Architecture:** Add target-duration to the existing `src/lib/fsrs` adapter, build both views from one feature-owned current-card presentation source, serialize them through Zod, and render one explicit scatter figure plus one table-native diagnostic. No UI imports `ts-fsrs` or calculates status/ranking.

**Tech Stack:** ts-fsrs 5.4 through the existing adapter, TypeScript, Zod, React, Recharts ScatterChart, Vitest, Testing Library, fake timers.

---

## Task 1: Add FSRS target-duration derivation inside the adapter

**Files:**

- Modify: `src/lib/fsrs/adapter/ts-fsrs-adapter.ts`
- Modify: `src/lib/fsrs/scheduler/review-scheduler.ts`
- Modify: `src/lib/fsrs/scheduler/review-scheduler.test.ts`
- Modify: `src/lib/fsrs/index.ts`
- Modify: `src/lib/fsrs/index.test.ts`

- [ ] **Step 1: Write failing adapter-boundary tests**

Use the public wrapper only. Test finite positive stability, target equality,
monotonicity, approximately seven-day crossing, invalid values, and that no
feature imports `ts-fsrs` directly.

```ts
it('returns the elapsed days where the forgetting curve reaches target', () => {
  const days = getTargetDurationDays(15, { targetRetention: 0.9 })
  expect(days).toBeCloseTo(15, 3)
})

it('returns a longer duration for a lower target', () => {
  expect(getTargetDurationDays(15, { targetRetention: 0.8 })).toBeGreaterThan(
    getTargetDurationDays(15, { targetRetention: 0.9 }),
  )
})
```

FSRS stability is the 90%-retrievability duration, so the first assertion is
the critical semantic guard.

- [ ] **Step 2: Run and verify RED**

```sh
npm run test -- src/lib/fsrs/scheduler/review-scheduler.test.ts src/lib/fsrs/index.test.ts src/testing/architecture-boundaries.test.ts
```

Expected: FAIL because `getTargetDurationDays` is not exported.

- [ ] **Step 3: Implement through the current ts-fsrs public curve API**

Context7 confirms `forgetting_curve(parameters, elapsed_days, stability)` and
`scheduler.get_retrievability(card, at, false)` are current public APIs. Keep
the package import inside `adapter/ts-fsrs-adapter.ts`.

```ts
export function calculateTargetDurationDays(
  stability: number,
  options: FsrsSchedulingOptions,
): number {
  const normalized = normalizeFsrsSchedulingOptions(options)
  if (!Number.isFinite(stability) || stability <= 0) return Number.NaN
  if (normalized.targetRetention >= 1) return 0

  const parameters = createScheduler(options).parameters.w
  let low = 0
  let high = Math.max(1, stability)
  while (
    forgetting_curve(parameters, high, stability) > normalized.targetRetention
  ) {
    high *= 2
  }
  for (let step = 0; step < 60; step += 1) {
    const middle = (low + high) / 2
    if (
      forgetting_curve(parameters, middle, stability) >
      normalized.targetRetention
    ) {
      low = middle
    } else {
      high = middle
    }
  }
  return high
}
```

Expose a dependency-free wrapper from `review-scheduler.ts` and `index.ts`:

```ts
export function getTargetDurationDays(
  stability: number,
  options: FsrsSchedulingOptions = {},
): number {
  return calculateTargetDurationDays(stability, options)
}
```

- [ ] **Step 4: Run and commit**

```sh
npm run test -- src/lib/fsrs/scheduler/review-scheduler.test.ts src/lib/fsrs/index.test.ts src/testing/architecture-boundaries.test.ts
```

Expected: PASS.

```sh
git add src/lib/fsrs/adapter/ts-fsrs-adapter.ts src/lib/fsrs/scheduler/review-scheduler.ts src/lib/fsrs/scheduler/review-scheduler.test.ts src/lib/fsrs/index.ts src/lib/fsrs/index.test.ts
git commit -m "feat(fsrs): derive target duration"
```

## Task 2: Build one current-state source for Retention Map and Memory Signals

**Files:**

- Create: `src/features/analytics/domain/current-state-presentation.ts`
- Create: `src/features/analytics/domain/current-state-presentation.test.ts`
- Modify: `src/features/analytics/domain/chart-data.ts`
- Modify: `src/features/analytics/data/analytics-repository.ts`
- Modify: `src/features/analytics/data/analytics-repository.test.ts`

- [ ] **Step 1: Write failing cohort, boundary, and ordering tests**

Cover active/suspended/reviewed eligibility, invalid log values, status equality,
target-minus-ten equality, seven-day equality, deterministic top 30, full counts,
all six regions, each Memory Signal independently, multi-signal rows, range
independence, 25-row cap, and persistent ranks.

```ts
it('classifies exact target and watch boundaries', () => {
  expect(classifyRetentionStatus(0.9, 0.9)).toBe('on-target')
  expect(classifyRetentionStatus(0.8, 0.9)).toBe('watch')
  expect(classifyRetentionStatus(0.799, 0.9)).toBe('needs-attention')
})

it('uses one deterministic retained cohort for chart and table', () => {
  const view = buildCurrentStateViews({ cards: fortyCards, asOf, fsrsOptions })
  expect(view.retentionMap.rows).toHaveLength(30)
  expect(view.retentionMap.fullEligibleCount).toBe(40)
  expect(view.retentionMap.rows.map((row) => row.rank)).toEqual(
    Array.from({ length: 30 }, (_, index) => index + 1),
  )
})
```

- [ ] **Step 2: Verify RED**

```sh
npm run test -- src/features/analytics/domain/current-state-presentation.test.ts src/features/analytics/data/analytics-repository.test.ts
```

Expected: FAIL because the presentation builder does not exist.

- [ ] **Step 3: Implement exact rows and one total order**

```ts
export type RetentionStatus = 'on-target' | 'watch' | 'needs-attention'
export type DurabilitySide = 'under-week' | 'at-least-week'

export interface RetentionMapRow {
  rank: number
  slug: string
  title: string
  currentRecall: number
  targetRetention: number
  targetGap: number
  targetDurationDays: number
  lastReviewedAt: string
  dueAt: string
  difficulty: number
  lapses: number
  status: RetentionStatus
  durabilitySide: DurabilitySide
}

export interface MemorySignalRow {
  rank: number
  slug: string
  title: string
  reasons: Array<
    | { kind: 'below-recall'; value: number }
    | { kind: 'overdue'; localDays: number; sameLocalDay: boolean }
    | { kind: 'low-durability'; value: number }
  >
}
```

Sort Retention Map by the exact tier/shortfall/duration/title order from the
spec, then retain 30. Build Memory Signals from the full supported current-card
source, use transparent severity lanes, then retain 25. Do not calculate a
composite score.

- [ ] **Step 4: Run and commit**

```sh
npm run test -- src/features/analytics/domain/current-state-presentation.test.ts src/features/analytics/data/analytics-repository.test.ts
```

Expected: PASS.

```sh
git add src/features/analytics/domain/current-state-presentation.ts src/features/analytics/domain/current-state-presentation.test.ts src/features/analytics/domain/chart-data.ts src/features/analytics/data/analytics-repository.ts src/features/analytics/data/analytics-repository.test.ts
git commit -m "feat(analytics): build current memory diagnostics"
```

## Task 3: Serialize current-state view contracts

**Files:**

- Modify: `src/features/analytics/api/analytics-presentation-contracts.ts`
- Modify: `src/features/analytics/api/analytics-presentation-contracts.test.ts`
- Modify: `src/features/analytics/api/analytics-contracts.ts`
- Modify: `src/features/analytics/server/analytics-service.ts`
- Modify: `src/features/analytics/server/analytics-service.test.ts`

- [ ] **Step 1: Write failing Zod invariants**

Require positive target duration, rank bounds, status/region enums, maximum 30
map rows, maximum 25 signal rows, exact full counts, non-empty reasons, and
valid ISO due/last-review instants.

- [ ] **Step 2: Verify RED**

```sh
npm run test -- src/features/analytics/api/analytics-presentation-contracts.test.ts src/features/analytics/server/analytics-service.test.ts
```

Expected: FAIL on missing schemas/fields.

- [ ] **Step 3: Add view schemas and service composition**

```ts
export const currentStateViewsSchema = z.object({
  'retention-map': retentionMapViewSchema,
  'memory-signals': memorySignalsViewSchema,
})

export type RetentionMapView = z.infer<typeof retentionMapViewSchema>
export type MemorySignalsView = z.infer<typeof memorySignalsViewSchema>
```

Have the service call `buildCurrentStateViews` once. Remove the old service-side
reference curve calculation after the new views are integrated; it is not part
of the approved map.

- [ ] **Step 4: Run and commit**

```sh
npm run test -- src/features/analytics/api/analytics-presentation-contracts.test.ts src/features/analytics/api/analytics-contracts.test.ts src/features/analytics/server/analytics-service.test.ts
```

Expected: PASS.

```sh
git add src/features/analytics/api/analytics-presentation-contracts.ts src/features/analytics/api/analytics-presentation-contracts.test.ts src/features/analytics/api/analytics-contracts.ts src/features/analytics/server/analytics-service.ts src/features/analytics/server/analytics-service.test.ts
git commit -m "feat(analytics): serialize current diagnostics"
```

## Task 4: Render the six-region Retention Map

**Files:**

- Create: `src/features/analytics/components/charts/retention-map-chart.tsx`
- Create: `src/features/analytics/components/charts/retention-map-chart.test.tsx`
- Create: `src/features/analytics/components/charts/retention-map-detail.tsx`
- Create: `src/features/analytics/components/charts/retention-map-detail.test.tsx`
- Modify: `src/features/analytics/components/charts/index.ts`
- Delete in Phase 5: `src/features/analytics/components/charts/retention-health-chart.tsx`
- Delete in Phase 5: `src/features/analytics/components/charts/retention-health-tooltip.tsx`

- [ ] **Step 1: Write failing plot and color-independent tests**

Require log X, adaptive Y, target line, ten-point watch band, seven-day line,
six region labels, circle/diamond/triangle shapes, full counts, `showing N of M`,
one chart tab stop, deterministic rank arrow order, and same 30 rows in Table.

- [ ] **Step 2: Write failing detail lifecycle tests with fake timers**

```tsx
it('closes transient detail 150ms after pointer leaves', async () => {
  vi.useFakeTimers()
  render(<RetentionMapFigure view={view} />)
  await user.hover(screen.getByLabelText(/Reverse Linked List/))
  await user.unhover(
    screen.getByRole('dialog', { name: /Reverse Linked List/ }),
  )
  expect(screen.getByRole('dialog')).toBeVisible()
  vi.advanceTimersByTime(150)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('toggles the same pinned point closed and restores focus with Escape', async () => {
  const user = userEvent.setup()
  render(<RetentionMapFigure view={view} />)
  const chart = screen.getByRole('application', { name: 'Retention Map' })
  const mark = screen.getByLabelText(/Reverse Linked List/)

  await user.click(mark)
  expect(screen.getByRole('dialog')).toBeVisible()
  await user.click(mark)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await user.click(mark)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(chart).toHaveFocus()
})
```

Also test moving pointer/focus into detail, another-point pin movement, outside
click, ghost close button, touch toggle, safe title link, and absence of slug.

- [ ] **Step 3: Verify RED**

```sh
npm run test -- src/features/analytics/components/charts/retention-map-chart.test.tsx src/features/analytics/components/charts/retention-map-detail.test.tsx
```

Expected: FAIL because the map components do not exist.

- [ ] **Step 4: Implement explicit scatter and controlled detail state**

```ts
type RetentionDetailState =
  | { kind: 'closed' }
  | { kind: 'transient'; rank: number }
  | { kind: 'pinned'; rank: number }
```

Use `ScatterChart`, `ReferenceArea`, `ReferenceLine`, and custom SVG shapes.
Recharts 3 enables its accessibility layer by default, but keep CogniPace's one
surface tab stop, controlled live message, and exact Table path. Do not rely on
custom tooltip content to distinguish keyboard from pointer activation; own the
interaction state in the feature component.

- [ ] **Step 5: Run and commit**

```sh
npm run test -- src/features/analytics/components/charts/retention-map-chart.test.tsx src/features/analytics/components/charts/retention-map-detail.test.tsx src/lib/leetcode/domain/problem-url.test.ts
```

Expected: PASS.

```sh
git add src/features/analytics/components/charts/retention-map-chart.tsx src/features/analytics/components/charts/retention-map-chart.test.tsx src/features/analytics/components/charts/retention-map-detail.tsx src/features/analytics/components/charts/retention-map-detail.test.tsx src/features/analytics/components/charts/index.ts
git commit -m "feat(analytics): render retention map"
```

## Task 5: Render table-native Memory Signals

**Files:**

- Create: `src/features/analytics/components/memory-signals-table.tsx`
- Create: `src/features/analytics/components/memory-signals-table.test.tsx`
- Modify: `src/features/analytics/components/index.ts`
- Delete in Phase 5: `src/features/analytics/components/fragile-knowledge-table.tsx`

- [ ] **Step 1: Write failing semantic and density tests**

Require exactly Rank/Problem/Why it's here, five rows/page, persistent ranks,
25-row cap/full count copy, two-line title/reasons, labelled values, local
`Overdue today`, live page range, safe LeetCode title link, and no tooltip,
sort, filter, search, selection, or separate row action.

- [ ] **Step 2: Verify RED**

```sh
npm run test -- src/features/analytics/components/memory-signals-table.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement as a native table, not `AnalyticsFigure` chart mode**

```tsx
export function MemorySignalsTable({ view }: { view: MemorySignalsView }) {
  return (
    <Surface aria-labelledby="memory-signals-title" role="region">
      <header>
        <h2 id="memory-signals-title">Memory Signals by Problem</h2>
        <p>
          Which current problems need attention, and exactly why were they
          flagged?
        </p>
        <p>
          Current active problems that meet at least one explicit attention
          signal.
        </p>
      </header>
      <AnalyticsDataTable
        caption="Current problems meeting an attention signal"
        columns={memorySignalColumns}
        datasetKey={view.datasetKey}
        getRowKey={(row) => row.slug}
        pageSize={5}
        rows={view.rows}
      />
    </Surface>
  )
}
```

Reason formatting consumes structured reasons; it does not re-evaluate signal
truth.

- [ ] **Step 4: Run and commit**

```sh
npm run test -- src/features/analytics/components/memory-signals-table.test.tsx src/lib/leetcode/domain/problem-url.test.ts
```

Expected: PASS.

```sh
git add src/features/analytics/components/memory-signals-table.tsx src/features/analytics/components/memory-signals-table.test.tsx src/features/analytics/components/index.ts
git commit -m "feat(analytics): render memory signals"
```

## Task 6: Integrate current-state diagnostics and validate Phase 4

**Files:**

- Modify: `src/features/analytics/components/analytics-screen.tsx`
- Modify: `src/features/analytics/components/analytics-screen.test.tsx`
- Modify: `src/features/analytics/components/charts/index.ts`

- [ ] **Step 1: Write failing hierarchy and legacy-copy tests**

Require Retention Map full width followed by Memory Signals, canonical names,
current-state independence from range changes, and no Inspect Problem picker.

- [ ] **Step 2: Verify RED**

```sh
npm run test -- src/features/analytics/components/analytics-screen.test.tsx
```

Expected: FAIL on old Retention Health/Fragile Knowledge rendering.

- [ ] **Step 3: Switch the section**

```tsx
<RetentionMapFigure view={data.views['retention-map']} />
<MemorySignalsTable view={data.views['memory-signals']} />
```

- [ ] **Step 4: Run phase validation**

```sh
npm run test -- src/features/analytics src/lib/fsrs src/testing/architecture-boundaries.test.ts
npx prettier --check src/features/analytics src/lib/fsrs
git diff --check
npm run lint
npm run check
npm run build
```

Expected: all PASS.

- [ ] **Step 5: Commit and stop**

```sh
git add src/features/analytics src/lib/fsrs
git commit -m "feat(analytics): integrate current memory diagnostics"
```

Stop for human screenshot/interaction review of all six regions, capped/full
counts, transient and pinned detail, Table parity, Memory Signals density,
keyboard behavior, narrow width, and reduced motion before Phase 5.
