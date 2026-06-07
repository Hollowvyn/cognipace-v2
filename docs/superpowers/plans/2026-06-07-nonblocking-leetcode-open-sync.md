# Non-Blocking LeetCode Open Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move GitHub Gist surface-open checks out of the LeetCode, popup, and
dashboard startup request path.

**Architecture:** UI startup sends a cheap `sync.requestOpenCheck` runtime
signal. The background service worker validates that signal, coalesces it in
`createSyncAutoSync`, and later runs the existing safe clean-pull path outside
the UI request/response path.

**Tech Stack:** WXT Chrome MV3, React 19, TypeScript, Zod,
`@webext-core/messaging`, Vitest, React Testing Library.

---

## File Structure

- Modify `src/app/providers/sync-open-check.tsx`: make the provider request
  background scheduling only.
- Modify `src/app/providers/sync-open-check.test.tsx`: prove startup sends one
  lightweight request and performs no query invalidation.
- Modify `src/features/sync/api/sync-api.ts`: add
  `requestOpenCheckViaRuntime(surface)`.
- Modify `src/features/sync/api/sync-api.test.tsx`: prove the new sync API sends
  `sync.requestOpenCheck`.
- Modify `src/extension/messaging.ts`: add the runtime protocol method.
- Modify `src/extension/background/runtime-policy.ts`: authorize the method for
  popup, dashboard, and content-script.
- Modify `src/extension/background/runtime-policy.test.ts`: cover the new
  policy.
- Modify `src/extension/background/sync-auto-sync.ts`: add coalesced scheduling,
  fallback alarm constants, registration, and scheduled job execution.
- Modify `src/extension/background/sync-auto-sync.test.ts`: cover coalescing,
  fallback registration, and delayed safe-pull execution.
- Modify `src/extension/background/register-handlers.ts`: add the lightweight
  runtime handler.
- Modify `src/extension/background/register-handlers.test.ts`: prove the
  handler does not open the DB or enter the sync service path.

## Task 1: Feature API And Startup Provider

**Files:**

- Modify: `src/features/sync/api/sync-api.ts`
- Modify: `src/features/sync/api/sync-api.test.tsx`
- Modify: `src/app/providers/sync-open-check.tsx`
- Modify: `src/app/providers/sync-open-check.test.tsx`

- [ ] **Step 1: Write the failing sync API test**

In `src/features/sync/api/sync-api.test.tsx`, add
`requestOpenCheckViaRuntime` to the import list:

```ts
import {
  checkRemoteOnOpenViaRuntime,
  connectGithubGistViaRuntime,
  pullLatestViaRuntime,
  pushLocalViaRuntime,
  requestOpenCheckViaRuntime,
  saveGithubTokenViaRuntime,
  validateStoredGithubTokenViaRuntime,
  usePullLatest,
  usePushLocal,
  useSyncAction,
} from './sync-api'
```

Add this test next to the existing open-check API test:

```ts
it('requests a background open check through the claimed surface', async () => {
  vi.mocked(sendMessage).mockResolvedValue(null)

  await requestOpenCheckViaRuntime('content-script')

  expect(sendMessage).toHaveBeenCalledWith('sync.requestOpenCheck', {
    surface: 'content-script',
  })
})
```

- [ ] **Step 2: Run the sync API test and verify it fails**

Run:

```bash
npm test -- src/features/sync/api/sync-api.test.tsx
```

Expected: FAIL because `requestOpenCheckViaRuntime` is not exported.

- [ ] **Step 3: Implement the sync API wrapper**

In `src/features/sync/api/sync-api.ts`, add this function immediately after
`checkRemoteOnOpenViaRuntime`:

```ts
export function requestOpenCheckViaRuntime(surface: UiSurface) {
  return sendMessage('sync.requestOpenCheck', { surface })
}
```

- [ ] **Step 4: Rewrite the provider tests for lightweight scheduling**

In `src/app/providers/sync-open-check.test.tsx`, replace the sync mock with:

```ts
const requestOpenCheck = vi.fn<(surface: 'popup') => Promise<null>>()

vi.mock('@/features/sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/sync')>()

  return {
    ...actual,
    requestOpenCheckViaRuntime: (surface: 'popup') => requestOpenCheck(surface),
  }
})
```

Replace the first three tests with:

```ts
it('requests one background open check for the mounted surface', async () => {
  requestOpenCheck.mockResolvedValue(null)

  renderWithQueryClient(<SyncOpenCheck surface="popup" />)

  await waitFor(() => {
    expect(requestOpenCheck).toHaveBeenCalledTimes(1)
  })
  expect(requestOpenCheck).toHaveBeenCalledWith('popup')
})

it('does not duplicate the open-check request during StrictMode effect probing', async () => {
  requestOpenCheck.mockResolvedValue(null)

  renderWithQueryClient(
    <StrictMode>
      <SyncOpenCheck surface="popup" />
    </StrictMode>,
  )

  await waitFor(() => {
    expect(requestOpenCheck).toHaveBeenCalledTimes(1)
  })
})

it('swallows open-check request errors', async () => {
  requestOpenCheck.mockRejectedValue(new Error('Scheduler unavailable.'))

  renderWithQueryClient(<SyncOpenCheck surface="popup" />)

  await waitFor(() => {
    expect(requestOpenCheck).toHaveBeenCalledWith('popup')
  })
})
```

Delete the two provider tests named
`broad-invalidates app data after a successful pull` and
`refreshes sync status without broad app invalidation when the open check does not pull`.
Those assertions belong to manual sync hooks or background invalidation, not the
startup provider.

- [ ] **Step 5: Run the provider test and verify it fails**

Run:

```bash
npm test -- src/app/providers/sync-open-check.test.tsx
```

Expected: FAIL because `SyncOpenCheck` still calls
`checkRemoteOnOpenViaRuntime`.

- [ ] **Step 6: Implement the provider change**

Replace `src/app/providers/sync-open-check.tsx` with:

```tsx
import { useEffect } from 'react'

import type { UiSurface } from '@/extension/messaging'
import { requestOpenCheckViaRuntime } from '@/features/sync'

type SyncOpenCheckProps = {
  surface: UiSurface
}

export function SyncOpenCheck({ surface }: SyncOpenCheckProps) {
  useEffect(() => {
    let active = true
    const timeoutId = globalThis.setTimeout(() => {
      void requestOpenCheckViaRuntime(surface).catch(() => {
        if (!active) {
          return
        }
        // Background sync status records failures; opening UI should continue.
      })
    }, 0)

    return () => {
      active = false
      globalThis.clearTimeout(timeoutId)
    }
  }, [surface])

  return null
}
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
npm test -- src/features/sync/api/sync-api.test.tsx src/app/providers/sync-open-check.test.tsx
```

Expected: PASS for both test files.

- [ ] **Step 8: Commit**

```bash
git add src/features/sync/api/sync-api.ts src/features/sync/api/sync-api.test.tsx src/app/providers/sync-open-check.tsx src/app/providers/sync-open-check.test.tsx
git commit -m "fix(sync): request open checks without awaiting sync"
```

## Task 2: Runtime Protocol And Sender Policy

**Files:**

- Modify: `src/extension/messaging.ts`
- Modify: `src/extension/background/runtime-policy.ts`
- Modify: `src/extension/background/runtime-policy.test.ts`

- [ ] **Step 1: Write the failing runtime policy test**

In `src/extension/background/runtime-policy.test.ts`, update the safe sync
open-check test to include both methods:

```ts
it('allows safe sync open checks from every UI surface', () => {
  for (const method of [
    'sync.checkRemoteOnOpen',
    'sync.requestOpenCheck',
  ] as const) {
    for (const surface of ['popup', 'dashboard', 'content-script'] as const) {
      expect(canCallExtensionMethod(method, surface)).toBe(true)
    }
  }
})
```

- [ ] **Step 2: Run the policy test and verify it fails**

Run:

```bash
npm test -- src/extension/background/runtime-policy.test.ts
```

Expected: FAIL because `sync.requestOpenCheck` is not in the method policy map.

- [ ] **Step 3: Add the runtime protocol method**

In `src/extension/messaging.ts`, add this method beside
`sync.checkRemoteOnOpen` in `ProtocolMap`:

```ts
'sync.requestOpenCheck'(request: SyncRequest): null
```

In the same file, add the method beside `sync.checkRemoteOnOpen` in
`protocolMethodNames`:

```ts
'sync.requestOpenCheck',
```

- [ ] **Step 4: Add sender authorization**

In `src/extension/background/runtime-policy.ts`, add this entry beside
`sync.checkRemoteOnOpen`:

```ts
'sync.requestOpenCheck': ['popup', 'dashboard', 'content-script'],
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- src/extension/background/runtime-policy.test.ts src/features/sync/api/sync-api.test.tsx
```

Expected: PASS for both test files. The sync API test passes only after the
protocol method exists.

- [ ] **Step 6: Commit**

```bash
git add src/extension/messaging.ts src/extension/background/runtime-policy.ts src/extension/background/runtime-policy.test.ts
git commit -m "feat(sync): add open check scheduling protocol"
```

## Task 3: Auto-Sync Open-Check Scheduling

**Files:**

- Modify: `src/extension/background/sync-auto-sync.ts`
- Modify: `src/extension/background/sync-auto-sync.test.ts`

- [ ] **Step 1: Write failing scheduler tests**

In `src/extension/background/sync-auto-sync.test.ts`, add the new constants to
the import list:

```ts
  syncOpenCheckAlarmName,
  syncOpenCheckDelayMs,
  syncOpenCheckFallbackDelayMinutes,
```

Add `afterEach` to the Vitest import:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
```

Add this cleanup after the existing `beforeEach`:

```ts
afterEach(() => {
  vi.useRealTimers()
})
```

Add these tests before the existing registration test:

```ts
it('registers the requested open-check fallback job', () => {
  const syncAutoSync = createSyncAutoSync(deps)

  syncAutoSync.registerJobs()

  expect(deps.scheduler.register).toHaveBeenCalledWith({
    name: syncOpenCheckAlarmName,
    run: syncAutoSync.runRequestedOpenCheck,
  })
})

it('coalesces repeated surface-open check requests behind one timer and fallback alarm', async () => {
  vi.useFakeTimers()
  const syncAutoSync = createSyncAutoSync(deps)

  await syncAutoSync.requestOpenCheckAfterSurfaceOpen()
  await syncAutoSync.requestOpenCheckAfterSurfaceOpen()

  expect(deps.scheduler.schedule).toHaveBeenCalledTimes(1)
  expect(deps.scheduler.schedule).toHaveBeenCalledWith(syncOpenCheckAlarmName, {
    delayInMinutes: syncOpenCheckFallbackDelayMinutes,
  })

  await vi.advanceTimersByTimeAsync(syncOpenCheckDelayMs)

  expect(deps.runCleanPullCheck).toHaveBeenCalledTimes(1)
})

it('runs requested open checks through the existing clean pull path and clears the fallback alarm', async () => {
  const syncAutoSync = createSyncAutoSync(deps)

  await syncAutoSync.requestOpenCheckAfterSurfaceOpen()
  await syncAutoSync.runRequestedOpenCheck()

  expect(deps.runCleanPullCheck).toHaveBeenCalledTimes(1)
  expect(deps.scheduler.clear).toHaveBeenCalledWith(syncOpenCheckAlarmName)
})
```

Update the existing registration test name from
`registers push, retry, and poll jobs with startup poll repair settings` to:

```ts
it('registers push, retry, poll, and open-check jobs with startup poll repair settings', () => {
```

- [ ] **Step 2: Run the scheduler test and verify it fails**

Run:

```bash
npm test -- src/extension/background/sync-auto-sync.test.ts
```

Expected: FAIL because the constants and methods do not exist.

- [ ] **Step 3: Implement constants and dependency type**

In `src/extension/background/sync-auto-sync.ts`, add these exports beside the
existing alarm constants:

```ts
export const syncOpenCheckAlarmName = 'sync:open-check'
export const syncOpenCheckDelayMs = 2000
export const syncOpenCheckFallbackDelayMinutes = 0.5
```

Inside `createSyncAutoSync`, add timer state after `jobsRegistered`:

```ts
let openCheckPending = false
let openCheckTimer: ReturnType<typeof globalThis.setTimeout> | null = null
```

- [ ] **Step 4: Implement request scheduling and job execution**

In `createSyncAutoSync`, add:

```ts
async function requestOpenCheckAfterSurfaceOpen() {
  if (openCheckPending) {
    return
  }

  openCheckPending = true
  await deps.scheduler.schedule(syncOpenCheckAlarmName, {
    delayInMinutes: syncOpenCheckFallbackDelayMinutes,
  })

  openCheckTimer = globalThis.setTimeout(() => {
    openCheckTimer = null
    void runRequestedOpenCheck()
  }, syncOpenCheckDelayMs)
}

async function runRequestedOpenCheck() {
  if (openCheckTimer !== null) {
    globalThis.clearTimeout(openCheckTimer)
    openCheckTimer = null
  }

  openCheckPending = false

  try {
    await runCleanPullCheck()
  } finally {
    await deps.scheduler.clear(syncOpenCheckAlarmName)
  }
}
```

In `registerJobs`, add:

```ts
deps.scheduler.register({
  name: syncOpenCheckAlarmName,
  run: runRequestedOpenCheck,
})
```

Return the new methods from `createSyncAutoSync`:

```ts
requestOpenCheckAfterSurfaceOpen,
runRequestedOpenCheck,
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- src/extension/background/sync-auto-sync.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/extension/background/sync-auto-sync.ts src/extension/background/sync-auto-sync.test.ts
git commit -m "feat(sync): schedule open checks in the background"
```

## Task 4: Lightweight Background Handler And Final Validation

**Files:**

- Modify: `src/extension/background/register-handlers.ts`
- Modify: `src/extension/background/register-handlers.test.ts`

- [ ] **Step 1: Extend the test mock shape**

In `src/extension/background/register-handlers.test.ts`, add this method to the
`syncAutoSync` mock object:

```ts
requestOpenCheckAfterSurfaceOpen: vi.fn(),
```

- [ ] **Step 2: Write the failing handler tests**

Add these tests after the existing
`registers sync open checks with UI-surface policy and response parsing` test:

```ts
it('registers lightweight sync open-check requests without service access', async () => {
  const contentScriptSender = {
    tab: { id: 7 },
    url: 'https://leetcode.com/problems/two-sum/',
  }

  const response = await sendRuntimeMessage(
    'sync.requestOpenCheck',
    {
      surface: 'content-script',
    },
    contentScriptSender,
  )

  expectRuntimePolicy(
    'sync.requestOpenCheck',
    'content-script',
    contentScriptSender,
  )
  expect(
    backgroundMocks.syncAutoSync.requestOpenCheckAfterSurfaceOpen,
  ).toHaveBeenCalledTimes(1)
  expect(response).toBeNull()
  expect(backgroundMocks.getAppDb).not.toHaveBeenCalled()
  expect(backgroundMocks.createBackgroundSyncService).not.toHaveBeenCalled()
  expect(backgroundMocks.syncService.checkRemoteOnOpen).not.toHaveBeenCalled()
  expect(backgroundMocks.flushDbSnapshot).not.toHaveBeenCalled()
})

it('rejects malformed lightweight sync open-check requests before scheduling', () => {
  expect(() =>
    sendRuntimeMessage('sync.requestOpenCheck', {
      surface: 'popup',
      confirmLocalOverwrite: true,
    }),
  ).toThrow()

  expect(
    backgroundMocks.assertCanSenderCallExtensionMethod,
  ).not.toHaveBeenCalledWith(
    'sync.requestOpenCheck',
    expect.anything(),
    expect.anything(),
  )
  expect(
    backgroundMocks.syncAutoSync.requestOpenCheckAfterSurfaceOpen,
  ).not.toHaveBeenCalled()
  expect(backgroundMocks.getAppDb).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Run the handler test and verify it fails**

Run:

```bash
npm test -- src/extension/background/register-handlers.test.ts
```

Expected: FAIL because `sync.requestOpenCheck` is not registered.

- [ ] **Step 4: Implement the lightweight handler**

In `src/extension/background/register-handlers.ts`, add this handler immediately
after the existing `sync.checkRemoteOnOpen` handler:

```ts
onMessage('sync.requestOpenCheck', ({ data, sender }) => {
  const request = syncRequestSchema.parse(data)

  assertCanSenderCallExtensionMethod(
    'sync.requestOpenCheck',
    request.surface,
    sender,
  )

  void syncAutoSync.requestOpenCheckAfterSurfaceOpen().catch(() => {
    // Opening a UI surface must not fail when automatic sync scheduling fails.
  })

  return null
})
```

- [ ] **Step 5: Run all focused tests**

Run:

```bash
npm test -- src/app/providers/sync-open-check.test.tsx src/features/sync/api/sync-api.test.tsx src/extension/background/runtime-policy.test.ts src/extension/background/sync-auto-sync.test.ts src/extension/background/register-handlers.test.ts
```

Expected: PASS for all listed test files.

- [ ] **Step 6: Run full validation**

Run:

```bash
npm run check
```

Expected: PASS. If it fails, record the failing command and exact test or lint
error before changing code.

- [ ] **Step 7: Manual Chrome validation**

Run:

```bash
npm run build
```

Load `.output/chrome-mv3` in Chrome, configure GitHub Gist sync in the
dashboard, then open `https://leetcode.com/problems/two-sum/`.

Expected:

- the LeetCode page remains usable while CogniPace starts
- the overlay appears without waiting for GitHub
- background sync status can update later
- if a clean pull happens, popup and dashboard data refresh through existing
  invalidation broadcasts

- [ ] **Step 8: Commit**

```bash
git add src/extension/background/register-handlers.ts src/extension/background/register-handlers.test.ts
git commit -m "fix(sync): schedule open checks from background handler"
```

## Self-Review

- Spec coverage: runtime startup, background scheduling, safety policy,
  provider behavior, tests, and manual validation are covered by Tasks 1-4.
- Scope: no account, backend, permission, manual sync, queue, or LeetCode
  capture changes are included.
- Type consistency: the plan uses `sync.requestOpenCheck`,
  `requestOpenCheckViaRuntime`, `requestOpenCheckAfterSurfaceOpen`,
  `runRequestedOpenCheck`, `syncOpenCheckAlarmName`,
  `syncOpenCheckDelayMs`, and `syncOpenCheckFallbackDelayMinutes`
  consistently across tests and implementation steps.
