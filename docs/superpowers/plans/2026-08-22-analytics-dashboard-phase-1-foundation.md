# Analytics Dashboard Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the shared local-time, evidence, scale, formatting, presentation-contract, Chart/Table, and accessibility foundation without changing the visible nine-view dashboard yet.

**Architecture:** Add feature-owned pure helpers and additive Zod schemas, then introduce `AnalyticsFigure` and `AnalyticsDataTable` as tested UI composition. Keep current charts operational while later phases migrate one coherent section at a time.

**Tech Stack:** TypeScript, React, Zod, Recharts/Shadcn chart primitives, date-fns-compatible calendar logic, Vitest, Testing Library.

---

## Task 1: Lock local-calendar request and bucket semantics

**Files:**

- Create: `src/features/analytics/domain/analytics-time.ts`
- Create: `src/features/analytics/domain/analytics-time.test.ts`
- Modify: `src/features/analytics/api/analytics-contracts.ts`
- Modify: `src/features/analytics/api/analytics-contracts.test.ts`
- Modify: `src/features/analytics/api/analytics-api.ts`
- Modify: `src/features/analytics/api/analytics-api.test.tsx`
- Modify: `src/platform/query/query-keys.ts`
- Modify: `src/extension/background/register-handlers.ts`
- Modify: `src/extension/background/register-handlers.test.ts`

- [ ] **Step 1: Write failing timezone and boundary tests**

Add tests for 14/30/90 bounds, Monday-clipped weeks, three-day buckets anchored
at range start, DST transitions, invalid-zone UTC fallback, partial today, and
the 14-day forecast half-open bound:

```ts
it('builds the 30-day range as ten anchored three-day local buckets', () => {
  const result = buildAnalyticsTimeFrame({
    asOf: new Date('2026-08-22T16:40:00.000Z'),
    requestedDays: 30,
    timeZone: 'America/New_York',
  })

  expect(result.timeZone).toBe('America/New_York')
  expect(result.timeZoneFallback).toBe(false)
  expect(result.buckets).toHaveLength(10)
  expect(result.buckets[0]).toMatchObject({
    key: '2026-07-24',
    startKey: '2026-07-24',
    endKey: '2026-07-26',
  })
  expect(result.buckets.at(-1)).toMatchObject({
    endKey: '2026-08-22',
    isPartial: true,
  })
})

it('uses UTC visibly when an IANA zone is invalid', () => {
  const result = resolveAnalyticsTimeZone('Not/A_Zone')
  expect(result).toEqual({ timeZone: 'UTC', fallback: true })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```sh
npm run test -- src/features/analytics/domain/analytics-time.test.ts
```

Expected: FAIL because `analytics-time.ts` and its exports do not exist.

- [ ] **Step 3: Implement deterministic time-frame helpers**

Create these public contracts and keep all calendar calculations behind them:

```ts
export type AnalyticsHistoricalRange = 14 | 30 | 90

export interface AnalyticsTimeBucket {
  key: string
  start: string
  end: string
  startKey: string
  endKey: string
  isPartial: boolean
}

export interface AnalyticsTimeFrame {
  asOf: string
  timeZone: string
  timeZoneFallback: boolean
  periodStart: string
  periodEnd: string
  buckets: AnalyticsTimeBucket[]
}

export function resolveAnalyticsTimeZone(requested: string): {
  timeZone: string
  fallback: boolean
} {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: requested }).format()
    return { timeZone: requested, fallback: false }
  } catch {
    return { timeZone: 'UTC', fallback: true }
  }
}

export function buildAnalyticsTimeFrame(input: {
  asOf: Date
  requestedDays: AnalyticsHistoricalRange
  timeZone: string
}): AnalyticsTimeFrame

export function buildForecastBounds(input: { asOf: Date; timeZone: string }): {
  start: string
  end: string
  todayKey: string
}
```

Use the existing 14=daily, 30=anchored three-day, 90=Monday-week policy. Do not
parse a `YYYY-MM-DD` key as a UTC instant.

- [ ] **Step 4: Add timezone to the runtime request**

Change the request schema and hook call:

```ts
export const analyticsSummaryRequestSchema = z.object({
  surface: z.literal('dashboard'),
  range: analyticsRangeSchema,
  timeZone: z.string().min(1),
  at: z.iso.datetime().optional(),
})
```

```ts
export function useAnalyticsSummary(range: AnalyticsRange = 30) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  return useQuery({
    queryKey: analyticsQueryKeys.summary(range, timeZone),
    queryFn: () =>
      sendMessage('analytics.getSummary', {
        surface: 'dashboard',
        range,
        timeZone,
      }),
  })
}
```

Update `queryKeys.analytics.summary` to include the timezone so a zone change
cannot reuse incorrectly grouped data.

Pass the parsed value through the trusted handler without reading browser
locale in the background runtime:

```ts
const request = analyticsSummaryRequestSchema.parse(data)
const summary = await getAnalyticsSummary(db, request.range, {
  at: request.at ? new Date(request.at) : new Date(),
  timeZone: request.timeZone,
})
```

- [ ] **Step 5: Run focused tests and commit**

Run:

```sh
npm run test -- src/features/analytics/domain/analytics-time.test.ts src/features/analytics/api/analytics-contracts.test.ts src/features/analytics/api/analytics-api.test.tsx src/extension/background/register-handlers.test.ts
```

Expected: PASS.

Commit:

```sh
git add src/features/analytics/domain/analytics-time.ts src/features/analytics/domain/analytics-time.test.ts src/features/analytics/api/analytics-contracts.ts src/features/analytics/api/analytics-contracts.test.ts src/features/analytics/api/analytics-api.ts src/features/analytics/api/analytics-api.test.tsx src/platform/query/query-keys.ts src/extension/background/register-handlers.ts src/extension/background/register-handlers.test.ts
git commit -m "feat(analytics): add local calendar contract"
```

## Task 2: Add evidence, scale, and formatting helpers

**Files:**

- Create: `src/features/analytics/domain/analytics-evidence.ts`
- Create: `src/features/analytics/domain/analytics-evidence.test.ts`
- Create: `src/features/analytics/domain/analytics-scales.ts`
- Create: `src/features/analytics/domain/analytics-scales.test.ts`
- Create: `src/features/analytics/domain/analytics-format.ts`
- Create: `src/features/analytics/domain/analytics-format.test.ts`
- Modify later: `src/features/analytics/domain/analytics-readiness.ts`

- [ ] **Step 1: Write failing helper tests from the specification**

```ts
it('builds the locked adaptive percentage domain', () => {
  expect(buildAdaptivePercentageDomain([0.75, 0.94], [0.9])).toEqual([0.7, 1])
})

it('keeps an all-equal percentage series visible', () => {
  expect(buildAdaptivePercentageDomain([0.8], [])).toEqual([0.65, 0.95])
})

it('distinguishes measured, reconstructed, partial, and unsupported trend', () => {
  expect(
    buildEvidenceStatus({
      measured: true,
      reconstructed: true,
      partial: true,
      trendSupported: false,
    }),
  ).toEqual([
    'measured',
    'reconstructed',
    'in-progress',
    'insufficient-evidence',
  ])
})
```

Also test the evidence formulas from the spec, `0..1` clamps, two-day duration
minimum, count nice domains, single-value cases, `null` formatting, signed pp,
and day precision.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```sh
npm run test -- src/features/analytics/domain/analytics-evidence.test.ts src/features/analytics/domain/analytics-scales.test.ts src/features/analytics/domain/analytics-format.test.ts
```

Expected: FAIL because the helper modules do not exist.

- [ ] **Step 3: Implement the shared contracts**

Use these exact exported surfaces:

```ts
export type AnalyticsEvidenceLabel =
  | 'measured'
  | 'in-progress'
  | 'reconstructed'
  | 'not-measured'
  | 'insufficient-evidence'

export interface AnalyticsEvidence {
  labels: AnalyticsEvidenceLabel[]
  sampleSize: number
  activeBuckets: number
  requestedBuckets: number
  effectiveBuckets: number
  longestGap: number
  gapRuns: number
  trendSupported: boolean
}

export function buildEvidenceStatus(input: {
  measured: boolean
  reconstructed: boolean
  partial: boolean
  trendSupported: boolean
}): AnalyticsEvidenceLabel[]

export function calculateAnalyticsEvidence(input: {
  requestedDays: 14 | 30 | 90
  evidenceCounts: readonly number[]
  bucketKeys: readonly string[]
}): AnalyticsEvidence
```

```ts
export type NumericDomain = readonly [number, number]

export function buildAdaptivePercentageDomain(
  values: readonly number[],
  references: readonly number[],
): NumericDomain

export function buildAdaptiveDurationDomain(
  values: readonly number[],
): NumericDomain

export function buildCountDomain(
  values: readonly number[],
  references: readonly number[] = [],
): NumericDomain

export function buildLogDurationDomain(
  values: readonly number[],
  reference = 7,
): NumericDomain
```

```ts
export function formatAnalyticsPercent(value: number | null): string
export function formatAnalyticsPercentagePoints(value: number | null): string
export function formatAnalyticsDays(value: number | null): string
export function formatAnalyticsCount(value: number): string
export function formatAnalyticsDateKey(key: string): string
export function formatAnalyticsBucket(startKey: string, endKey: string): string
```

The percentage helper must implement the exact 1.5× spread, 25pp minimum,
shift-before-clamp, 5pp outward rounding algorithm. The count helper uses
`1, 2, 5 × 10^n` nice steps.

- [ ] **Step 4: Keep the old readiness export as a compatibility adapter**

Do not update all consumers in Phase 1. Make `analytics-readiness.ts` delegate
to the new calculation while preserving its current exported shape, then remove
that adapter in Phase 5.

- [ ] **Step 5: Run tests and commit**

Run:

```sh
npm run test -- src/features/analytics/domain/analytics-evidence.test.ts src/features/analytics/domain/analytics-scales.test.ts src/features/analytics/domain/analytics-format.test.ts src/features/analytics/domain/analytics-readiness.test.ts
```

Expected: PASS.

Commit:

```sh
git add src/features/analytics/domain/analytics-evidence.ts src/features/analytics/domain/analytics-evidence.test.ts src/features/analytics/domain/analytics-scales.ts src/features/analytics/domain/analytics-scales.test.ts src/features/analytics/domain/analytics-format.ts src/features/analytics/domain/analytics-format.test.ts src/features/analytics/domain/analytics-readiness.ts src/features/analytics/domain/analytics-readiness.test.ts
git commit -m "feat(analytics): add evidence and scale helpers"
```

## Task 3: Add additive presentation schemas and the canonical catalogue

**Files:**

- Create: `src/features/analytics/api/analytics-presentation-contracts.ts`
- Create: `src/features/analytics/api/analytics-presentation-contracts.test.ts`
- Create: `src/features/analytics/components/charts/chart-catalogue.ts`
- Create: `src/features/analytics/components/charts/chart-catalogue.test.ts`
- Modify: `src/features/analytics/api/analytics-contracts.ts`
- Deprecate later: `src/features/analytics/domain/metric-definitions.ts`
- Deprecate later: `src/features/analytics/components/charts/chart-definitions.ts`

- [ ] **Step 1: Write failing schema and catalogue tests**

```ts
it('requires shared as-of, timezone, range, and evidence metadata', () => {
  expect(
    analyticsPresentationMetaSchema.parse({
      asOf: '2026-08-22T16:40:00.000Z',
      timeZone: 'America/New_York',
      timeZoneFallback: false,
      range: 30,
      periodStart: '2026-07-24T04:00:00.000Z',
      periodEnd: '2026-08-23T04:00:00.000Z',
      isPartial: true,
    }),
  ).toBeTruthy()
})

it('defines exactly the nine approved stable IDs', () => {
  expect(Object.keys(analyticsViewCatalogue)).toEqual([
    'observed-recall-vs-fsrs',
    'memory-strength',
    'practice-rhythm',
    'ratings-mix',
    'topic-performance',
    'retention-map',
    'memory-signals',
    'overdue-backlog',
    'upcoming-review-load',
  ])
})
```

- [ ] **Step 2: Verify RED**

Run:

```sh
npm run test -- src/features/analytics/api/analytics-presentation-contracts.test.ts src/features/analytics/components/charts/chart-catalogue.test.ts
```

Expected: FAIL because both files are new.

- [ ] **Step 3: Implement common schemas and definitions**

Create common Zod primitives without adding all view rows yet:

```ts
export const analyticsViewIdSchema = z.enum([
  'observed-recall-vs-fsrs',
  'memory-strength',
  'practice-rhythm',
  'ratings-mix',
  'topic-performance',
  'retention-map',
  'memory-signals',
  'overdue-backlog',
  'upcoming-review-load',
])

export type AnalyticsViewId = z.infer<typeof analyticsViewIdSchema>

export const analyticsPresentationMetaSchema = z.object({
  asOf: z.iso.datetime(),
  timeZone: z.string().min(1),
  timeZoneFallback: z.boolean(),
  range: analyticsRangeSchema,
  periodStart: z.iso.datetime(),
  periodEnd: z.iso.datetime(),
  isPartial: z.boolean(),
})

export const analyticsEvidenceSchema = z.object({
  labels: z.array(
    z.enum([
      'measured',
      'in-progress',
      'reconstructed',
      'not-measured',
      'insufficient-evidence',
    ]),
  ),
  sampleSize: z.number().int().nonnegative(),
  activeBuckets: z.number().int().nonnegative(),
  requestedBuckets: z.number().int().nonnegative(),
  effectiveBuckets: z.number().int().nonnegative(),
  longestGap: z.number().int().nonnegative(),
  gapRuns: z.number().int().nonnegative(),
  trendSupported: z.boolean(),
})
```

Define catalogue values for title, question, meaning, scope, units, empty copy,
warning, tooltip fields, and table columns. Do not add chart-type conditionals.

```ts
export interface AnalyticsViewDefinition {
  id: AnalyticsViewId
  title: string
  question: string
  metricMeaning: string
  scope: 'historical' | 'selected-period' | 'current-state' | 'fixed-forecast'
  units: readonly string[]
  tooltipFields: readonly string[]
  tableColumns: readonly string[]
  emptyState: string
  interpretationWarning?: string
}
```

- [ ] **Step 4: Add the metadata additively to the summary schema**

Add `presentationMeta` to `analyticsSummarySchema` and populate it in the
service using `buildAnalyticsTimeFrame`; retain old fields until Phase 5.

- [ ] **Step 5: Run tests and commit**

Run:

```sh
npm run test -- src/features/analytics/api/analytics-presentation-contracts.test.ts src/features/analytics/api/analytics-contracts.test.ts src/features/analytics/components/charts/chart-catalogue.test.ts src/features/analytics/server/analytics-service.test.ts
```

Expected: PASS.

Commit:

```sh
git add src/features/analytics/api/analytics-presentation-contracts.ts src/features/analytics/api/analytics-presentation-contracts.test.ts src/features/analytics/api/analytics-contracts.ts src/features/analytics/api/analytics-contracts.test.ts src/features/analytics/components/charts/chart-catalogue.ts src/features/analytics/components/charts/chart-catalogue.test.ts src/features/analytics/server/analytics-service.ts src/features/analytics/server/analytics-service.test.ts
git commit -m "feat(analytics): add presentation catalogue"
```

## Task 4: Build the feature-owned Figure and exact table composition

**Files:**

- Create: `src/features/analytics/components/analytics-figure.tsx`
- Create: `src/features/analytics/components/analytics-figure.test.tsx`
- Create: `src/features/analytics/components/analytics-data-table.tsx`
- Create: `src/features/analytics/components/analytics-data-table.test.tsx`
- Create: `src/features/analytics/components/analytics-evidence-summary.tsx`
- Create: `src/features/analytics/components/analytics-evidence-summary.test.tsx`
- Modify: `src/features/analytics/components/index.ts`

- [ ] **Step 1: Write failing interaction and semantic tests**

Test native Chart/Table tabs, selected-state persistence on rerender, focus
remaining on the selected tab, table caption/headers, seven-row pagination,
page reset on `datasetKey`, live range announcements, and a single calm evidence
summary.

```tsx
it('switches between chart and exact table without changing rows', async () => {
  const user = userEvent.setup()
  render(
    <AnalyticsFigure
      definition={analyticsViewCatalogue['practice-rhythm']}
      evidence={evidence}
      chart={<div>chart rows: 10</div>}
      table={<div>table rows: 10</div>}
    />,
  )

  await user.click(screen.getByRole('tab', { name: 'Table' }))
  expect(screen.getByRole('tab', { name: 'Table' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(screen.getByText('table rows: 10')).toBeVisible()
})
```

- [ ] **Step 2: Verify RED**

Run:

```sh
npm run test -- src/features/analytics/components/analytics-figure.test.tsx src/features/analytics/components/analytics-data-table.test.tsx src/features/analytics/components/analytics-evidence-summary.test.tsx
```

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement `AnalyticsFigure` without a generic renderer**

Use this API:

```tsx
export interface AnalyticsFigureProps {
  chart: ReactNode
  datasetKey: string
  definition: AnalyticsViewDefinition
  details?: ReactNode
  evidence: AnalyticsEvidence
  table: ReactNode
  takeaway: ReactNode
}

export function AnalyticsFigure(props: AnalyticsFigureProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const chartId = `${props.definition.id}-chart-panel`
  const tableId = `${props.definition.id}-table-panel`

  return (
    <Surface
      aria-labelledby={`${props.definition.id}-title`}
      data-dataset-key={props.datasetKey}
      role="region"
    >
      <header>
        <h2 id={`${props.definition.id}-title`}>{props.definition.title}</h2>
        <p>{props.definition.question}</p>
        <p>{props.definition.metricMeaning}</p>
      </header>
      <div aria-label={`${props.definition.title} view`} role="tablist">
        {(['chart', 'table'] as const).map((nextView) => (
          <button
            aria-controls={nextView === 'chart' ? chartId : tableId}
            aria-selected={view === nextView}
            key={nextView}
            onClick={() => setView(nextView)}
            role="tab"
            type="button"
          >
            {nextView === 'chart' ? 'Chart' : 'Table'}
          </button>
        ))}
      </div>
      <div id={chartId} hidden={view !== 'chart'} role="tabpanel">
        {props.chart}
      </div>
      <div id={tableId} hidden={view !== 'table'} role="tabpanel">
        {props.table}
      </div>
      <div>{props.takeaway}</div>
      <AnalyticsEvidenceStrip evidence={props.evidence} />
      {props.details ? (
        <details>
          <summary>Calculation details</summary>
          {props.details}
        </details>
      ) : null}
    </Surface>
  )
}
```

The component never inspects chart rows or chooses a chart type. Implement
Left/Right/Home/End tab-key handling so the native buttons follow the ARIA tabs
keyboard pattern.

`analytics-evidence-summary.tsx` exports two intentionally small compositions:

```tsx
export function AnalyticsEvidenceSummary({
  evidence,
}: {
  evidence: AnalyticsEvidence
}) {
  return (
    <aside aria-label="Analytics evidence">
      <strong>{evidence.sampleSize} eligible observations</strong>
      <span>{evidence.activeBuckets} active buckets</span>
      <span>{evidence.labels.join(' · ')}</span>
    </aside>
  )
}

export function AnalyticsEvidenceStrip({
  evidence,
}: {
  evidence: AnalyticsEvidence
}) {
  return (
    <p aria-label="Figure evidence">
      {evidence.sampleSize} eligible · {evidence.labels.join(' · ')}
    </p>
  )
}
```

The summary appears once at page level; the strip contains only the current
figure's compact sample/status.

- [ ] **Step 4: Implement semantic pagination**

Use a generic row API only for pagination and semantics:

```tsx
export interface AnalyticsTableColumn<Row> {
  id: string
  header: ReactNode
  numeric?: boolean
  render: (row: Row) => ReactNode
  rowHeader?: boolean
}

export interface AnalyticsDataTableProps<Row> {
  caption: string
  columns: readonly AnalyticsTableColumn<Row>[]
  datasetKey: string
  getRowKey: (row: Row) => string
  pageSize?: number
  rows: readonly Row[]
}
```

Reset to page one when `datasetKey` changes; keep Rank values from source rows;
announce `Showing X–Y of N`; use native Previous/Next buttons.

- [ ] **Step 5: Run tests and commit**

Run:

```sh
npm run test -- src/features/analytics/components/analytics-figure.test.tsx src/features/analytics/components/analytics-data-table.test.tsx src/features/analytics/components/analytics-evidence-summary.test.tsx
```

Expected: PASS.

Commit:

```sh
git add src/features/analytics/components/analytics-figure.tsx src/features/analytics/components/analytics-figure.test.tsx src/features/analytics/components/analytics-data-table.tsx src/features/analytics/components/analytics-data-table.test.tsx src/features/analytics/components/analytics-evidence-summary.tsx src/features/analytics/components/analytics-evidence-summary.test.tsx src/features/analytics/components/index.ts
git commit -m "feat(analytics): add figure and table composition"
```

## Task 5: Extend semantic tokens and generic chart accessibility plumbing

**Files:**

- Modify: `src/styles/tokens.css`
- Modify: `src/styles/tokens.test.ts`
- Modify: `src/components/ui/chart.tsx`
- Modify: `src/components/ui/chart.test.tsx`

- [ ] **Step 1: Write failing token and chart-container tests**

Require named light/strong healthy, watch, risk, due, and overdue tokens in all
themes. Require one labelled chart surface, description, and disabled animation
under reduced motion without adding feature-specific metric names to the shared
primitive.

- [ ] **Step 2: Verify RED**

Run:

```sh
npm run test -- src/styles/tokens.test.ts src/components/ui/chart.test.tsx
```

Expected: FAIL on the new tokens/contract.

- [ ] **Step 3: Add only generic semantic capabilities**

Add named tokens such as:

```css
--cp-analytics-healthy-subtle: color-mix(
  in srgb,
  var(--cp-tone-success-fg) 18%,
  transparent
);
--cp-analytics-healthy-strong: var(--cp-tone-success-fg);
--cp-analytics-watch-subtle: color-mix(
  in srgb,
  var(--cp-tone-warning-fg) 18%,
  transparent
);
--cp-analytics-watch-strong: var(--cp-tone-warning-fg);
--cp-analytics-risk-subtle: color-mix(
  in srgb,
  var(--cp-tone-danger-fg) 18%,
  transparent
);
--cp-analytics-risk-strong: var(--cp-tone-danger-fg);
--cp-analytics-due: var(--cp-tone-success-fg);
--cp-analytics-overdue: var(--cp-tone-danger-fg);
```

Keep `ChartContainer` metric-agnostic. It may accept an accessible name,
description, and deterministic initial dimensions; explicit Analytics charts
remain responsible for Recharts data and interactions.

- [ ] **Step 4: Run tests and commit**

Run:

```sh
npm run test -- src/styles/tokens.test.ts src/components/ui/chart.test.tsx src/testing/architecture-boundaries.test.ts
```

Expected: PASS.

Commit:

```sh
git add src/styles/tokens.css src/styles/tokens.test.ts src/components/ui/chart.tsx src/components/ui/chart.test.tsx
git commit -m "feat(ui): extend accessible chart foundation"
```

## Task 6: Phase 1 validation gate

**Files:** none beyond fixes required by validation.

- [ ] **Step 1: Run formatting and focused architecture checks**

```sh
npx prettier --check src/features/analytics src/components/ui/chart.tsx src/styles/tokens.css
npm run test -- src/testing/architecture-boundaries.test.ts
git diff --check
```

Expected: all PASS.

- [ ] **Step 2: Run full required validation**

```sh
npm run lint
npm run check
```

Expected: all PASS. `npm run check` includes `db:check`, typecheck, lint, and all
tests.

- [ ] **Step 3: Record the phase checkpoint**

If validation required fixes, commit them:

```sh
git add src/features/analytics src/components/ui/chart.tsx src/components/ui/chart.test.tsx src/styles/tokens.css src/styles/tokens.test.ts
git commit -m "test(analytics): close foundation validation"
```

Stop for review. Do not begin Phase 2 in the same uncontrolled pass.
