# FSRS Retention Scatter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Retention Health scatter chart to the analytics page — each practiced problem plotted as a dot by days since last review (X) vs. current retrievability % (Y), with a forgetting curve and target retention threshold line.

**Architecture:** Extend `getAnalyticsSummary` to include pre-computed scatter entries and a reference curve, following the existing weak-problems enrichment pattern. The service does all FSRS computation; the frontend is a pure renderer. The new `AnalyticsRetentionScatter` component renders a hand-rolled SVG chart matching the style of the existing `AnalyticsForecast` component.

**Tech Stack:** TypeScript, Drizzle ORM (SQLite), Zod, React, Vitest, React Testing Library

---

## File Structure

| File | Change |
|------|--------|
| `src/features/analytics/domain/summary.ts` | Add `RetentionScatterEntry`, `ReferenceCurvePoint`, `buildRetentionScatter`; extend `AnalyticsSummaryInput` + `AnalyticsSummary` + `buildAnalyticsSummary` |
| `src/features/analytics/domain/summary.test.ts` | Add `buildRetentionScatter` tests; update `buildAnalyticsSummary` test for new fields |
| `src/features/analytics/data/analytics-repository.ts` | Add `RetentionScatterCandidate` interface + `getRetentionScatterCandidates` |
| `src/features/analytics/data/analytics-repository.test.ts` | Add `getRetentionScatterCandidates` integration tests |
| `src/features/analytics/api/analytics-contracts.ts` | Add `retentionScatterEntrySchema`, `referenceCurvePointSchema`; extend `analyticsSummarySchema` |
| `src/features/analytics/api/analytics-contracts.test.ts` | Update `validSummary` fixture; add new schema tests |
| `src/features/analytics/server/analytics-service.ts` | Add scatter to `Promise.all`; enrich candidates; compute median stability + reference curve |
| `src/features/analytics/components/analytics-retention-scatter.tsx` | **New** — SVG scatter chart component |
| `src/features/analytics/components/analytics-screen.tsx` | Mount `AnalyticsRetentionScatter` between forecast and weak problems |
| `src/features/analytics/components/analytics-screen.test.tsx` | Update `baseAnalyticsSummary` fixture; add scatter region assertions |
| `src/features/analytics/index.ts` | Export `RetentionScatterEntry`, `ReferenceCurvePoint` types |

---

## Task 1: Domain types + `buildRetentionScatter`

**Files:**
- Modify: `src/features/analytics/domain/summary.ts`
- Modify: `src/features/analytics/domain/summary.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `src/features/analytics/domain/summary.test.ts`:

```typescript
import type { RetentionScatterEntry, ReferenceCurvePoint } from './summary'
import { buildRetentionScatter } from './summary'

// Add these imports to the existing import line at the top:
// import { ..., buildRetentionScatter } from './summary'
// import type { ..., RetentionScatterEntry, ReferenceCurvePoint } from './summary'

describe('buildRetentionScatter', () => {
  it('sorts entries ascending by daysSinceReview', () => {
    const entries: RetentionScatterEntry[] = [
      {
        slug: 'b',
        title: 'B',
        retrievability: 0.8,
        daysSinceReview: 10,
        difficulty: 5,
        stability: 20,
        lapseCount: 0,
        lastReviewAt: '2026-01-05T12:00:00.000Z',
      },
      {
        slug: 'a',
        title: 'A',
        retrievability: 0.95,
        daysSinceReview: 2,
        difficulty: 4,
        stability: 30,
        lapseCount: 0,
        lastReviewAt: '2026-01-13T12:00:00.000Z',
      },
    ]
    const curve: ReferenceCurvePoint[] = [
      { days: 0, retrievability: 1 },
      { days: 10, retrievability: 0.7 },
    ]

    const result = buildRetentionScatter(entries, curve)

    expect(result.scatter.map((e) => e.slug)).toEqual(['a', 'b'])
  })

  it('does not mutate the input entries array', () => {
    const entries: RetentionScatterEntry[] = [
      {
        slug: 'b',
        title: 'B',
        retrievability: 0.8,
        daysSinceReview: 10,
        difficulty: 5,
        stability: 20,
        lapseCount: 0,
        lastReviewAt: '2026-01-05T12:00:00.000Z',
      },
      {
        slug: 'a',
        title: 'A',
        retrievability: 0.95,
        daysSinceReview: 2,
        difficulty: 4,
        stability: 30,
        lapseCount: 0,
        lastReviewAt: '2026-01-13T12:00:00.000Z',
      },
    ]
    const copy = [...entries]

    buildRetentionScatter(entries, [])

    expect(entries).toEqual(copy)
  })

  it('returns the referenceCurve unchanged', () => {
    const curve: ReferenceCurvePoint[] = [
      { days: 0, retrievability: 1 },
      { days: 7, retrievability: 0.9 },
    ]

    const result = buildRetentionScatter([], curve)

    expect(result.referenceCurve).toBe(curve)
  })

  it('returns empty scatter when no entries provided', () => {
    const result = buildRetentionScatter([], [])

    expect(result.scatter).toEqual([])
    expect(result.referenceCurve).toEqual([])
  })
})
```

Also update the existing `buildAnalyticsSummary` test to include the three new fields (the test will fail TypeScript compilation once the interface is extended):

```typescript
// In the existing 'buildAnalyticsSummary' describe block, update the call to:
const result = buildAnalyticsSummary({
  generatedAt,
  reviewDays: 10,
  totalReviews: 42,
  currentStreak: 3,
  retention,
  forecast,
  weakProblems: [],
  targetRetention: 0.9,
  scatter: [],
  referenceCurve: [],
})

// Add these assertions at the end:
expect(result.targetRetention).toBe(0.9)
expect(result.retentionScatter).toEqual([])
expect(result.retentionScatterCurve).toEqual([])
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/analytics/domain/summary.test.ts
```

Expected: compilation error — `buildRetentionScatter` is not exported, `RetentionScatterEntry` does not exist.

- [ ] **Step 3: Add the new types and builder to `summary.ts`**

Add to `src/features/analytics/domain/summary.ts` after the `WeakProblem` interface:

```typescript
export interface RetentionScatterEntry {
  slug: string
  title: string
  retrievability: number
  daysSinceReview: number
  difficulty: number
  stability: number
  lapseCount: number
  lastReviewAt: string
}

export interface ReferenceCurvePoint {
  days: number
  retrievability: number
}
```

Add the following new fields to `AnalyticsSummaryInput`:

```typescript
export interface AnalyticsSummaryInput {
  generatedAt: Date
  reviewDays: number
  totalReviews: number
  currentStreak: number
  retention: RetentionProxyResult
  forecast: ForecastEntry[]
  weakProblems: WeakProblem[]
  targetRetention: number
  scatter: RetentionScatterEntry[]
  referenceCurve: ReferenceCurvePoint[]
}
```

Add the following new fields to `AnalyticsSummary`:

```typescript
export interface AnalyticsSummary {
  generatedAt: string
  reviewDays: number
  totalReviews: number
  currentStreak: number
  retentionProxy: number
  retentionProxyLabel: string
  retentionSampleSize: number
  lowSample: boolean
  dueForecast14Days: ForecastEntry[]
  weakProblems: WeakProblem[]
  targetRetention: number
  retentionScatter: RetentionScatterEntry[]
  retentionScatterCurve: ReferenceCurvePoint[]
}
```

Update `buildAnalyticsSummary` to pass the new fields through:

```typescript
export function buildAnalyticsSummary(input: AnalyticsSummaryInput): AnalyticsSummary {
  return {
    generatedAt: input.generatedAt.toISOString(),
    reviewDays: input.reviewDays,
    totalReviews: input.totalReviews,
    currentStreak: input.currentStreak,
    retentionProxy: input.retention.value,
    retentionProxyLabel: input.retention.label,
    retentionSampleSize: input.retention.sampleSize,
    lowSample: input.retention.lowSample,
    dueForecast14Days: input.forecast,
    weakProblems: input.weakProblems,
    targetRetention: input.targetRetention,
    retentionScatter: input.scatter,
    retentionScatterCurve: input.referenceCurve,
  }
}
```

Add the `buildRetentionScatter` function at the bottom of `summary.ts` (before the private helpers):

```typescript
export function buildRetentionScatter(
  entries: RetentionScatterEntry[],
  referenceCurve: ReferenceCurvePoint[],
): { scatter: RetentionScatterEntry[]; referenceCurve: ReferenceCurvePoint[] } {
  return {
    scatter: [...entries].sort((a, b) => a.daysSinceReview - b.daysSinceReview),
    referenceCurve,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/analytics/domain/summary.test.ts
```

Expected: all tests pass including the new `buildRetentionScatter` describe block.

- [ ] **Step 5: Commit**

```bash
git add src/features/analytics/domain/summary.ts src/features/analytics/domain/summary.test.ts
git commit -m "feat(analytics): add RetentionScatterEntry types and buildRetentionScatter domain builder"
```

---

## Task 2: Repository — `getRetentionScatterCandidates`

**Files:**
- Modify: `src/features/analytics/data/analytics-repository.ts`
- Modify: `src/features/analytics/data/analytics-repository.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `src/features/analytics/data/analytics-repository.test.ts`:

```typescript
import { getRetentionScatterCandidates } from './analytics-repository'

// Add to existing imports at top of file:
// import { getRetentionScatterCandidates } from './analytics-repository'

describe('getRetentionScatterCandidates', () => {
  it('returns empty when no practiced problems exist', async () => {
    const { db } = await createTestDb()

    const result = await getRetentionScatterCandidates(db)

    expect(result).toEqual([])
  })

  it('excludes cards in new state (lastReviewAt is null)', async () => {
    const { db } = await createTestDb()
    await insertPractice(db, 'two-sum')
    await db.insert(fsrsCards).values({
      id: 'two-sum:default',
      problemSlug: 'two-sum',
      cardKind: 'default',
      dueAt: BASE_TS,
      stability: 10,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      learningSteps: 0,
      reps: 0,
      lapses: 0,
      state: 'new',
      lastReviewAt: null,
      createdAt: BASE_TS,
      updatedAt: BASE_TS,
    })

    const result = await getRetentionScatterCandidates(db)

    expect(result).toEqual([])
  })

  it('excludes suspended problems', async () => {
    const { db } = await createTestDb()
    await insertPractice(db, 'two-sum', { isSuspended: true })
    await insertCard(db, 'two-sum')

    const result = await getRetentionScatterCandidates(db)

    expect(result).toEqual([])
  })

  it('returns slug, title, stability, difficulty, lapseCount, lastReviewAt for a reviewed problem', async () => {
    const { db } = await createTestDb()
    await insertPractice(db, 'two-sum')
    await insertCard(db, 'two-sum', { stability: 12, difficulty: 6.5, lapses: 1 })

    const result = await getRetentionScatterCandidates(db)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      slug: 'two-sum',
      title: 'Two Sum',
      stability: 12,
      difficulty: 6.5,
      lapseCount: 1,
    })
    expect(result[0]?.lastReviewAt).toBeInstanceOf(Date)
    expect(result[0]?.lastReviewAt.getTime()).toBe(BASE_TS)
  })

  it('returns all non-new, non-suspended problems regardless of lapse count', async () => {
    const { db } = await createTestDb()
    await insertPractice(db, 'two-sum')
    await insertPractice(db, 'valid-parentheses')
    await insertCard(db, 'two-sum', { lapses: 0 })
    await insertCard(db, 'valid-parentheses', { lapses: 3 })

    const result = await getRetentionScatterCandidates(db)

    expect(result).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/analytics/data/analytics-repository.test.ts
```

Expected: compilation error — `getRetentionScatterCandidates` is not exported.

- [ ] **Step 3: Add the repository function**

Add to `src/features/analytics/data/analytics-repository.ts`:

First add `isNotNull` to the existing drizzle-orm import:

```typescript
import { and, count, desc, eq, gt, gte, isNotNull, lte, ne, sql } from 'drizzle-orm'
```

Then add the new interface and function at the bottom of the file:

```typescript
export interface RetentionScatterCandidate {
  slug: string
  title: string
  stability: number
  difficulty: number
  lapseCount: number
  lastReviewAt: Date
}

export async function getRetentionScatterCandidates(
  db: Db,
): Promise<RetentionScatterCandidate[]> {
  const rows = await db
    .select({
      slug: problems.slug,
      title: problems.title,
      stability: fsrsCards.stability,
      difficulty: fsrsCards.difficulty,
      lapseCount: fsrsCards.lapses,
      lastReviewAt: fsrsCards.lastReviewAt,
    })
    .from(problems)
    .innerJoin(
      fsrsCards,
      and(
        eq(fsrsCards.problemSlug, problems.slug),
        eq(fsrsCards.cardKind, defaultFsrsCardKind),
      ),
    )
    .innerJoin(
      problemPractice,
      eq(problemPractice.problemSlug, problems.slug),
    )
    .where(
      and(
        ne(fsrsCards.state, 'new'),
        eq(problemPractice.isSuspended, false),
        isNotNull(fsrsCards.lastReviewAt),
      ),
    )

  return rows
    .filter((row): row is typeof row & { lastReviewAt: number } => row.lastReviewAt !== null)
    .map((row) => ({
      slug: row.slug,
      title: row.title,
      stability: row.stability,
      difficulty: row.difficulty,
      lapseCount: row.lapseCount,
      lastReviewAt: new Date(row.lastReviewAt),
    }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/analytics/data/analytics-repository.test.ts
```

Expected: all tests pass including the new `getRetentionScatterCandidates` describe block.

- [ ] **Step 5: Commit**

```bash
git add src/features/analytics/data/analytics-repository.ts src/features/analytics/data/analytics-repository.test.ts
git commit -m "feat(analytics): add getRetentionScatterCandidates repository query"
```

---

## Task 3: Contracts — extend Zod schema

**Files:**
- Modify: `src/features/analytics/api/analytics-contracts.ts`
- Modify: `src/features/analytics/api/analytics-contracts.test.ts`

- [ ] **Step 1: Write the failing tests**

Update `src/features/analytics/api/analytics-contracts.test.ts`:

First update `validSummary` to include the three new fields (this also makes the existing `analyticsSummarySchema` test fail with the new required fields):

```typescript
const validSummary = {
  generatedAt: '2026-01-15T12:00:00.000Z',
  reviewDays: 10,
  totalReviews: 42,
  currentStreak: 3,
  retentionProxy: 0.75,
  retentionProxyLabel: '75%',
  retentionSampleSize: 20,
  lowSample: false,
  dueForecast14Days: validForecast,
  weakProblems: [],
  targetRetention: 0.9,
  retentionScatter: [],
  retentionScatterCurve: [],
}
```

Then update the existing import at the top of the file to include the two new schemas:

```typescript
import {
  analyticsSummarySchema,
  forecastEntrySchema,
  retentionScatterEntrySchema,
  referenceCurvePointSchema,
  weakProblemSchema,
} from './analytics-contracts'
```

Then add a new describe block at the bottom of the file:

```typescript

describe('retentionScatterEntrySchema', () => {
  it('accepts a valid scatter entry', () => {
    expect(
      retentionScatterEntrySchema.safeParse({
        slug: 'two-sum',
        title: 'Two Sum',
        retrievability: 0.85,
        daysSinceReview: 5,
        difficulty: 4.5,
        stability: 20,
        lapseCount: 1,
        lastReviewAt: '2026-01-10T12:00:00.000Z',
      }).success,
    ).toBe(true)
  })

  it('rejects negative daysSinceReview', () => {
    expect(
      retentionScatterEntrySchema.safeParse({
        slug: 'two-sum',
        title: 'Two Sum',
        retrievability: 0.85,
        daysSinceReview: -1,
        difficulty: 4.5,
        stability: 20,
        lapseCount: 1,
        lastReviewAt: '2026-01-10T12:00:00.000Z',
      }).success,
    ).toBe(false)
  })

  it('rejects retrievability outside 0–1 range', () => {
    expect(
      retentionScatterEntrySchema.safeParse({
        slug: 'two-sum',
        title: 'Two Sum',
        retrievability: 1.5,
        daysSinceReview: 5,
        difficulty: 4.5,
        stability: 20,
        lapseCount: 1,
        lastReviewAt: '2026-01-10T12:00:00.000Z',
      }).success,
    ).toBe(false)
  })
})

describe('referenceCurvePointSchema', () => {
  it('accepts a valid curve point', () => {
    expect(
      referenceCurvePointSchema.safeParse({ days: 7, retrievability: 0.9 }).success,
    ).toBe(true)
  })

  it('rejects negative days', () => {
    expect(
      referenceCurvePointSchema.safeParse({ days: -1, retrievability: 0.9 }).success,
    ).toBe(false)
  })
})

describe('analyticsSummarySchema — new scatter fields', () => {
  it('rejects a summary missing targetRetention', () => {
    const { targetRetention: _, ...withoutField } = validSummary
    expect(analyticsSummarySchema.safeParse(withoutField).success).toBe(false)
  })

  it('rejects a summary missing retentionScatter', () => {
    const { retentionScatter: _, ...withoutField } = validSummary
    expect(analyticsSummarySchema.safeParse(withoutField).success).toBe(false)
  })

  it('rejects a summary missing retentionScatterCurve', () => {
    const { retentionScatterCurve: _, ...withoutField } = validSummary
    expect(analyticsSummarySchema.safeParse(withoutField).success).toBe(false)
  })

  it('rejects targetRetention outside 0–1', () => {
    expect(
      analyticsSummarySchema.safeParse({ ...validSummary, targetRetention: 1.5 }).success,
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/analytics/api/analytics-contracts.test.ts
```

Expected: existing `analyticsSummarySchema` tests fail (missing new required fields in `validSummary` is already fixed above, but `retentionScatterEntrySchema` and `referenceCurvePointSchema` are not yet exported).

- [ ] **Step 3: Extend the contracts**

Update `src/features/analytics/api/analytics-contracts.ts`:

```typescript
import { z } from 'zod'

export const analyticsSummaryRequestSchema = z.object({})

export type AnalyticsSummaryRequest = z.infer<typeof analyticsSummaryRequestSchema>

export const weakProblemSchema = z.object({
  slug: z.string(),
  title: z.string(),
  lapseCount: z.number().int().nonnegative(),
  difficulty: z.number(),
  retrievability: z.number(),
})

export const forecastEntrySchema = z.object({
  date: z.string(),
  dueCount: z.number().int().nonnegative(),
})

export const retentionScatterEntrySchema = z.object({
  slug: z.string(),
  title: z.string(),
  retrievability: z.number().min(0).max(1),
  daysSinceReview: z.number().int().nonnegative(),
  difficulty: z.number(),
  stability: z.number(),
  lapseCount: z.number().int().nonnegative(),
  lastReviewAt: z.string(),
})

export const referenceCurvePointSchema = z.object({
  days: z.number().int().nonnegative(),
  retrievability: z.number().min(0).max(1),
})

export const analyticsSummarySchema = z.object({
  generatedAt: z.string(),
  reviewDays: z.number().int().nonnegative(),
  totalReviews: z.number().int().nonnegative(),
  currentStreak: z.number().int().nonnegative(),
  retentionProxy: z.number(),
  retentionProxyLabel: z.string(),
  retentionSampleSize: z.number().int().nonnegative(),
  lowSample: z.boolean(),
  dueForecast14Days: z.array(forecastEntrySchema).length(14),
  weakProblems: z.array(weakProblemSchema).max(10),
  targetRetention: z.number().min(0).max(1),
  retentionScatter: z.array(retentionScatterEntrySchema),
  retentionScatterCurve: z.array(referenceCurvePointSchema),
})

export type SerializedAnalyticsSummary = z.infer<typeof analyticsSummarySchema>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/analytics/api/analytics-contracts.test.ts
```

Expected: all tests pass including the new schema describe blocks.

- [ ] **Step 5: Commit**

```bash
git add src/features/analytics/api/analytics-contracts.ts src/features/analytics/api/analytics-contracts.test.ts
git commit -m "feat(analytics): extend analytics contracts with retention scatter Zod schemas"
```

---

## Task 4: Service — wire scatter into the pipeline

**Files:**
- Modify: `src/features/analytics/server/analytics-service.ts`

No new test file — the service is covered end-to-end by the screen integration test in Task 5.

- [ ] **Step 1: Update imports**

In `src/features/analytics/server/analytics-service.ts`, update the repository import to include `getRetentionScatterCandidates`:

```typescript
import {
  getReviewDayStats,
  getRecentRatings,
  getUpcomingCards,
  getWeakProblemCandidates,
  getRetentionScatterCandidates,
} from '../data/analytics-repository'
```

Update the domain import to include the new builder and types:

```typescript
import {
  buildRetentionProxy,
  buildDueForecast,
  buildWeakProblems,
  buildAnalyticsSummary,
  buildRetentionScatter,
  type AnalyticsSummary,
  type RetentionScatterEntry,
  type ReferenceCurvePoint,
} from '../domain/summary'
```

- [ ] **Step 2: Add scatter to the parallel read block (Step 1)**

Replace the `Promise.all` call:

```typescript
const [dayStats, recentRatings, upcomingCards, weakCandidates, settings, scatterCandidates] =
  await Promise.all([
    getReviewDayStats(db),
    getRecentRatings(db, thirtyDaysAgo),
    getUpcomingCards(db, fourteenDaysLater),
    getWeakProblemCandidates(db),
    getSettings(db),
    getRetentionScatterCandidates(db),
  ])
```

- [ ] **Step 3: Add scatter enrichment (after the existing weak-problems enrichment)**

After the `enrichedCandidates` block (Step 3 in the existing service), add:

```typescript
const dayMs = 24 * 60 * 60 * 1000

const enrichedScatter: RetentionScatterEntry[] = scatterCandidates.map((c) => ({
  slug: c.slug,
  title: c.title,
  retrievability: getRetrievability(
    buildMinimalCard(c.stability, c.difficulty, c.lapseCount, c.lastReviewAt),
    now,
  ),
  daysSinceReview: Math.round((now.getTime() - c.lastReviewAt.getTime()) / dayMs),
  difficulty: c.difficulty,
  stability: c.stability,
  lapseCount: c.lapseCount,
  lastReviewAt: c.lastReviewAt.toISOString(),
}))

const medianStability = computeMedianStability(scatterCandidates.map((c) => c.stability))
const maxDays = Math.max(14, ...enrichedScatter.map((e) => e.daysSinceReview), 0)
const precomputedCurve: ReferenceCurvePoint[] = Array.from(
  { length: maxDays + 1 },
  (_, day) => ({
    days: day,
    retrievability: getRetrievability(
      buildMinimalCard(medianStability, 5, 0, new Date(now.getTime() - day * dayMs)),
      now,
    ),
  }),
)

const { scatter, referenceCurve } = buildRetentionScatter(enrichedScatter, precomputedCurve)
```

- [ ] **Step 4: Pass scatter fields into `buildAnalyticsSummary`**

Update the return statement (Step 5) to include the new fields:

```typescript
return buildAnalyticsSummary({
  generatedAt: now,
  reviewDays: dayStats.reviewDays,
  totalReviews: dayStats.totalReviews,
  currentStreak: practiceProgress.currentStreak,
  retention,
  forecast,
  weakProblems,
  targetRetention: settings.review.targetRetention,
  scatter,
  referenceCurve,
})
```

- [ ] **Step 5: Add `computeMedianStability` private helper**

Add at the bottom of the file, alongside the other private helpers:

```typescript
function computeMedianStability(stabilities: number[]): number {
  if (stabilities.length === 0) return 21
  const sorted = [...stabilities].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1]! + sorted[mid]!) / 2)
    : (sorted[mid]!)
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/analytics/server/analytics-service.ts
git commit -m "feat(analytics): add retention scatter enrichment to analytics service"
```

---

## Task 5: UI component + screen integration

**Files:**
- Create: `src/features/analytics/components/analytics-retention-scatter.tsx`
- Modify: `src/features/analytics/components/analytics-screen.tsx`
- Modify: `src/features/analytics/components/analytics-screen.test.tsx`
- Modify: `src/features/analytics/index.ts`

- [ ] **Step 1: Write the failing screen tests**

Update `src/features/analytics/components/analytics-screen.test.tsx`:

First, update `baseAnalyticsSummary()` to include the three new fields:

```typescript
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
    targetRetention: 0.9,
    retentionScatter: [
      {
        slug: 'two-sum',
        title: 'Two Sum',
        retrievability: 0.95,
        daysSinceReview: 2,
        difficulty: 4.5,
        stability: 20,
        lapseCount: 0,
        lastReviewAt: '2026-01-13T12:00:00.000Z',
      },
    ],
    retentionScatterCurve: Array.from({ length: 15 }, (_, i) => ({
      days: i,
      retrievability: Math.max(0, 1 - i * 0.04),
    })),
  }
}
```

Then add two new test cases to the `AnalyticsScreen` describe block:

```typescript
it('renders retention health region when scatter data is present', async () => {
  vi.mocked(sendMessage).mockResolvedValueOnce(createAnalyticsSummary())

  renderAnalyticsScreen()

  expect(
    await screen.findByRole('region', { name: 'Retention health' }),
  ).toBeVisible()
})

it('renders retention health empty state when scatter is empty', async () => {
  vi.mocked(sendMessage).mockResolvedValueOnce(
    createAnalyticsSummary({ retentionScatter: [] }),
  )

  renderAnalyticsScreen()

  await screen.findByRole('region', { name: 'Retention health' })
  expect(
    screen.getByText(/No reviewed problems yet/),
  ).toBeVisible()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/analytics/components/analytics-screen.test.tsx
```

Expected: FAIL — "Retention health" region not found (component doesn't exist yet). Also any existing tests that call `createAnalyticsSummary` may fail if the mock doesn't include the new fields — the `baseAnalyticsSummary` update above fixes that.

- [ ] **Step 3: Create the `AnalyticsRetentionScatter` component**

Create `src/features/analytics/components/analytics-retention-scatter.tsx`:

```typescript
import { useState } from 'react'

import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'

import type { ReferenceCurvePoint, RetentionScatterEntry } from '../domain/summary'

const SVG_W = 560
const SVG_H = 200
const PAD_TOP = 10
const PAD_RIGHT = 40
const PAD_BOTTOM = 28
const PAD_LEFT = 30
const CHART_W = SVG_W - PAD_LEFT - PAD_RIGHT
const CHART_H = SVG_H - PAD_TOP - PAD_BOTTOM

function toX(days: number, maxDays: number): number {
  return PAD_LEFT + (maxDays === 0 ? 0 : (days / maxDays) * CHART_W)
}

function toY(retrievability: number): number {
  return PAD_TOP + (1 - retrievability) * CHART_H
}

function dotColor(retrievability: number, targetRetention: number): string {
  if (retrievability >= targetRetention) return '#22c55e'
  if (retrievability >= targetRetention - 0.1) return '#f59e0b'
  return '#ef4444'
}

interface HoveredEntry {
  entry: RetentionScatterEntry
  clientX: number
  clientY: number
}

export function AnalyticsRetentionScatter({
  scatter,
  referenceCurve,
  targetRetention,
}: {
  scatter: RetentionScatterEntry[]
  referenceCurve: ReferenceCurvePoint[]
  targetRetention: number
}) {
  const [hovered, setHovered] = useState<HoveredEntry | null>(null)

  const aboveCount = scatter.filter((e) => e.retrievability >= targetRetention).length
  const belowCount = scatter.length - aboveCount
  const targetPct = Math.round(targetRetention * 100)

  if (scatter.length === 0) {
    return (
      <Surface aria-label="Retention health" className="grid gap-3" role="region">
        <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
          Retention Health
        </div>
        <InlineStatus>
          No reviewed problems yet. Complete some reviews to see retention health.
        </InlineStatus>
      </Surface>
    )
  }

  const maxDays = Math.max(14, ...scatter.map((e) => e.daysSinceReview))
  const thresholdY = toY(targetRetention)

  const curvePath =
    referenceCurve.length > 0
      ? referenceCurve
          .map((pt, i) => {
            const x = toX(pt.days, maxDays)
            const y = toY(pt.retrievability)
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
          })
          .join(' ')
      : ''

  return (
    <Surface aria-label="Retention health" className="grid gap-3" role="region">
      <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
        Retention Health
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <div className="grid gap-1 rounded-md border border-border p-3">
          <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            Target
          </div>
          <div className="text-3xl font-bold leading-none tabular-nums">{targetPct}%</div>
          <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
            from FSRS settings
          </p>
        </div>
        <div className="grid gap-1 rounded-md border border-border p-3">
          <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            Above
          </div>
          <div className="text-3xl font-bold leading-none tabular-nums">{aboveCount}</div>
          <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
            problems well retained
          </p>
        </div>
        <div className="grid gap-1 rounded-md border border-border p-3">
          <div className="text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
            Below
          </div>
          <div className="text-3xl font-bold leading-none tabular-nums">{belowCount}</div>
          <p className="m-0 text-[length:var(--cp-badge-font-size)] leading-snug text-muted-foreground">
            problems need review
          </p>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          aria-hidden="true"
          className="w-full"
        >
          {[0.2, 0.4, 0.6, 0.8, 1.0].map((v) => (
            <line
              key={v}
              x1={PAD_LEFT}
              y1={toY(v)}
              x2={SVG_W - PAD_RIGHT}
              y2={toY(v)}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
          ))}

          {[100, 80, 60, 40, 20].map((pct) => (
            <text
              key={pct}
              x={PAD_LEFT - 4}
              y={toY(pct / 100) + 3}
              fill="currentColor"
              fillOpacity={0.4}
              fontSize={8}
              textAnchor="end"
            >
              {pct}%
            </text>
          ))}

          {curvePath !== '' && (
            <path
              d={curvePath}
              fill="none"
              stroke="#7c6af7"
              strokeWidth={1.5}
              strokeDasharray="5,3"
              strokeOpacity={0.6}
            />
          )}

          <line
            x1={PAD_LEFT}
            y1={thresholdY}
            x2={SVG_W - PAD_RIGHT}
            y2={thresholdY}
            stroke="#7c6af7"
            strokeWidth={1.2}
            strokeDasharray="3,3"
            strokeOpacity={0.5}
          />
          <text
            x={SVG_W - PAD_RIGHT + 2}
            y={thresholdY + 3}
            fill="#7c6af7"
            fillOpacity={0.8}
            fontSize={7}
          >
            {targetPct}%
          </text>

          <line
            x1={PAD_LEFT}
            y1={PAD_TOP}
            x2={PAD_LEFT}
            y2={SVG_H - PAD_BOTTOM}
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={1}
          />
          <line
            x1={PAD_LEFT}
            y1={SVG_H - PAD_BOTTOM}
            x2={SVG_W - PAD_RIGHT}
            y2={SVG_H - PAD_BOTTOM}
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={1}
          />

          {scatter.map((entry) => (
            <circle
              key={entry.slug}
              cx={toX(entry.daysSinceReview, maxDays)}
              cy={toY(entry.retrievability)}
              r={5}
              fill={dotColor(entry.retrievability, targetRetention)}
              opacity={0.85}
              data-testid="scatter-dot"
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) =>
                setHovered({ entry, clientX: e.clientX, clientY: e.clientY })
              }
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>

        {hovered !== null && (
          <ScatterTooltip
            entry={hovered.entry}
            targetRetention={targetRetention}
            clientX={hovered.clientX}
            clientY={hovered.clientY}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-[length:var(--cp-badge-font-size)] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full bg-[#22c55e]"
          />
          Above target
        </span>
        <span className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full bg-[#f59e0b]"
          />
          Approaching
        </span>
        <span className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full bg-[#ef4444]"
          />
          Below target
        </span>
      </div>
    </Surface>
  )
}

function ScatterTooltip({
  entry,
  targetRetention,
  clientX,
  clientY,
}: {
  entry: RetentionScatterEntry
  targetRetention: number
  clientX: number
  clientY: number
}) {
  const pct = Math.round(entry.retrievability * 100)
  const targetPct = Math.round(targetRetention * 100)
  const isBelow = entry.retrievability < targetRetention
  const lastReview = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(entry.lastReviewAt))

  return (
    <div
      className="pointer-events-none fixed z-50 max-w-[220px] rounded-md border border-border bg-popover p-3 text-[length:var(--cp-badge-font-size)] shadow-md"
      style={{ left: clientX + 12, top: clientY - 10 }}
    >
      <div className="mb-1 font-semibold text-foreground">{entry.title}</div>
      <div className="text-muted-foreground">Last review: {lastReview}</div>
      <div className="text-muted-foreground">
        Difficulty: {entry.difficulty.toFixed(1)}
      </div>
      <div className="text-muted-foreground">
        Stability: {entry.stability.toFixed(1)}d
      </div>
      <div className="text-muted-foreground">Lapses: {entry.lapseCount}</div>
      <div className={isBelow ? 'text-destructive' : 'text-[#22c55e]'}>
        {pct}% retrievability{' '}
        {isBelow ? `↓ below ${targetPct}%` : `✓ above ${targetPct}%`}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Mount the component in `analytics-screen.tsx`**

Update `src/features/analytics/components/analytics-screen.tsx`:

```typescript
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'

import { useAnalyticsSummary } from '../api/analytics-api'
import { AnalyticsForecast } from './analytics-forecast'
import { AnalyticsMetricRow } from './analytics-metric-row'
import { AnalyticsRetentionScatter } from './analytics-retention-scatter'
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
      <AnalyticsRetentionScatter
        scatter={data.retentionScatter}
        referenceCurve={data.retentionScatterCurve}
        targetRetention={data.targetRetention}
      />
      <AnalyticsWeakProblems problems={data.weakProblems} />
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/features/analytics/components/analytics-screen.test.tsx
```

Expected: all tests pass including the two new scatter assertions.

- [ ] **Step 6: Export new types from feature index**

Update `src/features/analytics/index.ts`:

```typescript
export { AnalyticsScreen } from './components'
export { useAnalyticsSummary, analyticsQueryKeys } from './api/analytics-api'

export type {
  AnalyticsSummary,
  WeakProblem,
  ForecastEntry,
  RetentionScatterEntry,
  ReferenceCurvePoint,
} from './domain/summary'
```

- [ ] **Step 7: Run the full test suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add \
  src/features/analytics/components/analytics-retention-scatter.tsx \
  src/features/analytics/components/analytics-screen.tsx \
  src/features/analytics/components/analytics-screen.test.tsx \
  src/features/analytics/index.ts
git commit -m "feat(analytics): add AnalyticsRetentionScatter scatter chart component"
```
