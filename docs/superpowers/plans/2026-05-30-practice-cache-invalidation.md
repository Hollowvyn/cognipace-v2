# Practice Cache Invalidation Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the `practice` and `settings` invalidation tags to cover all affected read models, eliminate the redundant `practiceTrackInvalidationTags` constant, and remove incomplete client-side `onSuccess` invalidation from two React hooks.

**Architecture:** Three targeted changes in dependency order: (1) expand tag mappings in `cache-invalidation.ts` — the single source of truth; (2) simplify all five practice mutation broadcasts in `register-handlers.ts` to use the single `['practice']` tag; (3) remove the `onSuccess` handlers and unused imports from `practice-api.ts`. Each task is independently committable and leaves the app in a working state.

**Tech Stack:** TypeScript, TanStack Query v5, Vitest, WXT (browser extension framework)

---

## File Map

| File | Change |
|---|---|
| `src/platform/query/cache-invalidation.ts` | Expand `practice` (2 → 6 keys) and `settings` (6 → 7 keys) tag entries |
| `src/platform/query/cache-invalidation.test.ts` | Update snapshots for `practice`, `settings`, deduplication; add focused `practice` coverage test |
| `src/extension/background/register-handlers.ts` | Delete `practiceTrackInvalidationTags`; simplify all 5 practice handlers + `broadcastPracticeInvalidation` |
| `src/features/practice/api/practice-api.ts` | Remove `onSuccess` + `useQueryClient` from `useSetPracticeSuspended` and `useResetPracticeSchedule`; remove unused imports |
| `src/features/practice/api/practice-api.test.tsx` | Replace the `onSuccess`-asserting test with a no-client-invalidation assertion |

---

## Task 1: Expand tag mappings in `cache-invalidation.ts`

**Files:**
- Modify: `src/platform/query/cache-invalidation.ts:18-43`
- Modify: `src/platform/query/cache-invalidation.test.ts`

- [ ] **Step 1: Update the test assertions to reflect the expanded mappings**

In `src/platform/query/cache-invalidation.test.ts`, make these three changes:

**(a)** In the `'maps feature tags to every mounted query family they can affect'` test, replace the `practice` assertion:

```ts
// FROM:
expect(readQueryKeysForInvalidation(['practice'])).toEqual([
  ['practice-details'],
  ['analytics'],
])

// TO:
expect(readQueryKeysForInvalidation(['practice'])).toEqual([
  ['practice-details'],
  ['analytics'],
  ['today-queue'],
  ['tracks'],
  ['problems'],
  ['app-shell-data'],
])
```

**(b)** In the same test, replace the `settings` assertion:

```ts
// FROM:
expect(readQueryKeysForInvalidation(['settings'])).toEqual([
  ['settings'],
  ['app-shell-data'],
  ['analytics'],
  ['practice-details'],
  ['today-queue'],
  ['tracks'],
])

// TO:
expect(readQueryKeysForInvalidation(['settings'])).toEqual([
  ['settings'],
  ['app-shell-data'],
  ['analytics'],
  ['practice-details'],
  ['today-queue'],
  ['tracks'],
  ['problems'],
])
```

**(c)** In the `'deduplicates query families when multiple tags overlap'` test, replace the assertion:

```ts
// FROM:
expect(
  readQueryKeysForInvalidation(['settings', 'practice', 'queue']),
).toEqual([
  ['settings'],
  ['app-shell-data'],
  ['analytics'],
  ['practice-details'],
  ['today-queue'],
  ['tracks'],
])

// TO:
expect(
  readQueryKeysForInvalidation(['settings', 'practice', 'queue']),
).toEqual([
  ['settings'],
  ['app-shell-data'],
  ['analytics'],
  ['practice-details'],
  ['today-queue'],
  ['tracks'],
  ['problems'],
])
```

**(d)** Add a new focused test after the existing three `it` blocks:

```ts
it('practice tag alone covers every practice-derived read model', () => {
  expect(readQueryKeysForInvalidation(['practice'])).toEqual([
    ['practice-details'],
    ['analytics'],
    ['today-queue'],
    ['tracks'],
    ['problems'],
    ['app-shell-data'],
  ])
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd /Users/nidsounds/Documents/GitHub/cognipace-v2
npx vitest run src/platform/query/cache-invalidation.test.ts --reporter=verbose
```

Expected: FAIL — `practice` assertion fails (missing `today-queue`, `tracks`, `problems`, `app-shell-data`); `settings` assertion fails (missing `problems`); deduplication assertion fails (missing `problems`); new focused test fails.

- [ ] **Step 3: Expand the `practice` entry in `cache-invalidation.ts`**

In `src/platform/query/cache-invalidation.ts`, replace the `practice` entry (lines 21–24):

```ts
// FROM:
practice: [
  queryKeys.practice.all,
  queryKeys.analytics.all,
],

// TO:
practice: [
  queryKeys.practice.all,
  queryKeys.analytics.all,
  queryKeys.queue.all,
  queryKeys.tracks.all,
  queryKeys.problems.all,
  queryKeys.appShell.all,
],
```

- [ ] **Step 4: Expand the `settings` entry in `cache-invalidation.ts`**

In the same file, replace the `settings` entry (lines 33–40):

```ts
// FROM:
settings: [
  queryKeys.settings.all,
  queryKeys.appShell.all,
  queryKeys.analytics.all,
  queryKeys.practice.all,
  queryKeys.queue.all,
  queryKeys.tracks.all,
],

// TO:
settings: [
  queryKeys.settings.all,
  queryKeys.appShell.all,
  queryKeys.analytics.all,
  queryKeys.practice.all,
  queryKeys.queue.all,
  queryKeys.tracks.all,
  queryKeys.problems.all,
],
```

- [ ] **Step 5: Run the tests to confirm they pass**

```bash
npx vitest run src/platform/query/cache-invalidation.test.ts --reporter=verbose
```

Expected: All 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/platform/query/cache-invalidation.ts src/platform/query/cache-invalidation.test.ts
git commit -m "feat(cache): expand practice and settings invalidation tags to cover all read models"
```

---

## Task 2: Simplify practice mutation broadcasts in `register-handlers.ts`

**Files:**
- Modify: `src/extension/background/register-handlers.ts`

All five practice mutation handlers currently pass either `practiceTrackInvalidationTags` or a narrower ad-hoc tag array to `broadcastPracticeInvalidation`. After Task 1, the `practice` tag alone covers everything, so callers pass nothing — the function hardcodes `['practice']`.

- [ ] **Step 1: Update all five practice mutation handlers to drop the `tags` argument**

In `onMessage('practice.saveReviewResult', ...)` (around line 668), change:

```ts
// FROM:
() =>
  broadcastPracticeInvalidation({
    problemSlug: request.problemSlug,
    source: request.surface,
    tags: practiceTrackInvalidationTags,
  }),

// TO:
() =>
  broadcastPracticeInvalidation({
    problemSlug: request.problemSlug,
    source: request.surface,
  }),
```

In `onMessage('practice.overrideLastReviewResult', ...)` (around line 706):

```ts
// FROM:
() =>
  broadcastPracticeInvalidation({
    problemSlug: request.problemSlug,
    source: request.surface,
    tags: practiceTrackInvalidationTags,
  }),

// TO:
() =>
  broadcastPracticeInvalidation({
    problemSlug: request.problemSlug,
    source: request.surface,
  }),
```

In `onMessage('practice.setSuspended', ...)` (around line 733):

```ts
// FROM:
() =>
  broadcastPracticeInvalidation({
    problemSlug: request.problemSlug,
    source: request.surface,
    tags: practiceTrackInvalidationTags,
  }),

// TO:
() =>
  broadcastPracticeInvalidation({
    problemSlug: request.problemSlug,
    source: request.surface,
  }),
```

In `onMessage('practice.resetSchedule', ...)` (around line 758):

```ts
// FROM:
() =>
  broadcastPracticeInvalidation({
    problemSlug: request.problemSlug,
    source: request.surface,
    tags: practiceTrackInvalidationTags,
  }),

// TO:
() =>
  broadcastPracticeInvalidation({
    problemSlug: request.problemSlug,
    source: request.surface,
  }),
```

In `onMessage('practice.updateCurrentLog', ...)` (around line 787) — this one was using a narrower ad-hoc array, not the constant:

```ts
// FROM:
() =>
  broadcastPracticeInvalidation({
    problemSlug: request.problemSlug,
    source: request.surface,
    tags: ['practice', 'problems', 'app-shell'],
  }),

// TO:
() =>
  broadcastPracticeInvalidation({
    problemSlug: request.problemSlug,
    source: request.surface,
  }),
```

- [ ] **Step 2: Delete the `practiceTrackInvalidationTags` constant**

Remove lines 144–151 (the constant declaration):

```ts
// DELETE entirely:
const practiceTrackInvalidationTags = [
  'practice',
  'problems',
  'queue',
  'app-shell',
  'tracks',
] as const
```

- [ ] **Step 3: Simplify `broadcastPracticeInvalidation` to remove the optional `tags` parameter**

Replace the function (around line 1301):

```ts
// FROM:
function broadcastPracticeInvalidation(input: {
  problemSlug: string
  source: UiSurface
  tags?: Parameters<typeof broadcastCacheInvalidation>[0]['tags']
}) {
  return broadcastCacheInvalidation({
    problemSlug: input.problemSlug,
    reason: 'practice-updated',
    source: input.source,
    tags: input.tags ?? ['practice', 'problems', 'queue', 'app-shell'],
  })
}

// TO:
function broadcastPracticeInvalidation(input: {
  problemSlug: string
  source: UiSurface
}) {
  return broadcastCacheInvalidation({
    problemSlug: input.problemSlug,
    reason: 'practice-updated',
    source: input.source,
    tags: ['practice'],
  })
}
```

- [ ] **Step 4: Run the full test suite**

```bash
npx vitest run --reporter=verbose
```

Expected: All tests PASS. (The register-handlers integration tests at lines 1345 and 1373 assert track invalidation after practice workflows — these remain satisfied because `['practice']` now includes tracks.)

- [ ] **Step 5: Commit**

```bash
git add src/extension/background/register-handlers.ts
git commit -m "refactor(practice): collapse practiceTrackInvalidationTags into the expanded practice tag"
```

---

## Task 3: Remove component-level invalidation from `practice-api.ts`

**Files:**
- Modify: `src/features/practice/api/practice-api.ts`
- Modify: `src/features/practice/api/practice-api.test.tsx`

`useSetPracticeSuspended` and `useResetPracticeSchedule` currently call `invalidateTaggedQueries` in `onSuccess`. This is client-side query knowledge that the background broadcast already handles. The existing test at line 65 of `practice-api.test.tsx` asserts this invalidation happens — that test needs to be replaced with an assertion that client-side invalidation does NOT occur (matching the pattern already established by `useSaveReviewResult`'s test at line 41).

- [ ] **Step 1: Replace the `onSuccess`-asserting test in `practice-api.test.tsx`**

Replace the entire test at line 65 (`'invalidates practice-backed queries after suspend and reset writes'`) and its helper `expectPracticeMutation` (lines 90–120):

```ts
// REPLACE the test at line 65:
it('sends suspend and reset mutations through the runtime boundary without client-side invalidation', async () => {
  await expectNoClientInvalidation({
    method: 'practice.setSuspended',
    request: { surface: 'dashboard', problemSlug: 'two-sum', suspended: true },
    useHook: useSetPracticeSuspended,
  })
  await expectNoClientInvalidation({
    method: 'practice.resetSchedule',
    request: { surface: 'dashboard', problemSlug: 'two-sum' },
    useHook: useResetPracticeSchedule,
  })
})
```

Replace the `expectPracticeMutation` helper (lines 90–120) with `expectNoClientInvalidation`:

```ts
async function expectNoClientInvalidation<TRequest>(input: {
  method: string
  request: TRequest
  useHook: () => { mutateAsync: (request: TRequest) => Promise<unknown> }
}) {
  vi.clearAllMocks()
  const { queryClient, wrapper } = createQueryTestHarness()
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  vi.mocked(sendMessage).mockResolvedValue(practiceDetails)
  const { result } = renderHook(() => input.useHook(), { wrapper })

  await act(async () => {
    await result.current.mutateAsync(input.request)
  })

  expect(sendMessage).toHaveBeenCalledWith(input.method, input.request)
  expect(queryMocks.invalidateTaggedQueries).not.toHaveBeenCalled()
  expect(invalidateQueries).not.toHaveBeenCalled()
}
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/features/practice/api/practice-api.test.tsx --reporter=verbose
```

Expected: FAIL — the new test fails because `invalidateTaggedQueries` and `invalidateQueries` are still being called by the `onSuccess` handlers.

- [ ] **Step 3: Remove `onSuccess` from `useSetPracticeSuspended`**

In `src/features/practice/api/practice-api.ts`, replace lines 75–84:

```ts
// FROM:
export function useSetPracticeSuspended() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: setPracticeSuspendedViaRuntime,
    onSuccess: () => {
      invalidateTaggedQueries(queryClient, ['practice', 'problems', 'tracks'])
    },
  })
}

// TO:
export function useSetPracticeSuspended() {
  return useMutation({
    mutationFn: setPracticeSuspendedViaRuntime,
  })
}
```

- [ ] **Step 4: Remove `onSuccess` from `useResetPracticeSchedule`**

Replace lines 86–95:

```ts
// FROM:
export function useResetPracticeSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: resetPracticeScheduleViaRuntime,
    onSuccess: () => {
      invalidateTaggedQueries(queryClient, ['practice', 'problems', 'tracks'])
    },
  })
}

// TO:
export function useResetPracticeSchedule() {
  return useMutation({
    mutationFn: resetPracticeScheduleViaRuntime,
  })
}
```

- [ ] **Step 5: Remove unused imports**

At the top of `practice-api.ts`, update the `@tanstack/react-query` import (line 1) to drop `useQueryClient`:

```ts
// FROM:
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// TO:
import { useMutation, useQuery } from '@tanstack/react-query'
```

Remove the `invalidateTaggedQueries` import (line 4) entirely:

```ts
// DELETE:
import { invalidateTaggedQueries } from '@/platform/query/cache-invalidation'
```

Note: the `queryKeys` import from `@/platform/query/query-keys` is still used by `usePracticeDetails` — keep it.

- [ ] **Step 6: Run the tests to confirm they pass**

```bash
npx vitest run src/features/practice/api/practice-api.test.tsx --reporter=verbose
```

Expected: All 2 tests PASS.

- [ ] **Step 7: Run the full test suite**

```bash
npx vitest run --reporter=verbose
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/practice/api/practice-api.ts src/features/practice/api/practice-api.test.tsx
git commit -m "refactor(practice): remove component-level cache invalidation from suspend and reset hooks"
```
