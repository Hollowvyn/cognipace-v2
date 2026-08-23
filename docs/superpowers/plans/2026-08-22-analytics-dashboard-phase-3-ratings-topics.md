# Analytics Dashboard Phase 3 Ratings and Topics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement and integrate Ratings Mix and Topic Performance with aggregate-first rating shares, sufficiently sampled topic ranking, exact tooltips/tables, and truthful low-evidence disclosure.

**Architecture:** Extend the historical presentation builder and additive `views` contract, then replace the second historical row with explicit 100% stacked and horizontal-bar figures. Keep ranking and qualification entirely out of React.

**Tech Stack:** TypeScript, Zod, React, Recharts BarChart, Vitest, Testing Library.

---

## Task 1: Build Ratings Mix and Topic Performance rows

**Files:**

- Modify: `src/features/analytics/domain/historical-presentation.ts`
- Modify: `src/features/analytics/domain/historical-presentation.test.ts`
- Deprecate later: `src/features/analytics/domain/chart-data.ts` topic/rating builders

- [ ] **Step 1: Write failing Ratings Mix tests**

```ts
it('aggregates rating counts before calculating shares', () => {
  const view = buildRatingsMixView({ events, frame, previousEvents })
  expect(view.rows[0]).toMatchObject({
    counts: { again: 1, hard: 1, good: 2, easy: 0 },
    validRatings: 4,
    shares: { again: 0.25, hard: 0.25, good: 0.5, easy: 0 },
  })
})

it('keeps an empty rating bucket unmeasured', () => {
  expect(emptyRow.validRatings).toBe(0)
  expect(emptyRow.shares).toBeNull()
})
```

Also test independently rounded displays, equivalent-elapsed prior comparison,
and suppression when either period fails evidence.

- [ ] **Step 2: Write failing Topic Performance tests**

```ts
it('counts an attempt once per unique topic and permits overlapping topics', () => {
  const view = buildTopicPerformanceView({ events, frame })
  expect(view.rows.find((row) => row.topic === 'Hash Table')).toMatchObject({
    validRatings: 10,
    distinctProblems: 3,
  })
})

it('sorts by success, sample, then normalized label and retains five', () => {
  const view = buildTopicPerformanceView({ events: qualifyingTopics, frame })
  expect(view.rows).toHaveLength(5)
  expect(view.rows.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5])
})
```

Test 0–5 qualifying topics, 10-rating equality, 3-problem equality, duplicate
topic labels on one problem, deterministic ties, at-most-five low-evidence
progress entries, and omitted stronger counts.

- [ ] **Step 3: Verify RED**

```sh
npm run test -- src/features/analytics/domain/historical-presentation.test.ts -t "Ratings Mix|Topic Performance"
```

Expected: FAIL because the builders do not exist.

- [ ] **Step 4: Implement exact contracts**

```ts
export interface RatingsMixRow {
  key: string
  bucketStart: string
  bucketEnd: string
  isPartial: boolean
  counts: { again: number; hard: number; good: number; easy: number }
  shares: { again: number; hard: number; good: number; easy: number } | null
  validRatings: number
  challengingCount: number
  challengingShare: number | null
  evidence: AnalyticsEvidenceLabel[]
}

export interface TopicPerformanceRow {
  rank: number
  topic: string
  goodEasyCount: number
  validRatings: number
  distinctProblems: number
  reviewSuccess: number
  evidence: AnalyticsEvidenceLabel[]
}
```

Return topic rows already ranked and capped. React must not filter or sort.

- [ ] **Step 5: Run and commit**

```sh
npm run test -- src/features/analytics/domain/historical-presentation.test.ts
```

Expected: PASS.

```sh
git add src/features/analytics/domain/historical-presentation.ts src/features/analytics/domain/historical-presentation.test.ts
git commit -m "feat(analytics): build ratings and topic views"
```

## Task 2: Extend schemas and service views

**Files:**

- Modify: `src/features/analytics/api/analytics-presentation-contracts.ts`
- Modify: `src/features/analytics/api/analytics-presentation-contracts.test.ts`
- Modify: `src/features/analytics/api/analytics-contracts.ts`
- Modify: `src/features/analytics/server/analytics-service.ts`
- Modify: `src/features/analytics/server/analytics-service.test.ts`

- [ ] **Step 1: Write failing schema invariants**

Require a Ratings Mix non-empty row's counts to sum to `validRatings`, nullable
shares only for empty rows, topic rows to satisfy `validRatings >= 10` and
`distinctProblems >= 3`, ranks 1–5, and no more than five rows.

- [ ] **Step 2: Verify RED**

```sh
npm run test -- src/features/analytics/api/analytics-presentation-contracts.test.ts src/features/analytics/server/analytics-service.test.ts
```

Expected: FAIL on missing view schemas.

- [ ] **Step 3: Add the schemas and service composition**

```ts
export const historicalCompositionViewsSchema = z.object({
  'ratings-mix': ratingsMixViewSchema,
  'topic-performance': topicPerformanceViewSchema,
})

export type RatingsMixView = z.infer<typeof ratingsMixViewSchema>
export type TopicPerformanceView = z.infer<typeof topicPerformanceViewSchema>
```

Build both views from the already fetched review history, topics, frame, and
equivalent elapsed prior range. Remove no compatibility fields yet.

- [ ] **Step 4: Run and commit**

```sh
npm run test -- src/features/analytics/api/analytics-presentation-contracts.test.ts src/features/analytics/api/analytics-contracts.test.ts src/features/analytics/server/analytics-service.test.ts
```

Expected: PASS.

```sh
git add src/features/analytics/api/analytics-presentation-contracts.ts src/features/analytics/api/analytics-presentation-contracts.test.ts src/features/analytics/api/analytics-contracts.ts src/features/analytics/server/analytics-service.ts src/features/analytics/server/analytics-service.test.ts
git commit -m "feat(analytics): serialize ratings and topics"
```

## Task 3: Render Ratings Mix and Topic Performance

**Files:**

- Replace: `src/features/analytics/components/charts/ratings-mix-chart.tsx`
- Modify: `src/features/analytics/components/charts/charts.test.tsx`
- Replace: `src/features/analytics/components/charts/weakest-topics-chart.tsx`
- Create: `src/features/analytics/components/charts/topic-performance-chart.test.tsx`
- Modify: `src/features/analytics/components/charts/index.ts`

- [ ] **Step 1: Write failing UI contracts**

Ratings Mix tests require stable Again/Hard/Good/Easy stack/legend order,
`0..100%`, no stack for empty rows, tooltip counts/shares without Challenging,
period-level Hard+Again context, and a seven-row exact table.

Topic tests require 0–5 horizontal bars, full `0..100%`, exact end labels, no
pagination, same rows in Table, long-label accessibility, low-evidence/omitted
disclosure, and the exact empty state.

- [ ] **Step 2: Verify RED**

```sh
npm run test -- src/features/analytics/components/charts/charts.test.tsx src/features/analytics/components/charts/topic-performance-chart.test.tsx
```

Expected: FAIL against current correctness-based contracts.

- [ ] **Step 3: Implement the explicit figures**

```tsx
export function RatingsMixFigure({ view }: { view: RatingsMixView }) {
  return (
    <AnalyticsFigure
      chart={<RatingsMixChart rows={view.rows} />}
      datasetKey={view.datasetKey}
      definition={analyticsViewCatalogue['ratings-mix']}
      evidence={view.evidence}
      table={<RatingsMixTable rows={view.rows} datasetKey={view.datasetKey} />}
      takeaway={<RatingsMixTakeaway context={view.periodContext} />}
    />
  )
}

export function TopicPerformanceFigure({
  view,
}: {
  view: TopicPerformanceView
}) {
  return (
    <AnalyticsFigure
      chart={<TopicPerformanceChart rows={view.rows} />}
      datasetKey={view.datasetKey}
      definition={analyticsViewCatalogue['topic-performance']}
      details={<TopicEvidenceDetails evidence={view.topicEvidence} />}
      evidence={view.evidence}
      table={
        <TopicPerformanceTable rows={view.rows} datasetKey={view.datasetKey} />
      }
      takeaway={
        <p>
          Showing the qualifying topics with the lowest Review Success in this
          period.
        </p>
      }
    />
  )
}
```

Use `BarChart` explicitly in each component. Do not build a configurable
bar-chart abstraction.

- [ ] **Step 4: Run and commit**

```sh
npm run test -- src/features/analytics/components/charts/charts.test.tsx src/features/analytics/components/charts/topic-performance-chart.test.tsx
```

Expected: PASS.

```sh
git add src/features/analytics/components/charts/ratings-mix-chart.tsx src/features/analytics/components/charts/weakest-topics-chart.tsx src/features/analytics/components/charts/charts.test.tsx src/features/analytics/components/charts/topic-performance-chart.test.tsx src/features/analytics/components/charts/index.ts
git commit -m "feat(analytics): render ratings and topic views"
```

## Task 4: Integrate the second historical row and validate Phase 3

**Files:**

- Modify: `src/features/analytics/components/analytics-screen.tsx`
- Modify: `src/features/analytics/components/analytics-screen.test.tsx`

- [ ] **Step 1: Write failing hierarchy tests**

Require the paired Ratings Mix and Topic Performance row after Memory Strength
and Practice Rhythm; require superseded “Where to focus”/observed-correctness
copy to be absent from the migrated section.

- [ ] **Step 2: Verify RED**

```sh
npm run test -- src/features/analytics/components/analytics-screen.test.tsx
```

Expected: FAIL on old headings/order.

- [ ] **Step 3: Switch the row**

```tsx
<div className="grid min-w-0 gap-4 lg:grid-cols-2">
  <RatingsMixFigure view={data.views['ratings-mix']} />
  <TopicPerformanceFigure view={data.views['topic-performance']} />
</div>
```

- [ ] **Step 4: Run phase validation**

```sh
npm run test -- src/features/analytics
npx prettier --check src/features/analytics
git diff --check
npm run lint
npm run check
npm run build
```

Expected: all PASS.

- [ ] **Step 5: Commit and stop**

```sh
git add src/features/analytics
git commit -m "feat(analytics): integrate ratings and topic story"
```

Stop for review of rating order, long topics, sparse evidence, 14/30/90 ranges,
and narrow layouts before Phase 4.
