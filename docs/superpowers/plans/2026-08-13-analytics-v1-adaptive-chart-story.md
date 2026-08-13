# Analytics V1 Adaptive Chart Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current sparse, disconnected Analytics presentation with
an adaptive, evidence-gated chart story whose 14-, 30-, and 90-day views remain
truthful, readable, actionable, and easy to debug.

**Architecture:** Keep raw persisted review and FSRS interpretation in the
Analytics repository/service boundary. Add feature-owned range, readiness, and
presentation-bucket domain modules that produce Zod-validated chart-ready data;
keep explicit Recharts components responsible only for presentation and
interaction. Current-state and fixed-forecast panels remain available when a
historical range is unready.

**Tech Stack:** React 19, TypeScript, Recharts 3.10 through the local shadcn
Chart primitive, TanStack Query/Router, Zod, Vitest, Testing Library, WXT, and
CogniPace semantic CSS tokens.

---

## Scope and file map

Create these focused domain and chart-contract units:

- `src/features/analytics/domain/analytics-range-policy.ts`: deterministic
  bucket selection and boundary generation for current and future ranges.
- `src/features/analytics/domain/analytics-range-policy.test.ts`: range and
  boundary tests, including 7- and 120-day examples.
- `src/features/analytics/domain/analytics-readiness.ts`: effective-window,
  `S/A/G/K/E`, gate, failure-reason, and richest-range calculations.
- `src/features/analytics/domain/analytics-readiness.test.ts`: readiness and
  continuity safeguards.
- `src/features/analytics/domain/chart-buckets.ts`: reusable count, ratio,
  median, last-value, and line-continuity presentation transforms.
- `src/features/analytics/domain/chart-buckets.test.ts`: preservation and
  continuity tests.
- `src/features/analytics/components/charts/chart-definitions.ts`: typed chart
  catalogue with stable IDs, series keys, semantic labels, eligibility, and
  warnings.
- `src/features/analytics/components/charts/line-segments.tsx`: small shared
  renderer for solid measured runs and permitted dashed bridges.
- `src/features/analytics/components/charts/retention-health-tooltip.tsx`:
  interactive pinned problem details and canonical LeetCode action.
- `src/features/analytics/components/analytics-readiness-state.tsx`:
  explainable selected-range progress and shorter-range recommendation.

Modify these existing owners:

- `src/features/analytics/domain/chart-data.ts` and its tests: build adaptive
  bucket samples instead of hard-coded daily/weekly output.
- `src/features/analytics/domain/summary.ts` and its tests: serialize readiness
  and revised chart fields.
- `src/features/analytics/server/analytics-service.ts` and its tests: request
  the full comparison history once, calculate range evidence, and compose the
  revised read model.
- `src/features/analytics/api/analytics-contracts.ts` and its tests: validate
  range policies, readiness, buckets, and metric statuses.
- `src/features/analytics/components/charts/*.tsx` and `charts.test.tsx`:
  implement the approved chart marks, semantics, and interactions.
- `src/features/analytics/components/fragile-knowledge-table.tsx` and its test:
  five-row pagination and canonical LeetCode links.
- `src/features/analytics/components/analytics-screen.tsx` and its test:
  compose the approved story and preserve current-state panels while history is
  unready.
- `src/features/analytics/domain/metric-definitions.ts`: align user-facing
  meaning and sparse-state copy.
- `src/styles/tokens.css`: add named Analytics semantic colors instead of
  positional chart-color assumptions.
- `docs/product.md`, `docs/architecture.md`, and `docs/testing.md`: document the
  implemented behavior and required manual proof.

Do not modify the generic chart primitive unless a focused test demonstrates a
missing generic capability. Do not add persistence, snapshots, permissions,
sync behavior, or a generic chart-renderer abstraction.

### Task 1: Add deterministic range and bucket policy

**Files:**

- Create: `src/features/analytics/domain/analytics-range-policy.ts`
- Create: `src/features/analytics/domain/analytics-range-policy.test.ts`

- [ ] **Step 1: Write failing policy tests**

```ts
import { describe, expect, it } from 'vitest'

import {
  buildAnalyticsBuckets,
  getAnalyticsRangePolicy,
} from './analytics-range-policy'

describe('analytics range policy', () => {
  it.each([
    [7, 1],
    [14, 1],
    [30, 3],
    [90, 7],
    [120, 14],
  ])('uses readable buckets for %s days', (requestedDays, bucketDays) => {
    expect(getAnalyticsRangePolicy(requestedDays).bucketDays).toBe(bucketDays)
  })

  it('builds inclusive 14-day daily boundaries without an extra point', () => {
    const buckets = buildAnalyticsBuckets({
      requestedDays: 14,
      periodEnd: new Date('2026-08-13T12:00:00.000Z'),
    })

    expect(buckets).toHaveLength(14)
    expect(buckets[0]?.start.toISOString()).toBe('2026-07-31T00:00:00.000Z')
    expect(buckets.at(-1)?.end.toISOString()).toBe('2026-08-13T23:59:59.999Z')
  })

  it('keeps partial calendar-week boundaries in the selected 90-day period', () => {
    const buckets = buildAnalyticsBuckets({
      requestedDays: 90,
      periodEnd: new Date('2026-08-13T12:00:00.000Z'),
    })

    expect(buckets[0]?.start >= new Date('2026-05-16T00:00:00.000Z')).toBe(true)
    expect(buckets.at(-1)?.end.toISOString()).toBe('2026-08-13T23:59:59.999Z')
    expect(buckets.every((bucket) => bucket.start <= bucket.end)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test and verify the red state**

Run:

```sh
npm test -- src/features/analytics/domain/analytics-range-policy.test.ts --run
```

Expected: FAIL because `analytics-range-policy.ts` does not exist.

- [ ] **Step 3: Implement the policy and bucket contracts**

Use these public contracts and deterministic rules:

```ts
export interface AnalyticsBucket {
  key: string
  start: Date
  end: Date
  label: string
}

export interface AnalyticsRangePolicy {
  requestedDays: number
  bucketDays: number
  maximumGapBuckets: number
}

export function getAnalyticsRangePolicy(
  requestedDays: number,
): AnalyticsRangePolicy {
  if (!Number.isInteger(requestedDays) || requestedDays < 1) {
    throw new RangeError('Analytics range must be a positive whole day count.')
  }

  const bucketDays =
    requestedDays <= 14
      ? 1
      : ([2, 3, 7, 14, 30]
          .map((candidate) => ({
            candidate,
            points: Math.ceil(requestedDays / candidate),
          }))
          .filter(({ points }) => points >= 8 && points <= 14)
          .sort(
            (left, right) =>
              Math.abs(left.points - 11) - Math.abs(right.points - 11) ||
              left.candidate - right.candidate,
          )[0]?.candidate ?? 30)

  return {
    requestedDays,
    bucketDays,
    maximumGapBuckets: requestedDays <= 7 ? 1 : 2,
  }
}
```

`buildAnalyticsBuckets` must normalize the selected end to the local end of
day, create exactly `requestedDays` inclusive calendar days, align seven-day
buckets to local Monday boundaries, clip the first and last bucket to the
requested period, and use consecutive selected-period boundaries for all other
bucket sizes. Keys are local `YYYY-MM-DD` bucket starts; labels are derived from
the clipped start/end dates.

- [ ] **Step 4: Run focused tests and verify green**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit the policy**

```sh
git add src/features/analytics/domain/analytics-range-policy.ts src/features/analytics/domain/analytics-range-policy.test.ts
git commit -m "feat(analytics): add adaptive range policy"
```

### Task 2: Add explainable evidence readiness

**Files:**

- Create: `src/features/analytics/domain/analytics-readiness.ts`
- Create: `src/features/analytics/domain/analytics-readiness.test.ts`

- [ ] **Step 1: Write failing `S/A/G/K/E` tests**

```ts
import { describe, expect, it } from 'vitest'

import {
  calculateAnalyticsReadiness,
  findRichestReadyRange,
} from './analytics-readiness'

describe('analytics readiness', () => {
  it('trims only leading empty buckets and calculates evidence gates', () => {
    const result = calculateAnalyticsReadiness({
      requestedDays: 30,
      evidenceCounts: [0, 0, 4, 2, 0, 3, 0, 0, 5, 1],
      bucketKeys: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10'],
    })

    expect(result).toMatchObject({
      effectiveStart: 'b3',
      effectiveBuckets: 8,
      assessments: 15,
      activeBuckets: 5,
      longestGap: 2,
      gapRuns: 2,
    })
  })

  it('rejects repeated bridgeable gaps that create a fragmented chart', () => {
    const result = calculateAnalyticsReadiness({
      requestedDays: 14,
      evidenceCounts: [3, 0, 0, 3, 0, 0, 3, 0, 0, 3, 0, 0, 3, 3],
      bucketKeys: Array.from({ length: 14 }, (_, index) => `d${index + 1}`),
    })

    expect(result.ready).toBe(false)
    expect(result.failingReasons).toContain('too-many-gaps')
  })

  it('allows one two-day gap in an otherwise rich 14-day range', () => {
    const result = calculateAnalyticsReadiness({
      requestedDays: 14,
      evidenceCounts: [2, 2, 2, 2, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2],
      bucketKeys: Array.from({ length: 14 }, (_, index) => `d${index + 1}`),
    })

    expect(result.ready).toBe(true)
    expect(result.longestGap).toBe(2)
  })

  it('returns the longest configured passing range', () => {
    expect(
      findRichestReadyRange([
        { range: 14, ready: true },
        { range: 30, ready: true },
        { range: 90, ready: false },
      ]),
    ).toBe(30)
  })
})
```

- [ ] **Step 2: Verify the readiness tests fail**

Run:

```sh
npm test -- src/features/analytics/domain/analytics-readiness.test.ts --run
```

Expected: FAIL because the readiness module does not exist.

- [ ] **Step 3: Implement the readiness result and formulas**

```ts
export type ReadinessFailure =
  | 'no-evidence'
  | 'insufficient-span'
  | 'insufficient-assessments'
  | 'insufficient-active-buckets'
  | 'gap-too-long'
  | 'too-many-gaps'

export interface AnalyticsReadiness {
  ready: boolean
  requestedDays: number
  bucketDays: number
  requestedBuckets: number
  effectiveBuckets: number
  effectiveStart: string | null
  assessments: number
  minimumAssessments: number
  activeBuckets: number
  minimumActiveBuckets: number
  longestGap: number
  maximumGap: number
  gapRuns: number
  maximumGapRuns: number
  failingReasons: ReadinessFailure[]
}
```

Implement the approved formulas exactly:

```ts
const minimumEffectiveBuckets = Math.ceil(requestedBuckets * 0.6)
const minimumAssessments = Math.ceil(
  Math.max(12, requestedDays * 0.5, Math.min(requestedDays, 30) * 0.8),
)
const coverage = Math.min(
  0.8,
  Math.max(0.55, 0.76 - 0.06 * Math.log2(requestedDays / 7)),
)
const minimumActiveBuckets = Math.ceil(coverage * effectiveBuckets)
const maximumGap = requestedDays <= 7 ? 1 : 2
const maximumGapRuns = Math.max(1, Math.ceil(effectiveBuckets * 0.2))
```

Leading zeroes are excluded before `S`, `A`, `G`, `K`, and `E` are computed.
Internal and trailing zeroes remain. Return every failing reason in stable gate
order. `findRichestReadyRange` sorts passing configured ranges numerically and
returns the largest or `null`.

- [ ] **Step 4: Verify focused readiness tests pass**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit readiness**

```sh
git add src/features/analytics/domain/analytics-readiness.ts src/features/analytics/domain/analytics-readiness.test.ts
git commit -m "feat(analytics): evaluate historical evidence readiness"
```

### Task 3: Add bucket aggregation and line-continuity transforms

**Files:**

- Create: `src/features/analytics/domain/chart-buckets.ts`
- Create: `src/features/analytics/domain/chart-buckets.test.ts`
- Modify: `src/features/analytics/domain/chart-data.ts`
- Modify: `src/features/analytics/domain/chart-data.test.ts`

- [ ] **Step 1: Write failing aggregation and continuity tests**

```ts
import { describe, expect, it } from 'vitest'

import { classifyLineContinuity, recomputeBucketRatio } from './chart-buckets'

describe('chart buckets', () => {
  it('recomputes ratios from totals instead of averaging percentages', () => {
    expect(
      recomputeBucketRatio([
        { numerator: 1, denominator: 1 },
        { numerator: 0, denominator: 9 },
      ]),
    ).toBe(0.1)
  })

  it('classifies a permitted two-bucket hole as a dashed bridge', () => {
    expect(classifyLineContinuity([0.8, null, null, 0.84], 2)).toEqual([
      { kind: 'bridge', fromIndex: 0, toIndex: 3 },
    ])
  })

  it('rejects a bridge longer than the range policy permits', () => {
    expect(classifyLineContinuity([0.8, null, null, null, 0.84], 2)).toEqual([
      { kind: 'unbridgeable', fromIndex: 0, toIndex: 4 },
    ])
  })
})
```

Extend `chart-data.test.ts` with fixtures proving that:

```ts
expect(
  buildRecallQualityPoints(events, options).map((point) => point.reviewCount),
).toEqual([6, 4, 8])
expect(buildRatingsMixPoints(events, options)[0]).toMatchObject({
  again: 1,
  hard: 1,
  good: 3,
  easy: 1,
  total: 6,
})
expect(buildPracticeRhythmPoints(events, options)[0]).toMatchObject({
  reviewCount: 6,
  observedCorrectness: 5 / 6,
  sampleSize: 6,
})
```

- [ ] **Step 2: Verify the new tests fail for missing adaptive behavior**

Run:

```sh
npm test -- src/features/analytics/domain/chart-buckets.test.ts src/features/analytics/domain/chart-data.test.ts --run
```

Expected: FAIL because the bucket helpers and adaptive practice-rhythm output
do not exist.

- [ ] **Step 3: Implement shared bucket primitives**

`chart-buckets.ts` must export these pure functions:

```ts
export type LineContinuity =
  | { kind: 'solid'; fromIndex: number; toIndex: number }
  | { kind: 'bridge'; fromIndex: number; toIndex: number }
  | { kind: 'unbridgeable'; fromIndex: number; toIndex: number }

export function recomputeBucketRatio(
  samples: readonly { numerator: number; denominator: number }[],
): number | null {
  const numerator = samples.reduce((sum, sample) => sum + sample.numerator, 0)
  const denominator = samples.reduce(
    (sum, sample) => sum + sample.denominator,
    0,
  )
  return denominator === 0 ? null : numerator / denominator
}
```

Also export `sumBucketValues`, `medianBucketValues`, `lastBucketValue`, and
`classifyLineContinuity`. The continuity classifier emits solid adjacency,
permitted bridges, and unbridgeable gaps without synthesizing values.

- [ ] **Step 4: Refactor chart-data builders onto adaptive buckets**

Change `AnalyticsRangeOptions` to carry the generated buckets and range policy:

```ts
export interface AnalyticsRangeOptions {
  start: Date
  end: Date
  buckets: readonly AnalyticsBucket[]
  rangePolicy: AnalyticsRangePolicy
  fsrsOptions: NormalizedFsrsSchedulingOptions
  lowSampleThreshold?: number
}
```

Replace `ConsistencyPoint` with:

```ts
export interface PracticeRhythmPoint {
  bucketStart: string
  bucketEnd: string
  reviewCount: number
  observedCorrectness: number | null
  sampleSize: number
  associationOnly: true
}
```

Give every historical point `bucketStart` and `bucketEnd`. Sum review and rating
counts, recompute correctness and rating proportions from raw totals, use the
median of valid FSRS stability samples, and use the reconstructed backlog value
at each bucket end. Remove the old `dailyKeys` and hard-coded weekly grouping
once all callers use generated buckets.

- [ ] **Step 5: Run the focused domain suite**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 6: Commit bucket aggregation**

```sh
git add src/features/analytics/domain/chart-buckets.ts src/features/analytics/domain/chart-buckets.test.ts src/features/analytics/domain/chart-data.ts src/features/analytics/domain/chart-data.test.ts
git commit -m "feat(analytics): aggregate adaptive chart buckets"
```

### Task 4: Extend contracts and compose evidence in the service

**Files:**

- Modify: `src/features/analytics/api/analytics-contracts.ts`
- Modify: `src/features/analytics/api/analytics-contracts.test.ts`
- Modify: `src/features/analytics/domain/summary.ts`
- Modify: `src/features/analytics/domain/summary.test.ts`
- Modify: `src/features/analytics/server/analytics-service.ts`
- Modify: `src/features/analytics/server/analytics-service.test.ts`
- Modify: `src/testing/analytics-fixtures.ts`

- [ ] **Step 1: Write failing contract and service tests**

Add schema tests for this serialized readiness shape:

```ts
const readiness = {
  ready: false,
  requestedDays: 90,
  bucketDays: 7,
  requestedBuckets: 13,
  effectiveBuckets: 8,
  effectiveStart: '2026-06-22',
  assessments: 32,
  minimumAssessments: 45,
  activeBuckets: 6,
  minimumActiveBuckets: 7,
  longestGap: 2,
  maximumGap: 2,
  gapRuns: 2,
  maximumGapRuns: 2,
  failingReasons: ['insufficient-assessments'],
} as const

expect(analyticsReadinessSchema.parse(readiness)).toEqual(readiness)
```

Add service tests asserting:

```ts
expect(summary.historicalReadiness.requested.requestedDays).toBe(90)
expect(summary.historicalReadiness.recommendedRange).toBe(30)
expect(summary.recallQuality).toHaveLength(
  summary.historicalReadiness.requested.effectiveBuckets,
)
expect(summary.upcomingLoad).toHaveLength(14)
expect(summary.retentionHealth.length).toBeGreaterThan(0)
```

Also assert that selecting 14, 30, and 90 produces bucket sizes 1, 3, and 7 and
that a leading empty interval changes `effectiveStart` without changing
`summary.range`.

- [ ] **Step 2: Verify contract and service tests fail**

Run:

```sh
npm test -- src/features/analytics/api/analytics-contracts.test.ts src/features/analytics/domain/summary.test.ts src/features/analytics/server/analytics-service.test.ts --run
```

Expected: FAIL because readiness and adaptive bucket fields are absent.

- [ ] **Step 3: Add Zod schemas and summary types**

Add:

```ts
export const readinessFailureSchema = z.enum([
  'no-evidence',
  'insufficient-span',
  'insufficient-assessments',
  'insufficient-active-buckets',
  'gap-too-long',
  'too-many-gaps',
])

export const analyticsReadinessSchema = z.object({
  ready: z.boolean(),
  requestedDays: z.number().int().positive(),
  bucketDays: z.number().int().positive(),
  requestedBuckets: z.number().int().positive(),
  effectiveBuckets: z.number().int().nonnegative(),
  effectiveStart: z.string().nullable(),
  assessments: z.number().int().nonnegative(),
  minimumAssessments: z.number().int().positive(),
  activeBuckets: z.number().int().nonnegative(),
  minimumActiveBuckets: z.number().int().nonnegative(),
  longestGap: z.number().int().nonnegative(),
  maximumGap: z.number().int().positive(),
  gapRuns: z.number().int().nonnegative(),
  maximumGapRuns: z.number().int().positive(),
  failingReasons: z.array(readinessFailureSchema),
})
```

Add `historicalReadiness` with `requested`, metric-specific readiness for
`recallQuality`, `practiceRhythm`, `ratingsMix`, `topics`, `stability`, and
`overdueBacklog`, plus nullable `recommendedRange`. Rename serialized
`consistency` to `practiceRhythm` and update point schemas to use bucket
boundaries and `reviewCount`.

- [ ] **Step 4: Compose range evidence once in the service**

Use `buildAnalyticsBuckets`, baseline valid-rating evidence, and
`calculateAnalyticsReadiness`. Query the existing full review history once;
do not add per-chart database calls. Calculate metric readiness from each
metric's eligible bucket counts, trim leading empty points to that metric's
effective start, and compute the richest passing configured range from
`[14, 30, 90]`.

Set the selected historical range status from readiness, but always return
`upcomingLoad`, `retentionHealth`, and `fragileKnowledge`. Keep the current
Zod-validated runtime boundary.

- [ ] **Step 5: Run contract, summary, and service tests**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 6: Commit service integration**

```sh
git add src/features/analytics/api/analytics-contracts.ts src/features/analytics/api/analytics-contracts.test.ts src/features/analytics/domain/summary.ts src/features/analytics/domain/summary.test.ts src/features/analytics/server/analytics-service.ts src/features/analytics/server/analytics-service.test.ts src/testing/analytics-fixtures.ts
git commit -m "feat(analytics): expose evidence-gated chart data"
```

### Task 5: Add chart catalogue, semantic tokens, and continuity renderer

**Files:**

- Create: `src/features/analytics/components/charts/chart-definitions.ts`
- Create: `src/features/analytics/components/charts/chart-definitions.test.ts`
- Create: `src/features/analytics/components/charts/line-segments.tsx`
- Create: `src/features/analytics/components/charts/line-segments.test.tsx`
- Modify: `src/features/analytics/components/charts/chart-shared.tsx`
- Modify: `src/features/analytics/components/charts/types.ts`
- Modify: `src/styles/tokens.css`

- [ ] **Step 1: Write failing catalogue and segment tests**

```ts
expect(analyticsChartDefinitions.practiceRhythm).toMatchObject({
  id: 'practice-rhythm',
  readiness: 'historical',
  series: [
    { key: 'reviewCount', mark: 'bar' },
    { key: 'observedCorrectness', mark: 'line' },
  ],
  interpretationWarning: 'Association, not causation.',
})

render(
  <LineSegments
    data={[{ value: 0.8 }, { value: null }, { value: 0.84 }]}
    dataKey="value"
    maximumGap={2}
    seriesKey="observedCorrectness"
  />,
)
expect(screen.getByTestId('observedCorrectness-bridge-0-2')).toHaveAttribute(
  'stroke-dasharray',
)
```

- [ ] **Step 2: Verify tests fail**

Run:

```sh
npm test -- src/features/analytics/components/charts/chart-definitions.test.ts src/features/analytics/components/charts/line-segments.test.tsx --run
```

Expected: FAIL because the catalogue and renderer do not exist.

- [ ] **Step 3: Implement typed definitions and named colors**

Define `AnalyticsChartDefinition`, `AnalyticsChartId`, and explicit entries for
all nine panels. Use named CSS variables:

```css
--cp-analytics-observed: var(--cp-tone-success-fg);
--cp-analytics-predicted: var(--cp-color-primary);
--cp-analytics-target: var(--cp-color-secondary);
--cp-analytics-practice-volume: color-mix(
  in srgb,
  var(--cp-tone-success-fg) 56%,
  transparent
);
--cp-analytics-again: var(--cp-tone-review-again-fg);
--cp-analytics-hard: var(--cp-tone-review-hard-fg);
--cp-analytics-good: var(--cp-tone-review-good-fg);
--cp-analytics-easy: var(--cp-tone-review-easy-fg);
--cp-analytics-healthy: var(--cp-tone-success-fg);
--cp-analytics-attention: var(--cp-tone-warning-fg);
--cp-analytics-risk: var(--cp-tone-danger-fg);
```

Add values in both light/system and dark theme scopes. Definitions, legends,
and tooltips refer to these semantic roles rather than `chart-1` positions.

- [ ] **Step 4: Implement solid and dashed line segments**

`LineSegments` calls `classifyLineContinuity`, renders solid measured runs with
ordinary Recharts `Line` elements, renders permitted endpoint-to-endpoint
bridges with `strokeDasharray="5 5"`, and renders nothing for unbridgeable
gaps. It never creates a tooltip payload or dot for a missing bucket. Export a
shared legend label: `Dashed line crosses a period with no eligible evidence.`

- [ ] **Step 5: Run catalogue and segment tests**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 6: Commit chart infrastructure**

```sh
git add src/features/analytics/components/charts/chart-definitions.ts src/features/analytics/components/charts/chart-definitions.test.ts src/features/analytics/components/charts/line-segments.tsx src/features/analytics/components/charts/line-segments.test.tsx src/features/analytics/components/charts/chart-shared.tsx src/features/analytics/components/charts/types.ts src/styles/tokens.css
git commit -m "feat(analytics): define chart semantics and continuity"
```

### Task 6: Rebuild historical charts around the approved story

**Files:**

- Modify: `src/features/analytics/components/charts/recall-quality-chart.tsx`
- Modify: `src/features/analytics/components/charts/consistency-chart.tsx`
- Modify: `src/features/analytics/components/charts/ratings-mix-chart.tsx`
- Modify: `src/features/analytics/components/charts/weakest-topics-chart.tsx`
- Modify: `src/features/analytics/components/charts/memory-strength-chart.tsx`
- Modify: `src/features/analytics/components/charts/overdue-backlog-chart.tsx`
- Modify: `src/features/analytics/components/charts/upcoming-review-load-chart.tsx`
- Modify: `src/features/analytics/components/charts/index.ts`
- Modify: `src/features/analytics/components/charts/charts.test.tsx`

- [ ] **Step 1: Replace current chart assertions with failing story assertions**

Assert the resulting Recharts marks and visible semantics:

```ts
expect(
  within(screen.getByRole('img', { name: 'Practice rhythm chart' })).getByText(
    'Observed correctness',
  ),
).toBeInTheDocument()
expect(screen.getByTestId('practice-review-bars')).toBeInTheDocument()
expect(screen.getByTestId('practice-correctness-lines')).toBeInTheDocument()
expect(screen.getByText('Association, not causation.')).toBeVisible()
expect(screen.getByText('Again')).toHaveStyle({
  color: 'var(--cp-analytics-again)',
})
expect(
  screen.getByText(/five weakest sufficiently sampled topics/i),
).toBeVisible()
expect(screen.getByText(/Dashed line crosses a period/)).toBeVisible()
```

Add a backlog fixture containing values below and above five and assert the
rendered chart exposes `data-testid="backlog-healthy-range"`,
`data-testid="backlog-attention-range"`, and a visible `Watch zone · 5` label.

- [ ] **Step 2: Run chart tests and verify red**

Run:

```sh
npm test -- src/features/analytics/components/charts/charts.test.tsx --run
```

Expected: FAIL because the current scatter, area, colors, and backlog encoding
do not match the approved story.

- [ ] **Step 3: Implement the primary and supporting chart marks**

- Recall Quality: full-width composed line chart, target `ReferenceLine`,
  range-aware ticks, observed/predicted sample tooltip, latest values, and
  independent continuity segments.
- Rename `ConsistencyChart` to `PracticeRhythmChart`; use `ComposedChart`,
  `Bar` on a count axis, and observed-correctness lines on a percentage axis.
- Ratings Mix: keep 100% stacked counts with `stackOffset="expand"`, but use
  the four named review colors and range-aware bucket labels.
- Where to Focus: show at most five sufficiently sampled topics; list excluded
  low-sample topics in a compact qualifier.
- Memory Strength: replace `AreaChart` with restrained `LineChart` and the
  shared continuity renderer.
- Recent Overdue Backlog: keep a continuous line/soft area; use a vertical
  value gradient whose stops switch at the five-problem y-coordinate so only
  the portion above five is yellow. Keep the dashed threshold and plain
  tooltip status.
- Upcoming Review Load: preserve the fixed 14-day forecast and label it
  explicitly so historical range selection never changes its horizon.

- [ ] **Step 4: Run chart tests and verify green**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit historical charts**

```sh
git add src/features/analytics/components/charts
git commit -m "feat(analytics): tell an adaptive historical chart story"
```

### Task 7: Make retention and fragile knowledge actionable

**Files:**

- Create: `src/features/analytics/components/charts/retention-health-tooltip.tsx`
- Create: `src/features/analytics/components/charts/retention-health-tooltip.test.tsx`
- Modify: `src/features/analytics/components/charts/retention-health-chart.tsx`
- Modify: `src/features/analytics/components/charts/charts.test.tsx`
- Modify: `src/features/analytics/components/fragile-knowledge-table.tsx`
- Modify: `src/features/analytics/components/fragile-knowledge-table.test.tsx`

- [ ] **Step 1: Write failing interaction and pagination tests**

```ts
const user = userEvent.setup()
render(<RetentionHealthChart data={retentionHealth} targetRetention={0.9} />)
await user.click(screen.getByRole('button', { name: /Dijkstra retention/i }))
expect(screen.getByRole('dialog', { name: 'Dijkstra memory details' })).toBeVisible()
expect(screen.getByRole('link', { name: /Open Dijkstra on LeetCode/i })).toHaveAttribute(
  'href',
  'https://leetcode.com/problems/graphs-dijkstra/',
)
await user.keyboard('{Escape}')
expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
```

For Fragile Knowledge:

```ts
expect(within(region).getAllByRole('row')).toHaveLength(6)
expect(within(region).getByText('Showing 1–5 of 12')).toBeVisible()
expect(within(region).getByRole('link', { name: 'Graph 0' })).toHaveAttribute(
  'href',
  'https://leetcode.com/problems/graph-0/',
)
await user.click(within(region).getByRole('button', { name: 'Next page' }))
expect(within(region).getByText('Showing 6–10 of 12')).toBeVisible()
expect(within(region).queryByText('Graph 0')).not.toBeInTheDocument()
```

- [ ] **Step 2: Verify interaction tests fail**

Run:

```sh
npm test -- src/features/analytics/components/charts/retention-health-tooltip.test.tsx src/features/analytics/components/charts/charts.test.tsx src/features/analytics/components/fragile-knowledge-table.test.tsx --run
```

Expected: FAIL because retention points are not actionable and the table still
uses show-all behavior.

- [ ] **Step 3: Implement pinned retention details**

Render each retention point with an accessible custom scatter shape carrying
`role="button"`, `tabIndex={0}`, an identifying label, click handling, and
Enter/Space handling. Keep ordinary hover/focus details. A click pins an
absolutely positioned details panel inside the chart region with:

```tsx
<a
  href={createLeetCodeProblemUrl(point.slug)}
  rel="noopener noreferrer"
  target="_blank"
>
  <ExternalLink aria-hidden="true" />
  Open {point.title} on LeetCode
</a>
```

The pinned panel uses `role="dialog"`, closes on Escape, closes on captured
outside `pointerdown`, and does not close when its link is activated. Summary
counts and point colors share one exported retention-status classifier.

- [ ] **Step 4: Implement five-row table pagination and links**

Replace `showAll` with `pageIndex`, `pageSize = 5`, and clamped derived pages.
Reset to page zero when a changed row set leaves the current page out of range.
Use `createLeetCodeProblemUrl(row.slug)` for linked titles with the existing
safe external-link classes and behavior. Add Previous/Next buttons, disabled
states, and visible `Showing X–Y of Z` status.

- [ ] **Step 5: Run interaction tests and verify green**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 6: Commit actionable memory health**

```sh
git add src/features/analytics/components/charts/retention-health-tooltip.tsx src/features/analytics/components/charts/retention-health-tooltip.test.tsx src/features/analytics/components/charts/retention-health-chart.tsx src/features/analytics/components/charts/charts.test.tsx src/features/analytics/components/fragile-knowledge-table.tsx src/features/analytics/components/fragile-knowledge-table.test.tsx
git commit -m "feat(analytics): link actionable memory health"
```

### Task 8: Compose readiness and the approved page hierarchy

**Files:**

- Create: `src/features/analytics/components/analytics-readiness-state.tsx`
- Create: `src/features/analytics/components/analytics-readiness-state.test.tsx`
- Modify: `src/features/analytics/components/analytics-chart-panel.tsx`
- Modify: `src/features/analytics/components/analytics-screen.tsx`
- Modify: `src/features/analytics/components/analytics-screen.test.tsx`
- Modify: `src/features/analytics/components/analytics-metric-row.tsx`
- Modify: `src/features/analytics/domain/metric-definitions.ts`

- [ ] **Step 1: Write failing readiness and hierarchy tests**

```ts
expect(
  await screen.findByRole('status', { name: '90-day analytics readiness' }),
).toHaveTextContent('13 more assessments needed')
expect(
  screen.getByRole('link', { name: 'Use ready 30-day view' }),
).toHaveAttribute('href', expect.stringContaining('range=30'))
expect(
  screen.queryByRole('region', { name: 'Recall quality' }),
).not.toBeInTheDocument()
expect(
  screen.getByRole('region', { name: 'Upcoming review load' }),
).toBeVisible()
expect(screen.getByRole('region', { name: 'Retention health' })).toBeVisible()
expect(screen.getByRole('region', { name: 'Fragile knowledge' })).toBeVisible()
```

Add a ready 90-day fixture whose leading 40 days are empty and assert visible
copy: `Showing 8 weeks of usable history from your selected 90-day range.`

- [ ] **Step 2: Verify screen tests fail**

Run:

```sh
npm test -- src/features/analytics/components/analytics-readiness-state.test.tsx src/features/analytics/components/analytics-screen.test.tsx src/app/dashboard/routes.test.tsx --run
```

Expected: FAIL because the page does not distinguish historical readiness from
current-state availability.

- [ ] **Step 3: Implement explainable readiness UI**

`AnalyticsReadinessState` receives requested readiness and nullable recommended
range. Build its sentences from structured failures:

```ts
const messages: Record<
  ReadinessFailure,
  (value: AnalyticsReadiness) => string
> = {
  'no-evidence': () =>
    'Complete your first eligible review to begin this view.',
  'insufficient-span': (value) =>
    `${value.minimumActiveBuckets - value.activeBuckets} more active buckets needed.`,
  'insufficient-assessments': (value) =>
    `${value.minimumAssessments - value.assessments} more assessments needed.`,
  'insufficient-active-buckets': (value) =>
    `${value.minimumActiveBuckets - value.activeBuckets} more active buckets needed.`,
  'gap-too-long': () => 'A practice gap is longer than this trend can bridge.',
  'too-many-gaps': () => 'Practice is too fragmented for a reliable trend.',
}
```

Clamp numeric deficits at zero. Use the existing route link/search pattern to
offer the recommended range without changing selection automatically.

- [ ] **Step 4: Compose the story in screen order**

Render:

1. selected-period metric row
2. full-width Recall Quality when its metric readiness passes
3. Practice Rhythm + Ratings Mix
4. Where to Focus + Memory Strength
5. Recent Overdue Backlog + fixed Upcoming Review Load
6. Retention Health + paginated Fragile Knowledge

When overall or metric readiness fails, show its explainable state instead of
an unreliable historical chart. Always show fixed Upcoming Review Load,
Retention Health, and Fragile Knowledge. Use metric definitions for title,
question, explanation, and warning copy.

- [ ] **Step 5: Run screen and route tests**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 6: Commit page composition**

```sh
git add src/features/analytics/components/analytics-readiness-state.tsx src/features/analytics/components/analytics-readiness-state.test.tsx src/features/analytics/components/analytics-chart-panel.tsx src/features/analytics/components/analytics-screen.tsx src/features/analytics/components/analytics-screen.test.tsx src/features/analytics/components/analytics-metric-row.tsx src/features/analytics/domain/metric-definitions.ts src/app/dashboard/routes.test.tsx
git commit -m "feat(analytics): compose evidence-aware chart story"
```

### Task 9: Document implemented behavior and diagnostics

**Files:**

- Modify: `docs/product.md`
- Modify: `docs/architecture.md`
- Modify: `docs/testing.md`

- [ ] **Step 1: Update product behavior**

Document that Analytics uses evidence-gated adaptive historical buckets,
removes leading unsupported time, preserves current-state/forecast panels, and
offers the richest shorter ready range without silently changing selection.
State that dashed bridges mark permitted missing evidence and do not represent
interpolated values.

- [ ] **Step 2: Update architecture ownership**

Document:

```text
review/FSRS inputs
  -> analytics range policy
  -> effective evidence window and readiness
  -> metric-specific presentation buckets
  -> Zod contract
  -> explicit chart components
```

Name the range-policy, readiness, chart-bucket, chart-definition, and canonical
LeetCode URL owners. Document the development diagnostics payload (`S/A/G/K/E`,
boundaries, thresholds, accepted/rejected evidence) as one read-only view of
the production calculation, not a separate calculation path.

- [ ] **Step 3: Update the dashboard smoke checklist**

Add exact human checks for all three ranges, effective-window copy, readiness
progress, recommended range, dashed bridges, backlog threshold colors,
retention pinned tooltip/link/dismissal, fragile pagination/linking, sparse
history, narrow layout, and keyboard navigation.

- [ ] **Step 4: Format and commit documentation**

```sh
npx prettier --write docs/product.md docs/architecture.md docs/testing.md
npx prettier --check docs/product.md docs/architecture.md docs/testing.md
git add docs/product.md docs/architecture.md docs/testing.md
git commit -m "docs(analytics): document adaptive evidence behavior"
```

Expected: Prettier reports all three files use its code style.

### Task 10: Run complete validation and update the draft PR

**Files:**

- Review: all files changed by Tasks 1–9
- Update externally: existing draft pull request for
  `codex/analytics-v1-shadcn-charts`

- [ ] **Step 1: Run focused Analytics tests**

```sh
npm test -- src/features/analytics src/app/dashboard/routes.test.tsx src/components/ui/chart.test.tsx --run
```

Expected: all focused tests PASS. Existing JSDOM `Window.scrollTo` notices may
appear, but there must be no failed tests.

- [ ] **Step 2: Run formatting checks on every touched source and document**

```sh
npx prettier --check src/features/analytics src/testing/analytics-fixtures.ts src/styles/tokens.css docs/product.md docs/architecture.md docs/testing.md docs/superpowers/specs/2026-08-13-analytics-v1-adaptive-chart-story-design.md docs/superpowers/plans/2026-08-13-analytics-v1-adaptive-chart-story.md
```

Expected: all matched files use Prettier code style.

- [ ] **Step 3: Run the repository validation matrix**

```sh
npm run db:check
npm run typecheck
npm run lint
npm run test
npm run check
npm run build
```

Expected: every command exits zero. Record exact test-file and test counts from
the final run. If any command is skipped or fails, record the exact command,
reason, and remaining risk rather than claiming completion.

- [ ] **Step 4: Inspect the final diff and branch state**

```sh
git diff --check
git status --short --branch
git diff --stat origin/main...HEAD
git log --oneline origin/main..HEAD
```

Expected: no whitespace errors; only the known unrelated user-owned untracked
files may remain outside the implementation diff.

- [ ] **Step 5: Prepare human smoke proof**

Run the dashboard dev build and ask the human engineer to capture the exact
happy-path and edge-case flows from `docs/testing.md`. Do not mark manual smoke
or visual proof complete until the human verifies all 14/30/90 views and
attaches screenshots or a recording.

- [ ] **Step 6: Commit any validation-only corrections**

```sh
git add src/features/analytics src/testing/analytics-fixtures.ts src/styles/tokens.css docs/product.md docs/architecture.md docs/testing.md
git diff --cached --check
git commit -m "fix(analytics): address adaptive chart validation"
```

Run this only when Step 3 or human smoke finds a correction; otherwise do not
create an empty commit.

- [ ] **Step 7: Push and update the existing draft PR**

```sh
git push origin codex/analytics-v1-shadcn-charts
gh pr edit 116 --body $'## Details\n\nRefines Analytics V1 into an adaptive, evidence-gated chart story. Historical charts use range-aware buckets, effective evidence windows, explainable readiness gates, truthful dashed continuity bridges, semantic chart definitions, actionable retention links, and paginated fragile knowledge. Review the readiness formulas, metric eligibility, 14/30/90 behavior, and keyboard interactions closely.\n\n## Issue\n\nNo issue - continuation of the approved Analytics V1 product work.\n\n## Testing\n\n- [x] `npm run check` passed\n  - db check\n  - typecheck\n  - lint\n  - tests\n- [x] `npm run build` passed\n- [ ] `npm run zip` passed, or N/A: N/A - this PR changes dashboard feature behavior but does not prepare a release package.\n- [x] Added/updated needed tests: Analytics domain, contracts, service, routes, chart components, readiness, continuity, interactions, and pagination.\n- [ ] Manual smoke tested: pending human 14/30/90 happy-path, sparse-history edge-case, keyboard, external-link, pagination, and responsive verification.\n- [x] Skipped validation: `npm run zip`; release packaging is outside this feature PR.\n\n## Screenshots\n\nPending human screenshot or recording proof for all three ranges, sparse readiness, pinned retention details, fragile pagination, and narrow layout.'
```

The PR body must use the current repository template and include why the
revision exists, exact commands run/skipped, remaining risk, release impact,
rollback notes, and the pending or completed human visual proof. Keep the PR in
draft until required human smoke proof is attached.
