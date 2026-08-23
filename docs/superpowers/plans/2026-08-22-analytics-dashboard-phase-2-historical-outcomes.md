# Analytics Dashboard Phase 2 Historical Outcomes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement and integrate Observed Recall vs FSRS Estimate, Memory Strength, and Practice Rhythm using the locked paired-review, stability, Review Success, evidence, scale, tooltip, and table contracts.

**Architecture:** Add pure historical presentation builders over existing repository review events, extend the additive runtime `views` payload, then replace the first historical screen section with three explicit Recharts components inside `AnalyticsFigure`.

**Tech Stack:** TypeScript, Zod, React, Recharts ComposedChart/LineChart, Vitest, Testing Library.

---

## Task 1: Build the paired review and stability presentation rows

**Files:**

- Create: `src/features/analytics/domain/historical-presentation.ts`
- Create: `src/features/analytics/domain/historical-presentation.test.ts`
- Modify: `src/features/analytics/domain/chart-data.ts`
- Modify: `src/features/analytics/domain/chart-data.test.ts`

- [ ] **Step 1: Write failing View 1 and View 2 builder tests**

Cover exact pairing, Again-only measured zero, invalid/missing FSRS replay,
aggregate-first mean, reconstructed provenance, Tukey hinges, four-value IQR,
median per-event stability delta, and partial buckets.

```ts
it('pairs recalled outcomes and estimates on the same reviews', () => {
  const result = buildObservedRecallVsFsrsView({ events, frame, fsrsOptions })
  expect(result.rows[0]).toMatchObject({
    recalledCount: 2,
    pairedReviews: 3,
    observedRecall: 2 / 3,
    fsrsEstimate: expect.any(Number),
    provenance: 'reconstructed',
  })
  expect(result.rows[0]!.difference).toBeCloseTo(
    result.rows[0]!.observedRecall! - result.rows[0]!.fsrsEstimate!,
  )
})

it('uses Tukey hinges only when a bucket has four stability samples', () => {
  const result = summarizeStability([1, 2, 8, 9])
  expect(result).toEqual({ median: 5, q1: 1.5, q3: 8.5 })
  expect(summarizeStability([1, 2, 8])).toEqual({
    median: 2,
    q1: null,
    q3: null,
  })
})
```

- [ ] **Step 2: Run tests and verify RED**

```sh
npm run test -- src/features/analytics/domain/historical-presentation.test.ts
```

Expected: FAIL because the builders do not exist.

- [ ] **Step 3: Implement exact row contracts**

```ts
export interface ObservedRecallVsFsrsRow {
  key: string
  bucketStart: string
  bucketEnd: string
  isPartial: boolean
  recalledCount: number
  pairedReviews: number
  observedRecall: number | null
  fsrsEstimate: number | null
  difference: number | null
  targetRetention: number
  provenance: 'captured' | 'reconstructed' | 'not-measured'
  evidence: AnalyticsEvidenceLabel[]
}

export interface MemoryStrengthRow {
  key: string
  bucketStart: string
  bucketEnd: string
  isPartial: boolean
  medianDays: number | null
  q1Days: number | null
  q3Days: number | null
  eligibleReviews: number
  medianDeltaDays: number | null
  provenance: 'captured' | 'reconstructed' | 'not-measured'
  evidence: AnalyticsEvidenceLabel[]
}
```

View 1 must derive both series from reviews that have both a valid rating and a
finite pre-review estimate. Do not include Good + Easy context. View 2's delta
is the median of per-event post-minus-pre differences.

- [ ] **Step 4: Run focused domain tests and commit**

```sh
npm run test -- src/features/analytics/domain/historical-presentation.test.ts src/features/analytics/domain/chart-data.test.ts
```

Expected: PASS.

```sh
git add src/features/analytics/domain/historical-presentation.ts src/features/analytics/domain/historical-presentation.test.ts src/features/analytics/domain/chart-data.ts src/features/analytics/domain/chart-data.test.ts
git commit -m "feat(analytics): build recall and strength views"
```

## Task 2: Build the Practice Rhythm presentation rows

**Files:**

- Modify: `src/features/analytics/domain/historical-presentation.ts`
- Modify: `src/features/analytics/domain/historical-presentation.test.ts`

- [ ] **Step 1: Write failing Review Success tests**

```ts
it('computes Review Success from aggregate Good and Easy counts', () => {
  const result = buildPracticeRhythmView({ events, frame })
  expect(result.rows[0]).toMatchObject({
    completedReviews: 4,
    goodEasyCount: 3,
    validRatings: 4,
    reviewSuccess: 0.75,
  })
})

it('keeps known zero volume separate from unknown history', () => {
  expect(knownEmptyRow).toMatchObject({
    completedReviews: 0,
    reviewSuccess: null,
    historyAvailable: true,
  })
  expect(unknownRow).toMatchObject({
    completedReviews: null,
    reviewSuccess: null,
    historyAvailable: false,
  })
})
```

- [ ] **Step 2: Verify RED**

```sh
npm run test -- src/features/analytics/domain/historical-presentation.test.ts -t "Practice Rhythm"
```

Expected: FAIL on missing builder/fields.

- [ ] **Step 3: Implement the locked contract**

```ts
export interface PracticeRhythmRow {
  key: string
  bucketStart: string
  bucketEnd: string
  isPartial: boolean
  completedReviews: number | null
  goodEasyCount: number
  validRatings: number
  reviewSuccess: number | null
  historyAvailable: boolean
  evidence: AnalyticsEvidenceLabel[]
}
```

Count valid Again/Hard/Good/Easy attempts. Compute `(Good + Easy) / valid` only
after bucket aggregation. Reuse the shared count and adaptive percentage domain
helpers in the returned view metadata.

- [ ] **Step 4: Run and commit**

```sh
npm run test -- src/features/analytics/domain/historical-presentation.test.ts
```

Expected: PASS.

```sh
git add src/features/analytics/domain/historical-presentation.ts src/features/analytics/domain/historical-presentation.test.ts
git commit -m "feat(analytics): build practice rhythm view"
```

## Task 3: Extend Zod contracts and service orchestration

**Files:**

- Modify: `src/features/analytics/api/analytics-presentation-contracts.ts`
- Modify: `src/features/analytics/api/analytics-presentation-contracts.test.ts`
- Modify: `src/features/analytics/api/analytics-contracts.ts`
- Modify: `src/features/analytics/server/analytics-service.ts`
- Modify: `src/features/analytics/server/analytics-service.test.ts`
- Modify: `src/extension/background/register-handlers.test.ts`

- [ ] **Step 1: Write failing schema and service tests**

Require nullable measured fields, paired-count consistency, provenance enum,
IQR pair consistency, Practice Rhythm history availability, meta domains, and
exact `views` keys.

```ts
expect(parsed.views['observed-recall-vs-fsrs'].rows[0]).toMatchObject({
  recalledCount: 2,
  pairedReviews: 3,
  provenance: 'reconstructed',
})
expect(parsed.views['practice-rhythm'].rows[0]).toMatchObject({
  completedReviews: 4,
  reviewSuccess: 0.75,
})
```

- [ ] **Step 2: Verify RED**

```sh
npm run test -- src/features/analytics/api/analytics-presentation-contracts.test.ts src/features/analytics/server/analytics-service.test.ts src/extension/background/register-handlers.test.ts
```

Expected: FAIL because the new view schemas are absent.

- [ ] **Step 3: Add schemas and build once in the service**

Add:

```ts
export const historicalOutcomeViewsSchema = z.object({
  'observed-recall-vs-fsrs': observedRecallVsFsrsViewSchema,
  'memory-strength': memoryStrengthViewSchema,
  'practice-rhythm': practiceRhythmViewSchema,
})

export type ObservedRecallVsFsrsView = z.infer<
  typeof observedRecallVsFsrsViewSchema
>
export type MemoryStrengthView = z.infer<typeof memoryStrengthViewSchema>
export type PracticeRhythmView = z.infer<typeof practiceRhythmViewSchema>
```

Have `getAnalyticsSummary` build the three view models from the same fetched
review history and time frame. Do not query the repository from a chart or
builder. Keep old response fields temporarily for unmigrated views.

- [ ] **Step 4: Run and commit**

```sh
npm run test -- src/features/analytics/api/analytics-presentation-contracts.test.ts src/features/analytics/api/analytics-contracts.test.ts src/features/analytics/server/analytics-service.test.ts src/extension/background/register-handlers.test.ts
```

Expected: PASS.

```sh
git add src/features/analytics/api/analytics-presentation-contracts.ts src/features/analytics/api/analytics-presentation-contracts.test.ts src/features/analytics/api/analytics-contracts.ts src/features/analytics/server/analytics-service.ts src/features/analytics/server/analytics-service.test.ts src/extension/background/register-handlers.test.ts
git commit -m "feat(analytics): serialize historical outcomes"
```

## Task 4: Render Observed Recall vs FSRS Estimate

**Files:**

- Create: `src/features/analytics/components/charts/observed-recall-fsrs-chart.tsx`
- Create: `src/features/analytics/components/charts/observed-recall-fsrs-chart.test.tsx`
- Modify: `src/features/analytics/components/charts/index.ts`
- Delete in Phase 5: `src/features/analytics/components/charts/recall-quality-chart.tsx`

- [ ] **Step 1: Write failing rendering, tooltip, table, and a11y tests**

Test two series, target reference, measured markers only, adaptive range text,
short/long gaps, exact tooltip fields/order, seven-row table, one chart tab stop,
chronological arrow inspection, and neutral unsupported takeaway.

- [ ] **Step 2: Verify RED**

```sh
npm run test -- src/features/analytics/components/charts/observed-recall-fsrs-chart.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the explicit chart pair**

Export one component that receives the validated view model:

```tsx
export function ObservedRecallFsrsFigure({
  view,
}: {
  view: ObservedRecallVsFsrsView
}) {
  return (
    <AnalyticsFigure
      chart={<ObservedRecallFsrsChart rows={view.rows} domain={view.domain} />}
      datasetKey={view.datasetKey}
      definition={analyticsViewCatalogue['observed-recall-vs-fsrs']}
      evidence={view.evidence}
      table={
        <ObservedRecallFsrsTable
          rows={view.rows}
          datasetKey={view.datasetKey}
        />
      }
      takeaway={<ObservedRecallTakeaway view={view} />}
    />
  )
}
```

Use explicit Recharts `LineChart`, two `Line` series, `ReferenceLine`, and the
existing deterministic segment helper. No chart component calculates ratios.

- [ ] **Step 4: Run and commit**

```sh
npm run test -- src/features/analytics/components/charts/observed-recall-fsrs-chart.test.tsx src/features/analytics/components/charts/line-segments.test.tsx
```

Expected: PASS.

```sh
git add src/features/analytics/components/charts/observed-recall-fsrs-chart.tsx src/features/analytics/components/charts/observed-recall-fsrs-chart.test.tsx src/features/analytics/components/charts/index.ts
git commit -m "feat(analytics): render recall estimate comparison"
```

## Task 5: Render Memory Strength and Practice Rhythm

**Files:**

- Replace: `src/features/analytics/components/charts/memory-strength-chart.tsx`
- Modify: `src/features/analytics/components/charts/charts.test.tsx`
- Replace: `src/features/analytics/components/charts/consistency-chart.tsx`
- Create: `src/features/analytics/components/charts/practice-rhythm-chart.test.tsx`
- Modify: `src/features/analytics/components/charts/index.ts`

- [ ] **Step 1: Write failing chart-specific tests**

For Memory Strength, test the median line, conditional IQR band, adaptive day
range disclosure, provenance, and seven-row exact table. For Practice Rhythm,
test zero-based count bars, adaptive Review Success line, two named axes,
Good+Easy denominator tooltip, `Not measured`, and “Association, not causation.”

- [ ] **Step 2: Verify RED**

```sh
npm run test -- src/features/analytics/components/charts/charts.test.tsx src/features/analytics/components/charts/practice-rhythm-chart.test.tsx
```

Expected: FAIL against the old chart contracts.

- [ ] **Step 3: Implement explicit Recharts components**

Use `LineChart` plus `Area`/range geometry for supported IQR and a
`ComposedChart` for bars + line. Both components receive rows and domains only:

```ts
export interface MemoryStrengthChartProps {
  domain: readonly [number, number]
  rows: readonly MemoryStrengthRow[]
}

export interface PracticeRhythmChartProps {
  countDomain: readonly [number, number]
  rows: readonly PracticeRhythmRow[]
  successDomain: readonly [number, number]
}
```

Do not reuse the old `observedCorrectness` name.

- [ ] **Step 4: Run and commit**

```sh
npm run test -- src/features/analytics/components/charts/charts.test.tsx src/features/analytics/components/charts/practice-rhythm-chart.test.tsx
```

Expected: PASS.

```sh
git add src/features/analytics/components/charts/memory-strength-chart.tsx src/features/analytics/components/charts/consistency-chart.tsx src/features/analytics/components/charts/charts.test.tsx src/features/analytics/components/charts/practice-rhythm-chart.test.tsx src/features/analytics/components/charts/index.ts
git commit -m "feat(analytics): render strength and rhythm views"
```

## Task 6: Integrate the first historical section and validate Phase 2

**Files:**

- Modify: `src/features/analytics/components/analytics-screen.tsx`
- Modify: `src/features/analytics/components/analytics-screen.test.tsx`
- Modify: `src/features/analytics/components/analytics-range-control.tsx`
- Create: `src/features/analytics/components/analytics-range-control.test.tsx`

- [ ] **Step 1: Write failing story-order and range-announcement tests**

Require View 1 full width followed by paired Memory Strength and Practice
Rhythm, one evidence summary, exact range/timezone/as-of copy, and no repeated
readiness banners in those migrated figures.

- [ ] **Step 2: Verify RED**

```sh
npm run test -- src/features/analytics/components/analytics-screen.test.tsx
```

Expected: FAIL on old headings/order/warnings.

- [ ] **Step 3: Switch only the migrated section**

Render:

```tsx
<ObservedRecallFsrsFigure view={data.views['observed-recall-vs-fsrs']} />
<div className="grid min-w-0 gap-4 lg:grid-cols-2">
  <MemoryStrengthFigure view={data.views['memory-strength']} />
  <PracticeRhythmFigure view={data.views['practice-rhythm']} />
</div>
```

Leave Views 4–9 on their current implementations until their phases.

- [ ] **Step 4: Run focused and full validation**

```sh
npm run test -- src/features/analytics
npx prettier --check src/features/analytics
git diff --check
npm run lint
npm run check
npm run build
```

Expected: all PASS.

- [ ] **Step 5: Commit the phase checkpoint**

```sh
git add src/features/analytics
git commit -m "feat(analytics): integrate historical outcome story"
```

Stop for human review of desktop/narrow screenshots and sparse fixtures before
starting Phase 3. The final PR still requires real-time human smoke proof.
