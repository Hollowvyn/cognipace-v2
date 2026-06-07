# Issue #20 — Final Architecture and Test Audit Design

**Date:** 2026-06-06
**Branch:** `o.olaosebikan/notification-plan-test`
**Issue:** [#20 Run final architecture and test audit for Queue, FSRS, Analytics, and Notifications](https://github.com/Hollowvyn/cognipace-v2/issues/20)

## Goal

Close the gap between what the issue's audit checklist requires and what is currently enforced by automated tests. All 1203 existing tests pass, `npm run check` is clean, and `npm run build` succeeds. The work is purely additive — no production code changes.

## Current State

### Already satisfied by existing boundary tests

- Shared infrastructure does not import app or feature code
- App feature imports are on public feature surfaces
- Cross-feature imports are on public feature surfaces
- Root feature barrels are free of data/server exports
- Review scheduling writes are behind the practice repository
- Notification background code does not import FSRS internals (`@/lib/fsrs`)
- `apiKey` literal stays out of all features except `genai`

### Gaps to close

| Checklist item | Gap |
|---|---|
| `ts-fsrs` only imported in `src/lib/fsrs` | No automated test |
| Dashboard free of `@/lib/fsrs` imports | No automated test |
| Queue has no `@/features/tracks` dependency | No automated test |
| Settings UI doesn't call Chrome alarm/notification APIs | No automated test |
| Queue track-independence | Domain + integration tests missing |
| Queue API hook test | No test file |
| Analytics contract tests | No test file |
| Analytics repository tests | No test file |
| Analytics API hook test | No test file |
| Notification E2E plan | Option C executed; full alarm-flow not yet run |

## Approach

Single PR with all test additions. No production code changes. Eight files touched.

## Design

### 1. Architecture boundary additions

**File:** `src/testing/architecture-boundaries.test.ts`

Four new `it()` blocks:

**`ts-fsrs` package scoped to `src/lib/fsrs`**
Scan all production source files outside `src/lib/fsrs` for a bare `from 'ts-fsrs'` import. Catches anyone pulling in the FSRS library directly instead of going through the adapter layer.

**Dashboard free of `@/lib/fsrs` imports**
Scan `src/app/dashboard` files for any `from '@/lib/fsrs'` import. Enforces that FSRS calculations never land in dashboard route code.

**Queue feature has no `@/features/tracks` dependency**
Scan `src/features/queue` files for imports of `@/features/tracks`. The queue service already doesn't join tracks tables — this makes the constraint explicit and machine-enforced.

**Settings components don't call browser alarm or notification APIs**
Scan `src/features/settings/components` files for the literals `browser.alarms`, `chrome.alarms`, `browser.notifications`, `chrome.notifications`. The Settings UI is a pure preferences surface; side-effectful scheduling belongs in background code only.

### 2. Queue track-independence tests

**File 1:** `src/features/queue/domain/queue.test.ts` (addition)
A single `it()` that asserts `QueueCandidate` has no track-related fields. Since `buildTodayQueue` accepts only `{ problem, state }[]`, this verifies by construction that track membership, order, and progress cannot influence queue output.

**File 2 (new):** `src/features/queue/queue-track-independence.integration.test.ts`
Uses `createTestDb()`, reviews a seeded problem, then calls `getTodayQueue` twice:
- Once with the default active track (ByteByteGo)
- Once after clearing the active track

Asserts the queue result (dueCount, items, topRecommendation) is identical both times. Runtime proof that the queue service doesn't touch tracks tables even when track state changes.

### 3. Analytics contract tests

**New file:** `src/features/analytics/api/analytics-contracts.test.ts`

Tests Zod schemas in `analytics-contracts.ts` directly — no mocks, no DB:

- `analyticsSummarySchema` accepts a valid full summary
- Rejects forecast arrays that aren't exactly 14 entries (13 and 15 both rejected)
- Rejects weak problem arrays longer than 10
- Rejects negative counts (`dueCount`, `lapseCount`, etc.)
- `forecastEntrySchema` and `weakProblemSchema` each get isolated pass/fail pairs

### 4. Analytics repository tests

**New file:** `src/features/analytics/data/analytics-repository.test.ts`

Uses `createTestDb()` with direct schema inserts (same pattern as `practice-core.integration.test.ts`). Four `describe` blocks:

**`getReviewDayStats`**
- Returns zeros when no attempts exist
- Counts total reviews and distinct review days correctly across multiple days

**`getRecentRatings`**
- Returns empty when no attempts exist
- Returns only attempts on or after the `since` cutoff (boundary: exactly at cutoff included, one ms before excluded)
- Returns correct `rating` and `reviewedAt` values

**`getUpcomingCards`**
- Returns empty when no cards exist
- Includes cards due before the `until` boundary, excludes those due after
- Excludes cards belonging to suspended problems

**`getWeakProblemCandidates`**
- Returns empty when no reviewed problems exist
- Excludes problems with zero lapses
- Excludes suspended problems
- Returns correct slug, title, lapseCount, difficulty, stability, lastReviewAt
- Orders by lapses DESC then difficulty DESC

### 5. Analytics and queue API hook tests

**New file:** `src/features/analytics/api/analytics-api.test.tsx`
Mocks `@/extension/messaging`:
- `analyticsQueryKeys.summary()` returns `['analytics', 'summary']`
- `useAnalyticsSummary` calls `sendMessage('analytics.getSummary', {})` and resolves the returned value

**New file:** `src/features/queue/api/queue-api.test.ts`
Mocks `@/extension/messaging`:
- `queueQueryKeys.today(at)` returns the correct key shape with and without an `at` value
- `useTodayQueue` calls `sendMessage('queue.getTodayQueue', request)` with surface and optional `at` forwarded correctly

### 6. Notification E2E deferral

**File:** `docs/test-plans/notification-alarm-e2e.md` (addition)

Add a **Status** section near the top:
- **Option C executed** — notification delivery confirmed via service worker (permissions granted, notification appeared)
- **Full alarm-flow deferred** — Steps 5–10 require a Chrome build with at least one FSRS-scheduled problem whose due date has passed

## File Inventory

| Action | File |
|---|---|
| Edit | `src/testing/architecture-boundaries.test.ts` |
| Edit | `src/features/queue/domain/queue.test.ts` |
| Create | `src/features/queue/queue-track-independence.integration.test.ts` |
| Create | `src/features/analytics/api/analytics-contracts.test.ts` |
| Create | `src/features/analytics/data/analytics-repository.test.ts` |
| Create | `src/features/analytics/api/analytics-api.test.tsx` |
| Create | `src/features/queue/api/queue-api.test.ts` |
| Edit | `docs/test-plans/notification-alarm-e2e.md` |

## Acceptance Criteria

All items from issue #20 are met after this PR:

- Architecture boundary tests cover all checklist items
- Queue track-independence is verified at both domain and integration level
- Analytics contract, repository, and API hook tests exist
- Queue API hook test exists
- Notification E2E status documented (Option C executed; full alarm-flow deferred with reason)
- `npm run test` passes
- `npm run check` passes
- `npm run build` succeeds

## Non-Goals

- No production code changes
- No new feature implementation
- No Dashboard final overview
- No AI/GenAI scope
- No backup/import/global reset
