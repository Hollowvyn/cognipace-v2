# Practice Cache Invalidation Expansion

**Issue:** #16  
**Date:** 2026-05-30  
**Status:** Approved

## Problem

A practice mutation (save review, override result, suspend, reset schedule, update log) touches every read model in the app: Queue, Analytics, Tracks, Library, and app-shell summaries. The current `practice` tag in `cache-invalidation.ts` only maps to `practice-details` and `analytics`. Background handlers work around this by combining multiple tags (`practiceTrackInvalidationTags = ['practice', 'problems', 'queue', 'app-shell', 'tracks']`), which is redundant assembly that belongs in the tag definition. Two hooks (`useSetPracticeSuspended`, `useResetPracticeSchedule`) also do their own client-side `onSuccess` invalidation with an incomplete tag set, violating the "no component-level query knowledge" constraint.

A related gap: the `settings` tag does not include `queryKeys.problems.all`, so FSRS parameter changes do not refresh the library's due indicators.

## Constraints

- Invalidation logic must be centralized in `src/platform/query/cache-invalidation.ts`
- Background broadcasts are the authoritative invalidation mechanism; no component-level query knowledge
- No manual cache patching

## Design

### 1. `src/platform/query/cache-invalidation.ts`

Expand the `practice` tag from 2 keys to 6:

```ts
practice: [
  queryKeys.practice.all,
  queryKeys.analytics.all,
  queryKeys.queue.all,
  queryKeys.tracks.all,
  queryKeys.problems.all,
  queryKeys.appShell.all,
],
```

Add `queryKeys.problems.all` to the `settings` tag so FSRS parameter changes refresh the library:

```ts
settings: [
  queryKeys.settings.all,
  queryKeys.appShell.all,
  queryKeys.analytics.all,
  queryKeys.practice.all,
  queryKeys.queue.all,
  queryKeys.tracks.all,
  queryKeys.problems.all,  // new
],
```

Update `cache-invalidation.test.ts` snapshots to match, and add a test case confirming `['practice']` alone produces all 6 query families.

### 2. `src/extension/background/register-handlers.ts`

Delete the `practiceTrackInvalidationTags` constant (lines 144–150). All five practice mutation handlers (`saveReviewResult`, `overrideLastReviewResult`, `setSuspended`, `resetSchedule`, `updateCurrentLog`) pass `tags: ['practice']` to `broadcastPracticeInvalidation`. The `updateCurrentLog` handler was previously using the narrower `['practice', 'problems', 'app-shell']` with no documented reason — this is the primary stale-state bug the issue targets.

Remove the `tags` parameter default from `broadcastPracticeInvalidation` (or inline it to `['practice']`) since all callers now pass explicitly — the optional fallback adds ambiguity with no benefit.

### 3. `src/features/practice/api/practice-api.ts`

Remove `onSuccess` callbacks from `useSetPracticeSuspended` and `useResetPracticeSchedule`. Both become plain `useMutation({ mutationFn })` — consistent with `useSaveReviewResult` and `useOverrideLastReviewResult`, which already rely solely on the background broadcast. Remove the now-unused `useQueryClient` calls and import.

## Files Changed

| File | Change |
|---|---|
| `src/platform/query/cache-invalidation.ts` | Expand `practice` and `settings` tag mappings |
| `src/platform/query/cache-invalidation.test.ts` | Update snapshots, add `practice` full-coverage case |
| `src/extension/background/register-handlers.ts` | Delete `practiceTrackInvalidationTags`; all practice handlers use `['practice']` |
| `src/features/practice/api/practice-api.ts` | Remove `onSuccess` + `useQueryClient` from two hooks |

## What Does Not Change

- The broadcaster (`cache-invalidation-broadcaster.ts`) is unchanged
- Query key definitions (`query-keys.ts`) are unchanged
- The `problems` tag is unchanged (it already included `queue`, `tracks`, `app-shell`, `practice`)
- No new tags are added
