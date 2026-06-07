# Issue #20 — Final Architecture and Test Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add all automated test coverage required by the issue #20 audit checklist — architecture boundary assertions, queue track-independence tests, analytics contract/repository/API tests, and queue API hook tests — plus formally defer the notification E2E alarm-flow with a documented reason.

**Architecture:** Pure test additions in 8 files. No production code changes. All new tests assert invariants already satisfied by the current codebase, so every test should pass on first run.

**Tech Stack:** Vitest, @testing-library/react, Drizzle ORM, in-memory SQLite (via `createTestDb`), Zod schema parsing, `vi.mock` for `sendMessage`.

---

### Task 1: Architecture boundary additions

**Files:**
- Modify: `src/testing/architecture-boundaries.test.ts`

- [ ] **Step 1: Add four new `it()` blocks to the `describe('architecture boundaries')` block**

Open `src/testing/architecture-boundaries.test.ts`. The file already imports `readdirSync`, `readFileSync`, `statSync`, `dirname`, `join`, `relative`, `fileURLToPath`. Add the four new tests **inside** the existing `describe('architecture boundaries', () => {` block, after the last existing `it()`:

```typescript
  it('keeps ts-fsrs package import to src/lib/fsrs only', () => {
    const libFsrsPath = join(srcRoot, 'lib', 'fsrs')
    const offenders = productionSourceFiles()
      .filter((file) => !file.startsWith(libFsrsPath + '/'))
      .filter((file) => {
        const content = readFileSync(file, 'utf8')
        return /from ['"]ts-fsrs['"]/.test(content)
      })

    expect(offenders.map(toRepoPath)).toEqual([])
  })

  it('keeps src/app/dashboard free of @/lib/fsrs imports', () => {
    const offenders = sourceFiles(['app']).filter((file) => {
      if (!file.includes('/dashboard/')) return false
      const content = readFileSync(file, 'utf8')
      return /from ['"]@\/lib\/fsrs/.test(content)
    })

    expect(offenders.map(toRepoPath)).toEqual([])
  })

  it('keeps queue feature free of tracks dependency', () => {
    const offenders = sourceFiles(['features']).filter((file) => {
      if (!file.includes('/features/queue/')) return false
      const content = readFileSync(file, 'utf8')
      return /from ['"]@\/features\/tracks/.test(content)
    })

    expect(offenders.map(toRepoPath)).toEqual([])
  })

  it('keeps settings components free of browser alarm and notification API calls', () => {
    const settingsComponentsPath = join(srcRoot, 'features', 'settings', 'components')
    const offenders = sourceFiles(['features']).filter((file) => {
      if (!file.startsWith(settingsComponentsPath + '/')) return false
      const content = readFileSync(file, 'utf8')
      return /browser\.alarms|chrome\.alarms|browser\.notifications|chrome\.notifications/.test(
        content,
      )
    })

    expect(offenders.map(toRepoPath)).toEqual([])
  })
```

- [ ] **Step 2: Run the boundary tests**

```bash
npm run test -- src/testing/architecture-boundaries.test.ts
```

Expected: all tests in the file pass, including the 4 new ones.

- [ ] **Step 3: Commit**

```bash
git add src/testing/architecture-boundaries.test.ts
git commit -m "test: add architecture boundary assertions for ts-fsrs scope, dashboard, queue-tracks, and settings UI"
```

---

### Task 2: Notification E2E deferral

**Files:**
- Modify: `docs/test-plans/notification-alarm-e2e.md`

- [ ] **Step 1: Add a Status section near the top of the file**

Open `docs/test-plans/notification-alarm-e2e.md`. After the first paragraph (the one ending "Run these steps after `#17` (scheduler) and `#18` (notification preferences) are merged.") and before `## Prerequisites`, insert:

```markdown
## Status

| Step | Result |
|---|---|
| **Option C — direct notification delivery** | ✅ Executed. Service worker console call confirmed Chrome permissions are granted and notifications appear correctly. |
| **Full alarm-flow (Steps 5–10)** | ⏸ Deferred. Steps 5–10 require a Chrome build with at least one FSRS-scheduled problem whose due date has passed. Deferred until a test environment with real due data is available. |

```

- [ ] **Step 2: Commit**

```bash
git add docs/test-plans/notification-alarm-e2e.md
git commit -m "docs: record notification E2E status — option C executed, full alarm-flow deferred"
```

---

### Task 3: Queue track-independence domain assertion

**Files:**
- Modify: `src/features/queue/domain/queue.test.ts`

- [ ] **Step 1: Add a track independence describe block**

Open `src/features/queue/domain/queue.test.ts`. After the closing `})` of the existing `describe('buildTodayQueue', () => {` block (at the end of the file, before the helper functions), add:

```typescript
describe('QueueCandidate track independence', () => {
  it('accepts only problem and practice state — no track membership fields', () => {
    // QueueCandidate is { problem, state } only.
    // Track selection, membership, order, and progress play no role in queue building.
    const c: QueueCandidate = candidate({ slug: 'two-sum' })

    expect(Object.keys(c)).toEqual(['problem', 'state'])
  })
})
```

The `candidate` helper is already defined later in the same file, so this will compile fine.

- [ ] **Step 2: Run the queue domain tests**

```bash
npm run test -- src/features/queue/domain/queue.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/features/queue/domain/queue.test.ts
git commit -m "test: document QueueCandidate has no track membership fields"
```

---

### Task 4: Queue track-independence integration test

**Files:**
- Create: `src/features/queue/queue-track-independence.integration.test.ts`

- [ ] **Step 1: Create the integration test file**

```typescript
import { describe, expect, it } from 'vitest'

import { getTodayQueue } from '@/features/queue/server/queue-service'
import { createTracksRepository } from '@/features/tracks/data/tracks-repository'
import { createTestDb } from '@/platform/db/test-db'

describe('queue track independence', () => {
  it('returns the same queue counts and items regardless of active track state', async () => {
    const handle = await createTestDb()
    const now = new Date('2026-01-01T12:00:00.000Z')

    // The seeded DB has an active track (ByteByteGo) by default.
    const withTrack = await getTodayQueue(handle.db, now)

    // Deactivate the track — simulates a user with no active track selected.
    await createTracksRepository(handle.db).clearActiveTrack(now)

    const withoutTrack = await getTodayQueue(handle.db, now)

    // Queue counts and order must be identical — track state must not influence them.
    expect(withoutTrack.dueCount).toBe(withTrack.dueCount)
    expect(withoutTrack.newCount).toBe(withTrack.newCount)
    expect(withoutTrack.reinforcementCount).toBe(withTrack.reinforcementCount)
    expect(withoutTrack.excludedCount).toBe(withTrack.excludedCount)
    expect(withoutTrack.items.map((i) => i.problemSlug)).toEqual(
      withTrack.items.map((i) => i.problemSlug),
    )
  })
})
```

- [ ] **Step 2: Run the integration test**

```bash
npm run test -- src/features/queue/queue-track-independence.integration.test.ts
```

Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
git add src/features/queue/queue-track-independence.integration.test.ts
git commit -m "test: add queue track-independence integration test"
```

---

### Task 5: Analytics contract tests

**Files:**
- Create: `src/features/analytics/api/analytics-contracts.test.ts`

- [ ] **Step 1: Create the contract test file**

```typescript
import { describe, expect, it } from 'vitest'

import {
  analyticsSummarySchema,
  forecastEntrySchema,
  weakProblemSchema,
} from './analytics-contracts'

const validForecast = Array.from({ length: 14 }, (_, i) => ({
  date: `2026-01-${String(15 + i).padStart(2, '0')}`,
  dueCount: i,
}))

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
}

describe('analyticsSummarySchema', () => {
  it('accepts a valid full summary', () => {
    expect(analyticsSummarySchema.safeParse(validSummary).success).toBe(true)
  })

  it('rejects a forecast with fewer than 14 entries', () => {
    const result = analyticsSummarySchema.safeParse({
      ...validSummary,
      dueForecast14Days: validForecast.slice(0, 13),
    })
    expect(result.success).toBe(false)
  })

  it('rejects a forecast with more than 14 entries', () => {
    const result = analyticsSummarySchema.safeParse({
      ...validSummary,
      dueForecast14Days: [
        ...validForecast,
        { date: '2026-01-29', dueCount: 0 },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than 10 weak problems', () => {
    const tooMany = Array.from({ length: 11 }, (_, i) => ({
      slug: `problem-${i}`,
      title: `Problem ${i}`,
      lapseCount: 1,
      difficulty: 5,
      retrievability: 0.8,
    }))
    expect(
      analyticsSummarySchema.safeParse({ ...validSummary, weakProblems: tooMany }).success,
    ).toBe(false)
  })

  it('rejects negative integer counts', () => {
    expect(
      analyticsSummarySchema.safeParse({ ...validSummary, reviewDays: -1 }).success,
    ).toBe(false)
    expect(
      analyticsSummarySchema.safeParse({ ...validSummary, totalReviews: -1 }).success,
    ).toBe(false)
    expect(
      analyticsSummarySchema.safeParse({ ...validSummary, currentStreak: -1 }).success,
    ).toBe(false)
    expect(
      analyticsSummarySchema.safeParse({ ...validSummary, retentionSampleSize: -1 }).success,
    ).toBe(false)
  })
})

describe('forecastEntrySchema', () => {
  it('accepts a valid forecast entry', () => {
    expect(
      forecastEntrySchema.safeParse({ date: '2026-01-15', dueCount: 3 }).success,
    ).toBe(true)
  })

  it('rejects a negative dueCount', () => {
    expect(
      forecastEntrySchema.safeParse({ date: '2026-01-15', dueCount: -1 }).success,
    ).toBe(false)
  })

  it('rejects a missing date', () => {
    expect(forecastEntrySchema.safeParse({ dueCount: 3 }).success).toBe(false)
  })
})

describe('weakProblemSchema', () => {
  it('accepts a valid weak problem', () => {
    expect(
      weakProblemSchema.safeParse({
        slug: 'two-sum',
        title: 'Two Sum',
        lapseCount: 3,
        difficulty: 7.5,
        retrievability: 0.4,
      }).success,
    ).toBe(true)
  })

  it('rejects a negative lapseCount', () => {
    expect(
      weakProblemSchema.safeParse({
        slug: 'two-sum',
        title: 'Two Sum',
        lapseCount: -1,
        difficulty: 7.5,
        retrievability: 0.4,
      }).success,
    ).toBe(false)
  })

  it('rejects a missing slug', () => {
    expect(
      weakProblemSchema.safeParse({
        title: 'Two Sum',
        lapseCount: 3,
        difficulty: 7.5,
        retrievability: 0.4,
      }).success,
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run the contract tests**

```bash
npm run test -- src/features/analytics/api/analytics-contracts.test.ts
```

Expected: all 11 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/features/analytics/api/analytics-contracts.test.ts
git commit -m "test: add analytics contract schema validation tests"
```

---

### Task 6: Analytics repository integration tests

**Files:**
- Create: `src/features/analytics/data/analytics-repository.test.ts`

- [ ] **Step 1: Create the integration test file**

The seeded DB contains problems including `'two-sum'` and `'valid-parentheses'`. All direct inserts must respect FK constraints:
- `fsrsCards.problemSlug` → `problems.slug` (seeded)
- `reviewAttempts.cardId` → `fsrsCards.id` (insert card first)
- `reviewAttempts.problemSlug` → `problems.slug` (seeded)
- `problemPractice.problemSlug` → `problems.slug` (seeded)

```typescript
import { describe, expect, it } from 'vitest'

import type { Db } from '@/platform/db'
import { createTestDb } from '@/platform/db/test-db'
import { fsrsCards, problemPractice, reviewAttempts } from '@/platform/db/schema'

import {
  getReviewDayStats,
  getRecentRatings,
  getUpcomingCards,
  getWeakProblemCandidates,
} from './analytics-repository'

const BASE_TS = new Date('2026-01-15T12:00:00.000Z').getTime()
const ts = (d: Date) => d.getTime()

async function insertCard(
  db: Db,
  slug: string,
  opts: {
    id?: string
    dueAt?: number
    lapses?: number
    difficulty?: number
    stability?: number
  } = {},
) {
  const id = opts.id ?? `${slug}:default`
  await db.insert(fsrsCards).values({
    id,
    problemSlug: slug,
    cardKind: 'default',
    dueAt: opts.dueAt ?? BASE_TS,
    stability: opts.stability ?? 10,
    difficulty: opts.difficulty ?? 5,
    elapsedDays: 7,
    scheduledDays: 7,
    learningSteps: 0,
    reps: 1,
    lapses: opts.lapses ?? 0,
    state: 'review',
    lastReviewAt: BASE_TS,
    createdAt: BASE_TS,
    updatedAt: BASE_TS,
  })
  return id
}

async function insertPractice(
  db: Db,
  slug: string,
  opts: { isSuspended?: boolean; status?: string } = {},
) {
  await db.insert(problemPractice).values({
    problemSlug: slug,
    status: opts.status ?? 'review',
    firstSeenAt: BASE_TS,
    lastSeenAt: BASE_TS,
    lastReviewedAt: BASE_TS,
    isSuspended: opts.isSuspended ?? false,
    createdAt: BASE_TS,
    updatedAt: BASE_TS,
  })
}

async function insertAttempt(
  db: Db,
  id: string,
  slug: string,
  cardId: string,
  rating: string,
  reviewedAt: Date,
) {
  await db.insert(reviewAttempts).values({
    id,
    problemSlug: slug,
    cardId,
    rating,
    reviewMode: 'standard',
    reviewedAt: ts(reviewedAt),
    createdAt: ts(reviewedAt),
    updatedAt: ts(reviewedAt),
  })
}

// ---------------------------------------------------------------------------

describe('getReviewDayStats', () => {
  it('returns zeros when no attempts exist', async () => {
    const { db } = await createTestDb()
    const result = await getReviewDayStats(db)
    expect(result.totalReviews).toBe(0)
    expect(result.reviewDays).toBe(0)
  })

  it('counts total reviews and distinct review days', async () => {
    const { db } = await createTestDb()
    const day1 = new Date('2026-01-10T09:00:00.000Z')
    const day2 = new Date('2026-01-11T09:00:00.000Z')

    const cardId = await insertCard(db, 'two-sum')
    await insertAttempt(db, 'a1', 'two-sum', cardId, 'good', day1)
    await insertAttempt(db, 'a2', 'two-sum', cardId, 'good', day1)
    await insertAttempt(db, 'a3', 'two-sum', cardId, 'again', day2)

    const result = await getReviewDayStats(db)
    expect(result.totalReviews).toBe(3)
    expect(result.reviewDays).toBe(2)
  })
})

// ---------------------------------------------------------------------------

describe('getRecentRatings', () => {
  it('returns empty when no attempts exist', async () => {
    const { db } = await createTestDb()
    const since = new Date('2026-01-01T00:00:00.000Z')
    const result = await getRecentRatings(db, since)
    expect(result).toEqual([])
  })

  it('includes attempts at or after the since cutoff and excludes earlier ones', async () => {
    const { db } = await createTestDb()
    const since = new Date('2026-01-10T00:00:00.000Z')
    const before = new Date('2026-01-09T23:59:59.999Z')
    const exactly = new Date('2026-01-10T00:00:00.000Z')
    const after = new Date('2026-01-11T09:00:00.000Z')

    const cardId = await insertCard(db, 'two-sum')
    await insertAttempt(db, 'a1', 'two-sum', cardId, 'hard', before)
    await insertAttempt(db, 'a2', 'two-sum', cardId, 'good', exactly)
    await insertAttempt(db, 'a3', 'two-sum', cardId, 'easy', after)

    const result = await getRecentRatings(db, since)
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.rating)).toEqual(
      expect.arrayContaining(['good', 'easy']),
    )
  })

  it('returns correct rating and reviewedAt values', async () => {
    const { db } = await createTestDb()
    const reviewedAt = new Date('2026-01-12T08:00:00.000Z')
    const since = new Date('2026-01-01T00:00:00.000Z')

    const cardId = await insertCard(db, 'two-sum')
    await insertAttempt(db, 'a1', 'two-sum', cardId, 'again', reviewedAt)

    const [item] = await getRecentRatings(db, since)
    expect(item?.rating).toBe('again')
    expect(item?.reviewedAt.getTime()).toBe(reviewedAt.getTime())
  })
})

// ---------------------------------------------------------------------------

describe('getUpcomingCards', () => {
  it('returns empty when no cards exist', async () => {
    const { db } = await createTestDb()
    const until = new Date('2026-02-01T00:00:00.000Z')
    const result = await getUpcomingCards(db, until)
    expect(result).toEqual([])
  })

  it('includes cards due on or before until and excludes cards due after', async () => {
    const { db } = await createTestDb()
    const until = new Date('2026-01-20T00:00:00.000Z')
    const before = new Date('2026-01-15T00:00:00.000Z')
    const exactly = new Date('2026-01-20T00:00:00.000Z')
    const after = new Date('2026-01-21T00:00:00.000Z')

    await insertPractice(db, 'two-sum')
    await insertPractice(db, 'valid-parentheses')

    await insertCard(db, 'two-sum', { dueAt: ts(before) })
    await insertCard(db, 'valid-parentheses', { dueAt: ts(after) })

    const result = await getUpcomingCards(db, exactly)
    expect(result).toHaveLength(1)
    expect(result[0]?.dueAt.getTime()).toBe(ts(before))
  })

  it('excludes cards belonging to suspended problems', async () => {
    const { db } = await createTestDb()
    const until = new Date('2026-01-20T00:00:00.000Z')
    const due = new Date('2026-01-15T00:00:00.000Z')

    await insertPractice(db, 'two-sum', { isSuspended: true })
    await insertCard(db, 'two-sum', { dueAt: ts(due) })

    const result = await getUpcomingCards(db, until)
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------

describe('getWeakProblemCandidates', () => {
  it('returns empty when no reviewed problems exist', async () => {
    const { db } = await createTestDb()
    const result = await getWeakProblemCandidates(db)
    expect(result).toEqual([])
  })

  it('excludes problems with zero lapses', async () => {
    const { db } = await createTestDb()
    await insertPractice(db, 'two-sum')
    await insertCard(db, 'two-sum', { lapses: 0 })

    const result = await getWeakProblemCandidates(db)
    expect(result).toEqual([])
  })

  it('excludes suspended problems', async () => {
    const { db } = await createTestDb()
    await insertPractice(db, 'two-sum', { isSuspended: true })
    await insertCard(db, 'two-sum', { lapses: 3 })

    const result = await getWeakProblemCandidates(db)
    expect(result).toEqual([])
  })

  it('returns slug, title, lapseCount, difficulty, stability, lastReviewAt for a weak problem', async () => {
    const { db } = await createTestDb()
    await insertPractice(db, 'two-sum')
    await insertCard(db, 'two-sum', { lapses: 2, difficulty: 6.5, stability: 3.0 })

    const result = await getWeakProblemCandidates(db)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      slug: 'two-sum',
      title: 'Two Sum',
      lapseCount: 2,
      difficulty: 6.5,
      stability: 3.0,
    })
    expect(result[0]?.lastReviewAt?.getTime()).toBe(BASE_TS)
  })

  it('orders by lapses DESC then difficulty DESC', async () => {
    const { db } = await createTestDb()
    await insertPractice(db, 'two-sum')
    await insertPractice(db, 'valid-parentheses')
    await insertCard(db, 'two-sum', { lapses: 1, difficulty: 8 })
    await insertCard(db, 'valid-parentheses', { lapses: 3, difficulty: 4 })

    const result = await getWeakProblemCandidates(db)
    expect(result.map((r) => r.slug)).toEqual(['valid-parentheses', 'two-sum'])
  })
})
```

- [ ] **Step 2: Run the repository integration tests**

```bash
npm run test -- src/features/analytics/data/analytics-repository.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/features/analytics/data/analytics-repository.test.ts
git commit -m "test: add analytics repository integration tests with in-memory SQLite"
```

---

### Task 7: Analytics API hook test

**Files:**
- Create: `src/features/analytics/api/analytics-api.test.tsx`

- [ ] **Step 1: Create the analytics API hook test file**

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { analyticsQueryKeys, useAnalyticsSummary } from './analytics-api'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('analytics runtime API', () => {
  it('uses the correct analytics summary query key', () => {
    expect(analyticsQueryKeys.summary()).toEqual(['analytics', 'summary'])
  })

  it('calls sendMessage with analytics.getSummary and an empty request', async () => {
    const payload = { generatedAt: '2026-01-15T12:00:00.000Z', reviewDays: 5 }
    vi.mocked(sendMessage).mockResolvedValueOnce(payload)

    const { wrapper } = createQueryTestHarness()
    const { result } = renderHook(() => useAnalyticsSummary(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(sendMessage).toHaveBeenCalledWith('analytics.getSummary', {})
    expect(result.current.data).toBe(payload)
  })
})
```

- [ ] **Step 2: Run the analytics API tests**

```bash
npm run test -- src/features/analytics/api/analytics-api.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/features/analytics/api/analytics-api.test.tsx
git commit -m "test: add analytics API hook test"
```

---

### Task 8: Queue API hook test

**Files:**
- Create: `src/features/queue/api/queue-api.test.ts`

- [ ] **Step 1: Create the queue API hook test file**

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { queueQueryKeys, useTodayQueue } from './queue-api'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('queue runtime API', () => {
  it('today key uses "now" when at is omitted or null', () => {
    expect(queueQueryKeys.today()).toEqual(['today-queue', 'now'])
    expect(queueQueryKeys.today(null)).toEqual(['today-queue', 'now'])
  })

  it('today key includes the at string when provided', () => {
    expect(queueQueryKeys.today('2026-01-15T12:00:00.000Z')).toEqual([
      'today-queue',
      '2026-01-15T12:00:00.000Z',
    ])
  })

  it('calls sendMessage with queue.getTodayQueue and the full request', async () => {
    const payload = { dueCount: 3, newCount: 1, items: [] }
    vi.mocked(sendMessage).mockResolvedValueOnce(payload)

    const request = { surface: 'popup' as const }
    const { wrapper } = createQueryTestHarness()
    const { result } = renderHook(() => useTodayQueue(request), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(sendMessage).toHaveBeenCalledWith('queue.getTodayQueue', request)
    expect(result.current.data).toBe(payload)
  })

  it('forwards the optional at parameter in the request', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce({})
    const at = '2026-01-15T12:00:00.000Z'
    const request = { surface: 'popup' as const, at }
    const { wrapper } = createQueryTestHarness()
    const { result } = renderHook(() => useTodayQueue(request), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(sendMessage).toHaveBeenCalledWith('queue.getTodayQueue', { surface: 'popup', at })
  })
})
```

- [ ] **Step 2: Run the queue API tests**

```bash
npm run test -- src/features/queue/api/queue-api.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/features/queue/api/queue-api.test.ts
git commit -m "test: add queue API hook test"
```

---

### Task 9: Full verification

- [ ] **Step 1: Run the full audit test command from issue #20**

```bash
npm run test -- src/lib/fsrs src/features/practice src/features/queue src/features/analytics src/features/notifications src/features/settings src/platform/query src/extension src/app
```

Expected: all test files pass, count higher than before this branch began (new tests added).

- [ ] **Step 2: Run the full check**

```bash
npm run check
```

Expected: all 120+ test files pass, typecheck clean, lint clean.

- [ ] **Step 3: Run the build**

```bash
npm run build
```

Expected: clean build, no errors.

- [ ] **Step 4: Final commit if any stray changes**

If any files are unstaged after the above, commit them. Otherwise skip.

---

## Self-Review

**Spec coverage:**
- ✅ `ts-fsrs` scope boundary → Task 1
- ✅ Dashboard free of `@/lib/fsrs` → Task 1
- ✅ Queue free of tracks dependency → Task 1
- ✅ Settings UI alarm/notification API boundary → Task 1
- ✅ Queue track-independence domain → Task 3
- ✅ Queue track-independence integration → Task 4
- ✅ Analytics contract tests → Task 5
- ✅ Analytics repository tests (in-memory SQLite) → Task 6
- ✅ Analytics API hook test → Task 7
- ✅ Queue API hook test → Task 8
- ✅ Notification E2E deferral → Task 2
- ✅ Full test + check + build → Task 9

**Placeholder scan:** None. All test bodies contain complete, runnable code.

**Type consistency:**
- `insertCard`, `insertPractice`, `insertAttempt` helpers are defined once at the top of Task 6 and used throughout that task only.
- `createQueryTestHarness` is imported from `@/testing/query-test-harness` — this file exists.
- `queueQueryKeys` is exported from `queue-api.ts` as `queryKeys.queue` — confirmed.
- `analyticsQueryKeys` is exported from `analytics-api.ts` as `queryKeys.analytics` — confirmed.
- `clearActiveTrack` exists on the object returned by `createTracksRepository` — confirmed at line 203 of `tracks-repository.ts`.
