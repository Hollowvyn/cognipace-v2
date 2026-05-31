# Analytics Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `analytics.getSummary` backend feature: domain functions, repository queries, service orchestration, messaging registration, and a TanStack Query hook.

**Architecture:** Focused 4-query repository (separate SQL per metric), pure domain functions, service orchestration via existing practice-progress and settings services. The feature is wired into the extension messaging layer identically to `queue.getTodayQueue`.

**Tech Stack:** TypeScript, Drizzle ORM (SQLite), Zod, TanStack Query, Vitest, WXT Chrome extension messaging (`@webext-core/messaging`)

---

## File Map

**Create:**
- `src/features/analytics/domain/summary.ts` — pure domain functions and types
- `src/features/analytics/domain/summary.test.ts` — unit tests
- `src/features/analytics/data/analytics-repository.ts` — 4 focused DB queries
- `src/features/analytics/server/analytics-service.ts` — service orchestrator
- `src/features/analytics/api/analytics-contracts.ts` — Zod schemas + serialized types
- `src/features/analytics/api/analytics-api.ts` — `useAnalyticsSummary()` hook
- `src/features/analytics/index.ts` — barrel exports

**Modify:**
- `src/platform/query/query-keys.ts` — add `analytics` key group
- `src/platform/query/cache-invalidation.ts` — add `'analytics'` tag + wire invalidation
- `src/extension/messaging.ts` — add `AnalyticsSummaryRequest`, `SerializedAnalyticsSummary`, `ProtocolMap` entry
- `src/extension/background/register-handlers.ts` — register `analytics.getSummary` handler

---

## Task 1: Domain types and `buildRetentionProxy`

**Files:**
- Create: `src/features/analytics/domain/summary.ts`
- Create: `src/features/analytics/domain/summary.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/analytics/domain/summary.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'

import { buildRetentionProxy } from './summary'

const now = new Date('2026-01-15T12:00:00.000Z')
const recentDate = new Date('2026-01-14T12:00:00.000Z')
const oldDate = new Date('2025-12-14T12:00:00.000Z') // > 30 days before now

describe('buildRetentionProxy', () => {
  it('returns lowSample when fewer than 10 ratings in the 30-day window', () => {
    const attempts = Array.from({ length: 9 }, () => ({
      rating: 'good',
      reviewedAt: recentDate,
    }))

    const result = buildRetentionProxy(attempts, now)

    expect(result.lowSample).toBe(true)
    expect(result.value).toBe(0)
    expect(result.label).toBe('—')
    expect(result.sampleSize).toBe(9)
  })

  it('returns correct percentage for sufficient sample', () => {
    const attempts = [
      ...Array.from({ length: 7 }, () => ({ rating: 'good', reviewedAt: recentDate })),
      ...Array.from({ length: 3 }, () => ({ rating: 'again', reviewedAt: recentDate })),
    ]

    const result = buildRetentionProxy(attempts, now)

    expect(result.lowSample).toBe(false)
    expect(result.value).toBeCloseTo(0.7)
    expect(result.label).toBe('70%')
    expect(result.sampleSize).toBe(10)
  })

  it('counts good and easy as positive; again and hard as not positive', () => {
    const attempts = [
      { rating: 'good', reviewedAt: recentDate },
      { rating: 'easy', reviewedAt: recentDate },
      { rating: 'again', reviewedAt: recentDate },
      { rating: 'hard', reviewedAt: recentDate },
      ...Array.from({ length: 6 }, () => ({ rating: 'good', reviewedAt: recentDate })),
    ]

    const result = buildRetentionProxy(attempts, now)

    expect(result.value).toBeCloseTo(0.8)
    expect(result.label).toBe('80%')
  })

  it('excludes ratings older than 30 days', () => {
    const attempts = Array.from({ length: 10 }, () => ({
      rating: 'good',
      reviewedAt: oldDate,
    }))

    const result = buildRetentionProxy(attempts, now)

    expect(result.lowSample).toBe(true)
    expect(result.sampleSize).toBe(0)
  })

  it('boundary: exactly 10 ratings in window is not lowSample', () => {
    const attempts = Array.from({ length: 10 }, () => ({
      rating: 'good',
      reviewedAt: recentDate,
    }))

    const result = buildRetentionProxy(attempts, now)

    expect(result.lowSample).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /path/to/cognipace-v2 && npx vitest run src/features/analytics/domain/summary.test.ts
```

Expected: FAIL — `Cannot find module './summary'`

- [ ] **Step 3: Implement `buildRetentionProxy` and shared helpers**

Create `src/features/analytics/domain/summary.ts`:

```typescript
export interface RetentionProxyResult {
  value: number
  label: string
  sampleSize: number
  lowSample: boolean
}

export interface ForecastEntry {
  date: string
  dueCount: number
}

export interface WeakProblem {
  slug: string
  title: string
  lapseCount: number
  difficulty: number
  retrievability: number
}

export interface AnalyticsSummaryInput {
  generatedAt: Date
  reviewDays: number
  totalReviews: number
  currentStreak: number
  retention: RetentionProxyResult
  forecast: ForecastEntry[]
  weakProblems: WeakProblem[]
}

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
}

export function buildRetentionProxy(
  attempts: Array<{ rating: string; reviewedAt: Date }>,
  now: Date,
): RetentionProxyResult {
  const since = subtractDays(now, 30)
  const recent = attempts.filter((a) => a.reviewedAt >= since)
  const sampleSize = recent.length

  if (sampleSize < 10) {
    return { value: 0, label: '—', sampleSize, lowSample: true }
  }

  const positive = recent.filter(
    (a) => a.rating === 'good' || a.rating === 'easy',
  ).length
  const value = positive / sampleSize
  const label = `${Math.round(value * 100)}%`

  return { value, label, sampleSize, lowSample: false }
}

// Placeholders — implemented in Tasks 2 and 3
export function buildDueForecast(
  _cards: Array<{ dueAt: Date }>,
  _now: Date,
): ForecastEntry[] {
  return []
}

export function buildWeakProblems(_candidates: WeakProblem[]): WeakProblem[] {
  return []
}

export function buildAnalyticsSummary(
  _input: AnalyticsSummaryInput,
): AnalyticsSummary {
  throw new Error('Not implemented')
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
npx vitest run src/features/analytics/domain/summary.test.ts
```

Expected: all `buildRetentionProxy` tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/analytics/domain/summary.ts src/features/analytics/domain/summary.test.ts
git commit -m "feat(analytics): add buildRetentionProxy domain function"
```

---

## Task 2: `buildDueForecast`

**Files:**
- Modify: `src/features/analytics/domain/summary.ts`
- Modify: `src/features/analytics/domain/summary.test.ts`

- [ ] **Step 1: Add failing tests**

Append to the `describe` block in `summary.test.ts`:

```typescript
import { buildRetentionProxy, buildDueForecast } from './summary'

// Add inside the file (new describe block):

describe('buildDueForecast', () => {
  it('returns exactly 14 entries starting from today', () => {
    const result = buildDueForecast([], now)

    expect(result).toHaveLength(14)
    expect(result[0]?.date).toBe('2026-01-15')
    expect(result[13]?.date).toBe('2026-01-28')
  })

  it('fills all entries with zero when no cards provided', () => {
    const result = buildDueForecast([], now)

    expect(result.every((e) => e.dueCount === 0)).toBe(true)
  })

  it('counts cards due on their local date', () => {
    const result = buildDueForecast(
      [
        { dueAt: new Date('2026-01-16T00:00:00.000Z') },
        { dueAt: new Date('2026-01-16T08:00:00.000Z') },
        { dueAt: new Date('2026-01-20T00:00:00.000Z') },
      ],
      now,
    )

    // Jan 16 = index 1, Jan 20 = index 5
    expect(result[1]?.dueCount).toBe(2)
    expect(result[5]?.dueCount).toBe(1)
  })

  it('clamps overdue cards (dueAt < now) to today (index 0)', () => {
    const result = buildDueForecast(
      [{ dueAt: new Date('2026-01-10T00:00:00.000Z') }],
      now,
    )

    expect(result[0]?.dueCount).toBe(1)
  })

  it('ignores cards outside the 14-day window', () => {
    const result = buildDueForecast(
      [{ dueAt: new Date('2026-01-29T00:00:00.000Z') }], // day 14 — outside window
      now,
    )

    expect(result.every((e) => e.dueCount === 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify new tests fail**

```bash
npx vitest run src/features/analytics/domain/summary.test.ts
```

Expected: `buildDueForecast` tests FAIL (placeholder returns `[]`)

- [ ] **Step 3: Implement `buildDueForecast`**

Replace the placeholder in `summary.ts`:

```typescript
export function buildDueForecast(
  cards: Array<{ dueAt: Date }>,
  now: Date,
): ForecastEntry[] {
  const entries: ForecastEntry[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    return { date: toLocalDateKey(d), dueCount: 0 }
  })

  const todayKey = toLocalDateKey(now)
  const dateToIndex = new Map(entries.map((e, i) => [e.date, i]))

  for (const card of cards) {
    const key = card.dueAt < now ? todayKey : toLocalDateKey(card.dueAt)
    const index = dateToIndex.get(key)
    if (index !== undefined) {
      entries[index]!.dueCount++
    }
  }

  return entries
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
```

Also remove `toLocalDateKey` from being defined twice — it's now a module-private helper (keep it at the bottom of the file, after all exports).

- [ ] **Step 4: Run tests and verify they pass**

```bash
npx vitest run src/features/analytics/domain/summary.test.ts
```

Expected: all `buildDueForecast` tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/analytics/domain/summary.ts src/features/analytics/domain/summary.test.ts
git commit -m "feat(analytics): add buildDueForecast domain function"
```

---

## Task 3: `buildWeakProblems` and `buildAnalyticsSummary`

**Files:**
- Modify: `src/features/analytics/domain/summary.ts`
- Modify: `src/features/analytics/domain/summary.test.ts`

- [ ] **Step 1: Add failing tests**

Append two new `describe` blocks to `summary.test.ts`:

```typescript
import {
  buildRetentionProxy,
  buildDueForecast,
  buildWeakProblems,
  buildAnalyticsSummary,
} from './summary'

describe('buildWeakProblems', () => {
  it('sorts by lapses DESC, then difficulty DESC, then retrievability ASC', () => {
    const result = buildWeakProblems([
      { slug: 'a', title: 'A', lapseCount: 2, difficulty: 5, retrievability: 0.8 },
      { slug: 'b', title: 'B', lapseCount: 3, difficulty: 4, retrievability: 0.9 },
      { slug: 'c', title: 'C', lapseCount: 2, difficulty: 7, retrievability: 0.5 },
      { slug: 'd', title: 'D', lapseCount: 2, difficulty: 5, retrievability: 0.3 },
    ])

    expect(result.map((p) => p.slug)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('returns at most 10 problems', () => {
    const candidates = Array.from({ length: 15 }, (_, i) => ({
      slug: `problem-${i}`,
      title: `Problem ${i}`,
      lapseCount: i + 1,
      difficulty: 5,
      retrievability: 0.5,
    }))

    expect(buildWeakProblems(candidates)).toHaveLength(10)
  })

  it('does not mutate the input array', () => {
    const candidates = [
      { slug: 'a', title: 'A', lapseCount: 1, difficulty: 5, retrievability: 0.8 },
      { slug: 'b', title: 'B', lapseCount: 3, difficulty: 5, retrievability: 0.5 },
    ]
    const copy = [...candidates]
    buildWeakProblems(candidates)

    expect(candidates).toEqual(copy)
  })
})

describe('buildAnalyticsSummary', () => {
  it('assembles all fields into the summary shape', () => {
    const generatedAt = new Date('2026-01-15T12:00:00.000Z')
    const retention: RetentionProxyResult = {
      value: 0.75,
      label: '75%',
      sampleSize: 20,
      lowSample: false,
    }
    const forecast: ForecastEntry[] = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-01-${String(15 + i).padStart(2, '0')}`,
      dueCount: i,
    }))

    const result = buildAnalyticsSummary({
      generatedAt,
      reviewDays: 10,
      totalReviews: 42,
      currentStreak: 3,
      retention,
      forecast,
      weakProblems: [],
    })

    expect(result.generatedAt).toBe('2026-01-15T12:00:00.000Z')
    expect(result.reviewDays).toBe(10)
    expect(result.totalReviews).toBe(42)
    expect(result.currentStreak).toBe(3)
    expect(result.retentionProxy).toBe(0.75)
    expect(result.retentionProxyLabel).toBe('75%')
    expect(result.retentionSampleSize).toBe(20)
    expect(result.lowSample).toBe(false)
    expect(result.dueForecast14Days).toBe(forecast)
    expect(result.weakProblems).toEqual([])
  })
})
```

Also add at the top of the test file:
```typescript
import type { RetentionProxyResult, ForecastEntry } from './summary'
```

- [ ] **Step 2: Run to verify new tests fail**

```bash
npx vitest run src/features/analytics/domain/summary.test.ts
```

Expected: `buildWeakProblems` and `buildAnalyticsSummary` tests FAIL

- [ ] **Step 3: Replace placeholders in `summary.ts`**

```typescript
export function buildWeakProblems(candidates: WeakProblem[]): WeakProblem[] {
  return [...candidates]
    .sort((a, b) => {
      if (b.lapseCount !== a.lapseCount) return b.lapseCount - a.lapseCount
      if (b.difficulty !== a.difficulty) return b.difficulty - a.difficulty
      return a.retrievability - b.retrievability
    })
    .slice(0, 10)
}

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
  }
}
```

- [ ] **Step 4: Run all domain tests**

```bash
npx vitest run src/features/analytics/domain/summary.test.ts
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/analytics/domain/summary.ts src/features/analytics/domain/summary.test.ts
git commit -m "feat(analytics): add buildWeakProblems and buildAnalyticsSummary"
```

---

## Task 4: Analytics contracts (Zod schemas)

**Files:**
- Create: `src/features/analytics/api/analytics-contracts.ts`

- [ ] **Step 1: Create the contracts file**

```typescript
// src/features/analytics/api/analytics-contracts.ts
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
})

export type SerializedAnalyticsSummary = z.infer<typeof analyticsSummarySchema>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/analytics/api/analytics-contracts.ts
git commit -m "feat(analytics): add analytics Zod contracts"
```

---

## Task 5: Analytics repository

**Files:**
- Create: `src/features/analytics/data/analytics-repository.ts`

- [ ] **Step 1: Create the repository**

```typescript
// src/features/analytics/data/analytics-repository.ts
import { and, eq, gt, gte, innerJoin, lte, ne } from 'drizzle-orm'

import { defaultFsrsCardKind } from '@/lib/fsrs'

import type { Db } from '@/platform/db'

import {
  fsrsCards,
  problemPractice,
  problems,
  reviewAttempts,
} from '@/platform/db/schema'

export interface ReviewDayStats {
  totalReviews: number
  reviewDays: number
}

export interface RecentRating {
  rating: string
  reviewedAt: Date
}

export interface UpcomingCard {
  dueAt: Date
}

export interface WeakProblemCandidate {
  slug: string
  title: string
  lapseCount: number
  difficulty: number
  stability: number
  lastReviewAt: Date | null
}

export async function getReviewDayStats(db: Db): Promise<ReviewDayStats> {
  const rows = await db
    .select({ reviewedAt: reviewAttempts.reviewedAt })
    .from(reviewAttempts)

  const dateKeys = new Set(
    rows.map((r) => toLocalDateKey(new Date(r.reviewedAt))),
  )

  return {
    totalReviews: rows.length,
    reviewDays: dateKeys.size,
  }
}

export async function getRecentRatings(
  db: Db,
  since: Date,
): Promise<RecentRating[]> {
  const rows = await db
    .select({
      rating: reviewAttempts.rating,
      reviewedAt: reviewAttempts.reviewedAt,
    })
    .from(reviewAttempts)
    .where(gte(reviewAttempts.reviewedAt, since.getTime()))

  return rows.map((row) => ({
    rating: row.rating,
    reviewedAt: new Date(row.reviewedAt),
  }))
}

export async function getUpcomingCards(
  db: Db,
  until: Date,
): Promise<UpcomingCard[]> {
  const rows = await db
    .select({ dueAt: fsrsCards.dueAt })
    .from(fsrsCards)
    .innerJoin(
      problemPractice,
      eq(problemPractice.problemSlug, fsrsCards.problemSlug),
    )
    .where(
      and(
        eq(fsrsCards.cardKind, defaultFsrsCardKind),
        lte(fsrsCards.dueAt, until.getTime()),
        eq(problemPractice.isSuspended, false),
      ),
    )

  return rows.map((row) => ({ dueAt: new Date(row.dueAt) }))
}

export async function getWeakProblemCandidates(
  db: Db,
): Promise<WeakProblemCandidate[]> {
  const rows = await db
    .select({
      slug: problems.slug,
      title: problems.title,
      lapseCount: fsrsCards.lapses,
      difficulty: fsrsCards.difficulty,
      stability: fsrsCards.stability,
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
        ne(problemPractice.status, 'new'),
        eq(problemPractice.isSuspended, false),
        gt(fsrsCards.lapses, 0),
      ),
    )

  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    lapseCount: row.lapseCount,
    difficulty: row.difficulty,
    stability: row.stability,
    lastReviewAt:
      row.lastReviewAt === null ? null : new Date(row.lastReviewAt),
  }))
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in the new file

- [ ] **Step 3: Commit**

```bash
git add src/features/analytics/data/analytics-repository.ts
git commit -m "feat(analytics): add analytics repository with 4 focused queries"
```

---

## Task 6: Query keys and cache invalidation

**Files:**
- Modify: `src/platform/query/query-keys.ts`
- Modify: `src/platform/query/cache-invalidation.ts`

- [ ] **Step 1: Add `analytics` to query-keys.ts**

Open `src/platform/query/query-keys.ts`. Add the `analytics` entry to the `queryKeys` object (add it before `appShell` or at the end, maintaining alphabetical order is optional but consistent):

```typescript
// Add inside the queryKeys object:
analytics: {
  all: ['analytics'] as const,
  summary: () => [...queryKeys.analytics.all, 'summary'] as const,
},
```

The final shape of the relevant portion of the file:

```typescript
export const queryKeys = {
  analytics: {
    all: ['analytics'] as const,
    summary: () => [...queryKeys.analytics.all, 'summary'] as const,
  },
  appShell: {
    // ... existing entries unchanged
  },
  // ... all other existing entries unchanged
} as const
```

- [ ] **Step 2: Add `'analytics'` to cache-invalidation.ts**

Open `src/platform/query/cache-invalidation.ts`. Make two changes:

**Change 1** — Add `'analytics'` to `cacheInvalidationTags` array (alphabetical):

```typescript
export const cacheInvalidationTags = [
  'analytics',   // add
  'app-shell',
  'practice',
  'problems',
  'queue',
  'settings',
  'sync',
  'tracks',
] as const
```

**Change 2** — Add `analytics` entry to `queryKeysByInvalidationTag` and extend `practice` and `settings` to also invalidate analytics:

```typescript
const queryKeysByInvalidationTag = {
  analytics: [queryKeys.analytics.all],      // add
  'app-shell': [queryKeys.appShell.all],
  practice: [
    queryKeys.practice.all,
    queryKeys.analytics.all,                 // add — review saves affect analytics
  ],
  problems: [
    queryKeys.problems.all,
    queryKeys.appShell.all,
    queryKeys.practice.all,
    queryKeys.queue.all,
    queryKeys.tracks.all,
  ],
  queue: [queryKeys.queue.all],
  settings: [
    queryKeys.settings.all,
    queryKeys.appShell.all,
    queryKeys.analytics.all,                 // add — dailyGoal change affects streak
    queryKeys.practice.all,
    queryKeys.queue.all,
    queryKeys.tracks.all,
  ],
  sync: [queryKeys.sync.all],
  tracks: [queryKeys.tracks.all, queryKeys.appShell.all],
} satisfies Record<CacheInvalidationTag, readonly QueryKey[]>
```

- [ ] **Step 3: Run existing cache-invalidation tests**

```bash
npx vitest run src/platform/query/cache-invalidation.test.ts
```

Expected: all existing tests PASS (no regressions)

- [ ] **Step 4: Commit**

```bash
git add src/platform/query/query-keys.ts src/platform/query/cache-invalidation.ts
git commit -m "feat(analytics): add analytics query key and cache invalidation wiring"
```

---

## Task 7: Wire into messaging protocol map

**Files:**
- Modify: `src/extension/messaging.ts`

- [ ] **Step 1: Add analytics imports to messaging.ts**

Open `src/extension/messaging.ts`. Add an import block for analytics contracts near the top alongside the other feature contract imports:

```typescript
import type {
  AnalyticsSummaryRequest,
  SerializedAnalyticsSummary,
} from '@/features/analytics/api/analytics-contracts'

export {
  analyticsSummaryRequestSchema,
  analyticsSummarySchema,
} from '@/features/analytics/api/analytics-contracts'
```

- [ ] **Step 2: Add the entry to `ProtocolMap`**

Inside the `ProtocolMap` interface, add the analytics entry. A good place is after `'app.openDashboard'` or alongside other read methods. Add:

```typescript
'analytics.getSummary'(request: AnalyticsSummaryRequest): SerializedAnalyticsSummary
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/extension/messaging.ts
git commit -m "feat(analytics): add analytics.getSummary to extension protocol map"
```

---

## Task 8: Analytics service

**Files:**
- Create: `src/features/analytics/server/analytics-service.ts`

- [ ] **Step 1: Create the service**

```typescript
// src/features/analytics/server/analytics-service.ts
import { getRetrievability, type FsrsCardSnapshot } from '@/lib/fsrs'

import type { Db } from '@/platform/db'

import { getPracticeProgressSummary } from '@/features/practice/server/practice-service'
import { getSettings } from '@/features/settings/server/settings-service'

import {
  getReviewDayStats,
  getRecentRatings,
  getUpcomingCards,
  getWeakProblemCandidates,
} from '../data/analytics-repository'

import {
  buildRetentionProxy,
  buildDueForecast,
  buildWeakProblems,
  buildAnalyticsSummary,
  type AnalyticsSummary,
} from '../domain/summary'

export async function getAnalyticsSummary(
  db: Db,
  now = new Date(),
): Promise<AnalyticsSummary> {
  const thirtyDaysAgo = subtractDays(now, 30)
  const fourteenDaysLater = addDays(now, 14)

  const [dayStats, recentRatings, upcomingCards, weakCandidates, settings] =
    await Promise.all([
      getReviewDayStats(db),
      getRecentRatings(db, thirtyDaysAgo),
      getUpcomingCards(db, fourteenDaysLater),
      getWeakProblemCandidates(db),
      getSettings(db),
    ])

  const practiceProgress = await getPracticeProgressSummary(db, {
    dailyGoal: settings.practice.dailyGoal,
    now,
  })

  const enrichedCandidates = weakCandidates.map((candidate) => ({
    slug: candidate.slug,
    title: candidate.title,
    lapseCount: candidate.lapseCount,
    difficulty: candidate.difficulty,
    retrievability: getRetrievability(
      buildMinimalCard(candidate.stability, candidate.lapseCount, candidate.lastReviewAt),
      now,
    ),
  }))

  const retention = buildRetentionProxy(recentRatings, now)
  const forecast = buildDueForecast(upcomingCards, now)
  const weakProblems = buildWeakProblems(enrichedCandidates)

  return buildAnalyticsSummary({
    generatedAt: now,
    reviewDays: dayStats.reviewDays,
    totalReviews: dayStats.totalReviews,
    currentStreak: practiceProgress.currentStreak,
    retention,
    forecast,
    weakProblems,
  })
}

function buildMinimalCard(
  stability: number,
  lapses: number,
  lastReviewAt: Date | null,
): FsrsCardSnapshot {
  return {
    dueAt: lastReviewAt ?? new Date(0),
    stability,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: lapses,
    lapses,
    state: 'review',
    lastReviewAt,
  }
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/features/analytics/server/analytics-service.ts
git commit -m "feat(analytics): add analytics service"
```

---

## Task 9: Register the handler

**Files:**
- Modify: `src/extension/background/register-handlers.ts`

- [ ] **Step 1: Add imports near the other feature service imports in register-handlers.ts**

Add near the top of the file, alongside existing feature imports:

```typescript
import {
  analyticsSummaryRequestSchema,
  analyticsSummarySchema,
} from '@/extension/messaging'

import { getAnalyticsSummary } from '@/features/analytics/server/analytics-service'
```

- [ ] **Step 2: Register the handler**

Add the handler inside the registration function, alongside the `queue.getTodayQueue` handler:

```typescript
onMessage('analytics.getSummary', ({ data, sender }) => {
  const request = analyticsSummaryRequestSchema.parse(data)

  assertCanSenderCallExtensionMethod(
    'analytics.getSummary',
    'dashboard',
    sender,
  )

  void request

  return getAppDb().then(async ({ db }) =>
    analyticsSummarySchema.parse(await getAnalyticsSummary(db)),
  )
})
```

The `void request` line acknowledges the parsed request (empty object) without unused-variable warnings. Remove it if the linter doesn't flag it.

- [ ] **Step 3: Run register-handlers tests**

```bash
npx vitest run src/extension/background/register-handlers.test.ts
```

Expected: all existing tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/extension/background/register-handlers.ts
git commit -m "feat(analytics): register analytics.getSummary message handler"
```

---

## Task 10: Analytics API hook and barrel exports

**Files:**
- Create: `src/features/analytics/api/analytics-api.ts`
- Create: `src/features/analytics/index.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/features/analytics/api/analytics-api.ts
import { useQuery } from '@tanstack/react-query'

import { sendMessage } from '@/extension/messaging'

import { queryKeys } from '@/platform/query/query-keys'

export const analyticsQueryKeys = queryKeys.analytics

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: analyticsQueryKeys.summary(),
    queryFn: () => sendMessage('analytics.getSummary', {}),
  })
}
```

- [ ] **Step 2: Create the index**

```typescript
// src/features/analytics/index.ts
export { useAnalyticsSummary, analyticsQueryKeys } from './api/analytics-api'

export type {
  AnalyticsSummary,
  WeakProblem,
  ForecastEntry,
} from './domain/summary'
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS, no regressions

- [ ] **Step 5: Commit**

```bash
git add src/features/analytics/api/analytics-api.ts src/features/analytics/index.ts
git commit -m "feat(analytics): add useAnalyticsSummary hook and barrel exports"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ `analytics.getSummary` handler registered
- ✅ Empty request (no `at?`, no `surface`)
- ✅ `generatedAt`, `reviewDays`, `totalReviews`, `currentStreak` in response
- ✅ `retentionProxy` (last 30 days, good+easy positive)
- ✅ `retentionProxyLabel` formatted percentage
- ✅ `retentionSampleSize` + `lowSample` (threshold: 10)
- ✅ `dueForecast14Days` exactly 14 entries, overdue clamped to day 0
- ✅ `weakProblems` top 10, lapses→difficulty→retrievability sort
- ✅ Streak sourced from `buildPracticeProgressSummary` via practice service
- ✅ `memoryProfile` excluded
- ✅ Query keys + cache invalidation wired (practice + settings tags also invalidate analytics)
- ✅ `analytics` tag added to `cacheInvalidationTags`

**Type consistency:** `AnalyticsSummary` from domain matches `SerializedAnalyticsSummary` from contracts — both have `generatedAt: string` (no Date objects crossing the boundary).

**`gt` / `lte` / `ne` / `gte` / `innerJoin`** — all available from `'drizzle-orm'`. If any are missing from the installed version, fall back to `sql` template literals.
