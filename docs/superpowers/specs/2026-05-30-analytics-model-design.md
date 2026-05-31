# Analytics Model Design — Issue #14

**Date:** 2026-05-30  
**Issue:** [#14 — Build Analytics backend read model and `analytics.getSummary`](https://github.com/Hollowvyn/cognipace-v2/issues/14)  
**Depends on:** Issue #11 (FSRS contracts), Issue #13 (shared summary contracts)  
**Unblocks:** Issues #15, #16, #20

---

## Goal

Establish a dedicated `analytics` feature that evaluates study system performance over time. Analytics owns its own domain, repository, service, and API layers. It does not extend Dashboard, duplicate Queue logic, or read cloud data.

Streak computation moves from app-shell into analytics — analytics becomes the source of truth for streak.

---

## API Contract

### Method
`analytics.getSummary`

### Request
Empty object — no parameters.

```typescript
const analyticsSummaryRequestSchema = z.object({})
type AnalyticsSummaryRequest = z.infer<typeof analyticsSummaryRequestSchema>
```

`at?` is dropped — the service uses `new Date()` internally, injectable for tests via the service signature.  
`surface` is dropped — analytics is dashboard-only.

### Response

```typescript
const weakProblemSchema = z.object({
  slug:           z.string(),
  title:          z.string(),
  lapseCount:     z.number().int().nonnegative(),
  difficulty:     z.number(),       // 0–1 FSRS scale
  retrievability: z.number(),       // 0–1, computed at call time
})

const forecastEntrySchema = z.object({
  date:     z.string(),             // "YYYY-MM-DD" local date
  dueCount: z.number().int().nonnegative(),
})

const analyticsSummarySchema = z.object({
  generatedAt:         z.string(),  // ISO timestamp
  reviewDays:          z.number().int().nonnegative(),
  totalReviews:        z.number().int().nonnegative(),
  currentStreak:       z.number().int().nonnegative(),
  retentionProxy:      z.number(),  // 0–1; 0 when lowSample
  retentionProxyLabel: z.string(),  // formatted percentage e.g. "72%"; "—" when lowSample
  retentionSampleSize: z.number().int().nonnegative(),
  lowSample:           z.boolean(),
  dueForecast14Days:   z.array(forecastEntrySchema).length(14),
  weakProblems:        z.array(weakProblemSchema).max(10),
})

type AnalyticsSummary = z.infer<typeof analyticsSummarySchema>
```

`memoryProfile` is out of scope for this issue.

---

## File Structure

```
src/features/analytics/
├── api/
│   └── analytics-api.ts          # useAnalyticsSummary() hook
├── data/
│   └── analytics-repository.ts  # 4 focused DB queries
├── domain/
│   ├── summary.ts                # pure domain functions
│   └── summary.test.ts           # unit tests
├── server/
│   └── analytics-service.ts     # orchestrates repo + domain + practice-progress
└── index.ts                      # public exports
```

Files outside the feature that change:
- `src/platform/query/query-keys.ts` — add `analytics.summary()` key
- Extension messaging registration — register `analytics.getSummary` handler
- `cache-invalidation.ts` — map review-saved tag → `analyticsQueryKeys.all`

---

## Domain Layer

**`summary.ts`** — four pure functions, no DB dependency.

### `buildRetentionProxy(attempts, now)`
- Input: `Array<{ rating: ReviewRating; reviewedAt: Date }>`, `now: Date`
- Filters to ratings where `reviewedAt >= subDays(now, 30)`
- Formula: `(good + easy) / total`
- `lowSample: true` when `retentionSampleSize < 10`
- When `lowSample`: `retentionProxy = 0`, `retentionProxyLabel = "—"`
- Otherwise: `retentionProxyLabel = "${Math.round(value * 100)}%"`
- Returns `{ value, label, sampleSize, lowSample }`

### `buildDueForecast(cards, now)`
- Input: `Array<{ dueAt: Date }>`, `now: Date`
- Buckets each card into its local `YYYY-MM-DD` date
- Cards due before today are clamped to day 0
- Returns exactly 14 entries: day 0 (today) through day 13
- Days with no due cards get `dueCount: 0`

### `buildWeakProblems(candidates)`
- Input: `Array<{ slug, title, lapseCount, difficulty, retrievability }>` (retrievability pre-computed by service)
- Sort: lapses DESC → difficulty DESC → retrievability ASC
- Returns top 10

### `buildAnalyticsSummary(input)`
- Thin assembler — combines outputs of the three functions above with `reviewDays`, `totalReviews`, `currentStreak`, `generatedAt`
- No logic of its own

### Tests (`summary.test.ts`)
Follow the builder-helper pattern from `queue.test.ts`. Cover:
- Day counting and retention across the 30-day boundary
- Forecast: zero-fill days, today-clamping for overdue cards, exactly 14 entries
- Weak problem ranking: tie-breaking by difficulty then retrievability
- `lowSample` threshold at 9 and 10 ratings
- Suspended problem exclusion

---

## Repository Layer

**`analytics-repository.ts`** — four focused queries, each with one job.

### `getReviewDayStats(db)`
- Queries `reviewAttempts`
- Returns `{ totalReviews: number, reviewDays: number }`
- `totalReviews` = `COUNT(*)`
- `reviewDays` = `COUNT(DISTINCT date-key)` where date-key is `reviewedAt` cast to `YYYY-MM-DD` local time (same derivation as `toPracticeDateKey` in practice-progress)

### `getRecentRatings(db, since: Date)`
- Queries `reviewAttempts WHERE reviewedAt >= since`
- Returns `Array<{ rating: string, reviewedAt: Date }>`
- Service passes `subDays(now, 30)` as `since`

### `getUpcomingCards(db, until: Date)`
- Queries `fsrsCards WHERE dueAt <= until AND cardKind = 'default'`
- Joins `problemPractice` to exclude suspended problems
- Returns `Array<{ dueAt: Date }>`
- Service passes `addDays(now, 14)` as `until`

### `getWeakProblemCandidates(db)`
- Joins `problems + fsrsCards + problemPractice`
- Filters: started, non-suspended, `lapses > 0`
- Returns `Array<{ slug, title, lapseCount, difficulty, stability, lastReviewAt }>`
- Retrievability is computed in the service (needs `now`), not in SQL

---

## Service Layer

**`analytics-service.ts`**

```
getSummary(db, now = new Date()):
  1. [parallel]
       getReviewDayStats(db)
       getRecentRatings(db, subDays(now, 30))
       getUpcomingCards(db, addDays(now, 14))
       getWeakProblemCandidates(db)
       getSettings(db)
  2. [sequential — needs settings.dailyGoal]
       getPracticeProgressSummary(db)
       → buildPracticeProgressSummary(allAttempts, dailyGoal, now)
       → extract currentStreak
  3. Enrich weak candidates:
       map each → getRetrievability(stability, lastReviewAt, now)
  4. Build domain objects:
       buildRetentionProxy(recentRatings, now)
       buildDueForecast(upcomingCards, now)
       buildWeakProblems(enrichedCandidates)
  5. Assemble + serialize AnalyticsSummary
```

`getPracticeProgressSummary` is called from `src/features/practice/server/practice-progress-service.ts` — the same cross-feature call app-shell-service makes today. No duplication, no circular dependency.

---

## API Layer

**`analytics-api.ts`**

```typescript
export const analyticsQueryKeys = queryKeys.analytics

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: analyticsQueryKeys.summary(),
    queryFn: () => sendMessage('analytics.getSummary', {}),
  })
}
```

**`query-keys.ts` addition:**

```typescript
analytics: {
  all: ['analytics'] as const,
  summary: () => [...queryKeys.analytics.all, 'summary'] as const,
}
```

**Cache invalidation:** review-saved event → invalidate `analyticsQueryKeys.all`. Added alongside the existing queue and practice invalidation entries in `cache-invalidation.ts`.

**`index.ts` exports:**

```typescript
export { useAnalyticsSummary, analyticsQueryKeys } from './api/analytics-api'
export type { AnalyticsSummary, WeakProblem } from './domain/summary'
```

---

## What Is Explicitly Out of Scope

- `memoryProfile` — dropped for this issue
- Cloud data reads
- Dashboard importing analytics directly (analytics exposes a hook; dashboard consumes it)
- Backup / reset functionality
- Any Queue duplication (weak problems ranking is separate from queue ordering)
