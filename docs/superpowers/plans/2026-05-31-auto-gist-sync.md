# Auto Gist Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add alarm-backed automatic safe GitHub Gist sync that pushes local
mutations, clean-pulls on surface open, and leaves destructive recovery to
manual force pull/push dialogs.

**Architecture:** Background owns scheduling and orchestration because it
already owns the mutation queue, trusted token access, snapshot flushing, and
runtime authorization. The sync feature service keeps pull/push rules and the
new safe remote-open check; the generic alarm scheduler stays feature-agnostic
so future reminder jobs can reuse it.

**Tech Stack:** WXT Chrome MV3, `chrome.alarms` through `wxt/browser`, React 19,
TanStack Query, Zod, Vitest, React Testing Library.

---

## File Structure

Create:

- `src/extension/background/scheduler/alarm-scheduler.ts`: generic typed
  scheduler over `chrome.alarms`.
- `src/extension/background/scheduler/alarm-scheduler.test.ts`: deterministic
  scheduler tests with an injected fake alarm adapter.
- `src/features/sync/domain/sync-auto-retry.ts`: pure retry delay policy.
- `src/features/sync/domain/sync-auto-retry.test.ts`: backoff policy tests.
- `src/extension/background/sync-auto-sync.ts`: sync-specific alarm job policy.
- `src/extension/background/sync-auto-sync.test.ts`: auto-push, clean-pull, and
  retry policy tests.
- `src/app/providers/sync-open-check.tsx`: surface-open clean-pull trigger.
- `src/app/providers/sync-open-check.test.tsx`: provider behavior tests.

Modify:

- `wxt.config.ts`: add `alarms` permission only.
- `src/features/sync/data/sync-metadata-store.ts`: add persisted retry attempt
  state.
- `src/features/sync/data/sync-metadata-store.test.ts`: assert new defaults and
  retry state writes.
- `src/features/sync/api/sync-contracts.ts`: add open-check action schema.
- `src/features/sync/api/sync-contracts.test.ts`: assert result schema.
- `src/features/sync/domain/sync-status.ts`: add the new action type.
- `src/features/sync/server/sync-service.ts`: add safe `checkRemoteOnOpen`.
- `src/features/sync/server/sync-service.test.ts`: cover clean pull, dirty
  no-op, unchanged no-op, and invalid remote error.
- `src/features/sync/api/sync-api.ts`: add runtime fetcher and hook for open
  check.
- `src/features/sync/api/sync-api.test.tsx`: assert runtime payload and
  invalidation after pull.
- `src/extension/messaging.ts`: add protocol method and exported schema.
- `src/extension/background/runtime-policy.ts`: authorize open check from
  popup, dashboard, and content script.
- `src/extension/background/runtime-policy.test.ts`: assert authorization.
- `src/extension/background/register-handlers.ts`: register open-check handler,
  wire scheduler startup, dispatch alarms, schedule auto-push after mutation
  flush, and clear pending auto jobs after manual success.
- `src/extension/background/register-handlers.test.ts`: cover new runtime
  method, mutation scheduling, alarm dispatch, startup repair, and manual
  clearing.
- `src/entrypoints/background.ts`: start scheduler setup after trusted storage if
  startup repair is extracted from handler registration.
- `src/app/providers/app-providers.tsx`: accept a surface prop and mount the
  sync open-check provider.
- `src/entrypoints/dashboard/main.tsx`: pass `surface="dashboard"`.
- `src/entrypoints/popup/main.tsx`: pass `surface="popup"`.
- `src/entrypoints/leetcode.content.tsx`: pass `surface="content-script"`.
- `docs/product.md`: document automatic safe sync behavior.
- `docs/architecture.md`: document scheduler ownership and auto-sync flow.
- `docs/testing.md`: add two-profile auto-sync smoke steps.
- `docs/superpowers/README.md`: add this implementation plan.

---

### Task 1: Alarm Scheduler Foundation

**Files:**

- Create: `src/extension/background/scheduler/alarm-scheduler.ts`
- Create: `src/extension/background/scheduler/alarm-scheduler.test.ts`
- Modify: `wxt.config.ts`

- [ ] **Step 1: Write the failing scheduler tests**

Create `src/extension/background/scheduler/alarm-scheduler.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAlarmScheduler, type AlarmAdapter } from './alarm-scheduler'

describe('alarm scheduler', () => {
  let adapter: FakeAlarmAdapter

  beforeEach(() => {
    adapter = createFakeAlarmAdapter()
  })

  it('creates namespaced alarms and dispatches registered jobs', async () => {
    const scheduler = createAlarmScheduler({ alarms: adapter })
    const run = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)

    scheduler.register({ name: 'sync:auto-push', run })
    await scheduler.schedule('sync:auto-push', { delayInMinutes: 0.5 })
    await adapter.fire('sync:auto-push')

    expect(adapter.created).toEqual([
      ['sync:auto-push', { delayInMinutes: 0.5 }],
    ])
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('repairs repeating alarms that are missing on startup', async () => {
    const scheduler = createAlarmScheduler({ alarms: adapter })

    scheduler.register({
      name: 'sync:poll',
      run: vi.fn(),
      startup: { delayInMinutes: 10, periodInMinutes: 10 },
    })

    await scheduler.repairStartupAlarms()

    expect(adapter.created).toEqual([
      ['sync:poll', { delayInMinutes: 10, periodInMinutes: 10 }],
    ])
  })

  it('does not replace an existing startup alarm', async () => {
    adapter.existing.add('sync:poll')
    const scheduler = createAlarmScheduler({ alarms: adapter })

    scheduler.register({
      name: 'sync:poll',
      run: vi.fn(),
      startup: { delayInMinutes: 10, periodInMinutes: 10 },
    })

    await scheduler.repairStartupAlarms()

    expect(adapter.created).toEqual([])
  })

  it('clears a scheduled alarm', async () => {
    const scheduler = createAlarmScheduler({ alarms: adapter })

    await scheduler.clear('sync:auto-push')

    expect(adapter.cleared).toEqual(['sync:auto-push'])
  })

  it('ignores unknown alarms safely', async () => {
    const scheduler = createAlarmScheduler({ alarms: adapter })

    await expect(adapter.fire('unknown:job')).resolves.toBeUndefined()
  })
})

type AlarmInfo = {
  delayInMinutes?: number
  periodInMinutes?: number
}

type FakeAlarmAdapter = AlarmAdapter & {
  cleared: string[]
  created: Array<[string, AlarmInfo]>
  existing: Set<string>
  fire: (name: string) => Promise<void>
}

function createFakeAlarmAdapter(): FakeAlarmAdapter {
  let listener: ((alarm: { name: string }) => void | Promise<void>) | null =
    null
  const existing = new Set<string>()

  return {
    cleared: [],
    created: [],
    existing,
    async clear(name) {
      this.cleared.push(name)
      existing.delete(name)
      return true
    },
    async create(name, info) {
      this.created.push([name, info])
      existing.add(name)
    },
    async get(name) {
      return existing.has(name) ? { name } : undefined
    },
    onAlarm(listenerInput) {
      listener = listenerInput
      return () => {
        listener = null
      }
    },
    async fire(name) {
      await listener?.({ name })
    },
  }
}
```

- [ ] **Step 2: Run the failing scheduler tests**

Run:

```sh
npm test -- src/extension/background/scheduler/alarm-scheduler.test.ts --run
```

Expected: FAIL because `./alarm-scheduler` does not exist.

- [ ] **Step 3: Implement the scheduler**

Create `src/extension/background/scheduler/alarm-scheduler.ts`:

```ts
import { browser } from 'wxt/browser'

export type AlarmInfo = {
  delayInMinutes?: number
  periodInMinutes?: number
}

export type AlarmAdapter = {
  clear: (name: string) => Promise<boolean>
  create: (name: string, info: AlarmInfo) => Promise<void>
  get: (name: string) => Promise<{ name: string } | undefined>
  onAlarm: (
    listener: (alarm: { name: string }) => void | Promise<void>,
  ) => () => void
}

export type AlarmJob = {
  name: string
  run: () => Promise<void> | void
  startup?: AlarmInfo | undefined
}

export type AlarmScheduler = ReturnType<typeof createAlarmScheduler>

export function createAlarmScheduler(
  input: {
    alarms?: AlarmAdapter | undefined
  } = {},
) {
  const alarms = input.alarms ?? createChromeAlarmAdapter()
  const jobs = new Map<string, AlarmJob>()
  const unsubscribe = alarms.onAlarm(async (alarm) => {
    const job = jobs.get(alarm.name)

    if (!job) {
      return
    }

    await job.run()
  })

  return {
    clear: (name: string) => alarms.clear(name),
    dispose: unsubscribe,
    register(job: AlarmJob) {
      jobs.set(job.name, job)
    },
    async repairStartupAlarms() {
      for (const job of jobs.values()) {
        if (!job.startup) {
          continue
        }

        const existing = await alarms.get(job.name)
        if (!existing) {
          await alarms.create(job.name, job.startup)
        }
      }
    },
    schedule: (name: string, info: AlarmInfo) => alarms.create(name, info),
  }
}

function createChromeAlarmAdapter(): AlarmAdapter {
  return {
    clear: (name) => browser.alarms.clear(name),
    create: (name, info) => browser.alarms.create(name, info),
    get: (name) => browser.alarms.get(name),
    onAlarm(listener) {
      browser.alarms.onAlarm.addListener(listener)

      return () => browser.alarms.onAlarm.removeListener(listener)
    },
  }
}
```

Modify `wxt.config.ts`:

```ts
permissions: ['storage', 'alarms'],
```

- [ ] **Step 4: Run scheduler tests**

Run:

```sh
npm test -- src/extension/background/scheduler/alarm-scheduler.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit scheduler foundation**

Run:

```sh
git add wxt.config.ts src/extension/background/scheduler/alarm-scheduler.ts src/extension/background/scheduler/alarm-scheduler.test.ts
git commit -m "feat(sync): add background alarm scheduler"
```

---

### Task 2: Auto-Sync Retry State And Backoff

**Files:**

- Create: `src/features/sync/domain/sync-auto-retry.ts`
- Create: `src/features/sync/domain/sync-auto-retry.test.ts`
- Modify: `src/features/sync/data/sync-metadata-store.ts`
- Modify: `src/features/sync/data/sync-metadata-store.test.ts`

- [ ] **Step 1: Write the failing backoff policy tests**

Create `src/features/sync/domain/sync-auto-retry.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { readAutoSyncRetryDelayMinutes } from './sync-auto-retry'

describe('sync auto retry policy', () => {
  it.each([
    [0, 1],
    [1, 5],
    [2, 15],
    [3, 30],
    [4, 30],
  ])('maps attempt %i to %i minutes', (attempt, delay) => {
    expect(readAutoSyncRetryDelayMinutes(attempt)).toBe(delay)
  })

  it('rejects negative attempts', () => {
    expect(() => readAutoSyncRetryDelayMinutes(-1)).toThrow(/attempt/i)
  })
})
```

- [ ] **Step 2: Add failing metadata tests**

In `src/features/sync/data/sync-metadata-store.test.ts`, add tests for older
metadata defaults and persisted retry state:

```ts
it('defaults automatic retry state for older metadata', async () => {
  storageArea.get.mockResolvedValue({
    cognipace_sync_metadata_v1: {
      enabled: true,
      gistId: 'gist_1',
      lastSyncAt: null,
      lastSyncDirection: null,
      lastRemoteVersion: null,
      lastRemoteUpdatedAt: null,
      localDataUpdatedAt: null,
      dirtySinceLastSync: false,
      lastError: null,
      conflict: null,
    },
  })

  await expect(readSyncMetadata()).resolves.toMatchObject({
    autoSyncRetryAttempt: 0,
    lastAutoSyncAt: null,
  })
})

it('persists automatic retry state', async () => {
  storageArea.get.mockResolvedValue({})

  await writeSyncMetadata({
    autoSyncRetryAttempt: 2,
    lastAutoSyncAt: '2026-05-31T12:00:00.000Z',
  })

  expect(storageArea.set).toHaveBeenCalledWith({
    cognipace_sync_metadata_v1: expect.objectContaining({
      autoSyncRetryAttempt: 2,
      lastAutoSyncAt: '2026-05-31T12:00:00.000Z',
    }),
  })
})
```

- [ ] **Step 3: Run the failing retry tests**

Run:

```sh
npm test -- src/features/sync/domain/sync-auto-retry.test.ts src/features/sync/data/sync-metadata-store.test.ts --run
```

Expected: FAIL because retry policy and metadata fields are missing.

- [ ] **Step 4: Implement retry policy and metadata defaults**

Create `src/features/sync/domain/sync-auto-retry.ts`:

```ts
const retryDelaysMinutes = [1, 5, 15, 30] as const

export function readAutoSyncRetryDelayMinutes(attempt: number) {
  if (!Number.isInteger(attempt) || attempt < 0) {
    throw new Error('Auto-sync retry attempt must be a non-negative integer.')
  }

  return retryDelaysMinutes[Math.min(attempt, retryDelaysMinutes.length - 1)]
}
```

In `src/features/sync/data/sync-metadata-store.ts`, add schema fields:

```ts
autoSyncRetryAttempt: z.number().int().min(0).default(0),
lastAutoSyncAt: z.iso.datetime().nullable().default(null),
```

Add matching defaults:

```ts
autoSyncRetryAttempt: 0,
lastAutoSyncAt: null,
```

- [ ] **Step 5: Run retry tests**

Run:

```sh
npm test -- src/features/sync/domain/sync-auto-retry.test.ts src/features/sync/data/sync-metadata-store.test.ts --run
```

Expected: PASS.

- [ ] **Step 6: Commit retry state**

Run:

```sh
git add src/features/sync/domain/sync-auto-retry.ts src/features/sync/domain/sync-auto-retry.test.ts src/features/sync/data/sync-metadata-store.ts src/features/sync/data/sync-metadata-store.test.ts
git commit -m "feat(sync): add auto retry metadata"
```

---

### Task 3: Safe Remote Open Check Service

**Files:**

- Modify: `src/features/sync/api/sync-contracts.ts`
- Modify: `src/features/sync/api/sync-contracts.test.ts`
- Modify: `src/features/sync/domain/sync-status.ts`
- Modify: `src/features/sync/server/sync-service.ts`
- Modify: `src/features/sync/server/sync-service.test.ts`

- [ ] **Step 1: Add failing contract test**

In `src/features/sync/api/sync-contracts.test.ts`, add a result schema test for
the new action:

```ts
it('accepts safe remote-open check results', () => {
  const syncStatusFixture = syncStatusSchema.parse({
    enabled: true,
    configured: true,
    tokenConfigured: true,
    tokenStatus: {
      provider: 'github:gist',
      configured: true,
      updatedAt: '2026-05-31T11:00:00.000Z',
      fingerprint: 'abcdef123456',
    },
    gistId: 'gist_1',
    isSyncing: false,
    lastSyncAt: null,
    lastSyncDirection: null,
    lastPullAt: null,
    lastPushAt: null,
    needsPush: false,
    lastBlockingReason: null,
    lastError: null,
    conflict: null,
  })
  const result = syncActionResultSchema.parse({
    action: 'check-remote-on-open',
    direction: null,
    outcome: 'no-change',
    reason: 'remote-unchanged',
    retryable: false,
    message: 'Remote check found no changes.',
    status: syncStatusFixture,
    occurredAt: '2026-05-31T12:00:00.000Z',
  })

  expect(result.action).toBe('check-remote-on-open')
})
```

- [ ] **Step 2: Add failing service tests**

In `src/features/sync/server/sync-service.test.ts`, add:

```ts
it('checkRemoteOnOpen clean-pulls changed remote data', async () => {
  const harness = createHarness()
  harness.setMetadata({
    enabled: true,
    gistId: 'gist_1',
    dirtySinceLastSync: false,
    lastRemoteVersion: 'remote_1',
  })
  harness.githubClient.getGist.mockResolvedValue(
    createGistSummary({
      id: 'gist_1',
      updatedAt: '2026-05-31T12:10:00.000Z',
      remoteVersion: 'remote_2',
      content: JSON.stringify(
        buildSyncEnvelope({
          backup,
          dataUpdatedAt: '2026-05-31T12:10:00.000Z',
        }),
      ),
    }),
  )

  await expect(harness.service.checkRemoteOnOpen()).resolves.toMatchObject({
    action: 'check-remote-on-open',
    direction: 'pull',
    outcome: 'success',
    message: 'Latest Gist data pulled.',
  })
  expect(harness.restoreBackup).toHaveBeenCalledWith(backup)
  expect(harness.broadcastInvalidation).toHaveBeenCalled()
})

it('checkRemoteOnOpen skips dirty local data without fetching remote', async () => {
  const harness = createHarness()
  harness.setMetadata({
    enabled: true,
    gistId: 'gist_1',
    dirtySinceLastSync: true,
  })

  await expect(harness.service.checkRemoteOnOpen()).resolves.toMatchObject({
    action: 'check-remote-on-open',
    direction: null,
    outcome: 'no-change',
    reason: 'local-dirty',
  })
  expect(harness.githubClient.getGist).not.toHaveBeenCalled()
})

it('checkRemoteOnOpen returns no-change when remote is unchanged', async () => {
  const harness = createHarness()
  harness.setMetadata({
    enabled: true,
    gistId: 'gist_1',
    dirtySinceLastSync: false,
    lastRemoteVersion: 'remote_1',
  })
  harness.githubClient.getGist.mockResolvedValue(
    createGistSummary({
      id: 'gist_1',
      remoteVersion: 'remote_1',
    }),
  )

  await expect(harness.service.checkRemoteOnOpen()).resolves.toMatchObject({
    action: 'check-remote-on-open',
    direction: null,
    outcome: 'no-change',
    reason: 'remote-unchanged',
  })
  expect(harness.restoreBackup).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Run failing contract and service tests**

Run:

```sh
npm test -- src/features/sync/api/sync-contracts.test.ts src/features/sync/server/sync-service.test.ts --run
```

Expected: FAIL because `check-remote-on-open` is not in the action schema and
the service method is missing.

- [ ] **Step 4: Add action type and service method**

In `src/features/sync/api/sync-contracts.ts`, add to `syncActionSchema`:

```ts
'check-remote-on-open',
```

In `src/features/sync/domain/sync-status.ts`, add to `SyncAction`:

```ts
| 'check-remote-on-open'
```

In `src/features/sync/server/sync-service.ts`, add:

```ts
async function checkRemoteOnOpen(): Promise<SyncActionResult> {
  return runAction('check-remote-on-open', null, async () => {
    const metadata = await deps.readMetadata()

    if (!metadata.enabled || !metadata.gistId) {
      return createActionResult({
        action: 'check-remote-on-open',
        direction: null,
        outcome: 'no-change',
        reason: 'not-configured',
        message: 'Remote check skipped: GitHub Gist sync is not configured.',
      })
    }

    if (metadata.dirtySinceLastSync) {
      return createActionResult({
        action: 'check-remote-on-open',
        direction: null,
        outcome: 'no-change',
        reason: 'local-dirty',
        message: 'Remote check skipped: local changes need to be pushed.',
      })
    }

    const client = await readConfiguredClient()
    const remote = await client.getGist(metadata.gistId)

    if (!hasRemoteChanged(remote, metadata)) {
      await deps.writeMetadata({
        lastSyncAt: deps.now().toISOString(),
        lastSyncDirection: 'no-change',
        lastRemoteVersion: remote.remoteVersion,
        lastRemoteUpdatedAt: remote.updatedAt,
        lastBlockingReason: null,
        lastError: null,
        lastAutoSyncAt: deps.now().toISOString(),
      })

      return createActionResult({
        action: 'check-remote-on-open',
        direction: null,
        outcome: 'no-change',
        reason: 'remote-unchanged',
        message: 'Remote check found no changes.',
      })
    }

    await pullRemote(remote)
    await deps.writeMetadata({
      autoSyncRetryAttempt: 0,
      lastAutoSyncAt: deps.now().toISOString(),
    })

    return createActionResult({
      action: 'check-remote-on-open',
      direction: 'pull',
      message: 'Latest Gist data pulled.',
    })
  })
}
```

Add `checkRemoteOnOpen` to the returned service object.

- [ ] **Step 5: Run contract and service tests**

Run:

```sh
npm test -- src/features/sync/api/sync-contracts.test.ts src/features/sync/server/sync-service.test.ts --run
```

Expected: PASS.

- [ ] **Step 6: Commit service check**

Run:

```sh
git add src/features/sync/api/sync-contracts.ts src/features/sync/api/sync-contracts.test.ts src/features/sync/domain/sync-status.ts src/features/sync/server/sync-service.ts src/features/sync/server/sync-service.test.ts
git commit -m "feat(sync): add safe remote open check"
```

---

### Task 4: Runtime Open Check And React Provider

**Files:**

- Modify: `src/extension/messaging.ts`
- Modify: `src/extension/background/runtime-policy.ts`
- Modify: `src/extension/background/runtime-policy.test.ts`
- Modify: `src/extension/background/register-handlers.ts`
- Modify: `src/extension/background/register-handlers.test.ts`
- Modify: `src/features/sync/api/sync-api.ts`
- Modify: `src/features/sync/api/sync-api.test.tsx`
- Create: `src/app/providers/sync-open-check.tsx`
- Create: `src/app/providers/sync-open-check.test.tsx`
- Modify: `src/app/providers/app-providers.tsx`
- Modify: `src/entrypoints/dashboard/main.tsx`
- Modify: `src/entrypoints/popup/main.tsx`
- Modify: `src/entrypoints/leetcode.content.tsx`

- [ ] **Step 1: Add failing runtime and provider tests**

In `src/extension/background/runtime-policy.test.ts`, add:

```ts
it('allows safe sync open checks from every UI surface', () => {
  for (const surface of ['popup', 'dashboard', 'content-script'] as const) {
    expect(canCallExtensionMethod('sync.checkRemoteOnOpen', surface)).toBe(true)
  }
})
```

In `src/features/sync/api/sync-api.test.tsx`, add:

```ts
it('checks remote on open through the claimed surface', async () => {
  sendMessageMock.mockResolvedValue(syncActionResultFixture)

  await checkRemoteOnOpenViaRuntime('popup')

  expect(sendMessageMock).toHaveBeenCalledWith('sync.checkRemoteOnOpen', {
    surface: 'popup',
  })
})
```

Create `src/app/providers/sync-open-check.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { SyncActionResult } from '@/features/sync/api/sync-contracts'

import { SyncOpenCheck } from './sync-open-check'

const checkRemoteOnOpen =
  vi.fn<(surface: 'popup') => Promise<SyncActionResult>>()

vi.mock('@/features/sync/api/sync-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/sync/api/sync-api')>()

  return {
    ...actual,
    checkRemoteOnOpenViaRuntime: (surface: 'popup') =>
      checkRemoteOnOpen(surface),
  }
})

describe('SyncOpenCheck', () => {
  it('runs the safe remote check once for the mounted surface', async () => {
    checkRemoteOnOpen.mockResolvedValue({
      action: 'check-remote-on-open',
      direction: null,
      outcome: 'no-change',
      reason: 'remote-unchanged',
      retryable: false,
      message: 'Remote check found no changes.',
      status: {
        enabled: true,
        configured: true,
        tokenConfigured: true,
        tokenStatus: {
          provider: 'github:gist',
          configured: true,
          updatedAt: '2026-05-31T11:00:00.000Z',
          fingerprint: 'abcdef123456',
        },
        gistId: 'gist_1',
        isSyncing: false,
        lastSyncAt: null,
        lastSyncDirection: null,
        lastPullAt: null,
        lastPushAt: null,
        needsPush: false,
        lastBlockingReason: null,
        lastError: null,
        conflict: null,
      },
      occurredAt: '2026-05-31T12:00:00.000Z',
    })

    render(
      <QueryClientProvider client={new QueryClient()}>
        <SyncOpenCheck surface="popup" />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(checkRemoteOnOpen).toHaveBeenCalledWith('popup')
    })
  })
})
```

- [ ] **Step 2: Run failing runtime/provider tests**

Run:

```sh
npm test -- src/extension/background/runtime-policy.test.ts src/features/sync/api/sync-api.test.tsx src/app/providers/sync-open-check.test.tsx --run
```

Expected: FAIL because runtime method, API fetcher, and provider are missing.

- [ ] **Step 3: Add runtime method and authorization**

In `src/extension/messaging.ts`, add `sync.checkRemoteOnOpen` to `ProtocolMap`:

```ts
'sync.checkRemoteOnOpen'(request: SyncRequest): SyncActionResult
```

In `src/extension/background/runtime-policy.ts`, add:

```ts
'sync.checkRemoteOnOpen': ['popup', 'dashboard', 'content-script'],
```

In `src/extension/background/register-handlers.ts`, register:

```ts
onMessage('sync.checkRemoteOnOpen', ({ data, sender }) => {
  const request = syncRequestSchema.parse(data)

  assertCanSenderCallExtensionMethod(
    'sync.checkRemoteOnOpen',
    request.surface,
    sender,
  )
  return getAppDb().then(async ({ db }) =>
    parseSyncActionResult(
      await runQueuedSyncAction(db, (service) => service.checkRemoteOnOpen()),
    ),
  )
})
```

- [ ] **Step 4: Add API fetcher and provider**

In `src/features/sync/api/sync-api.ts`, add:

```ts
export function checkRemoteOnOpenViaRuntime(surface: UiSurface) {
  return sendMessage('sync.checkRemoteOnOpen', { surface })
}
```

Create `src/app/providers/sync-open-check.tsx`:

```tsx
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import type { UiSurface } from '@/extension/messaging'
import { checkRemoteOnOpenViaRuntime } from '@/features/sync/api/sync-api'
import { invalidateTaggedQueries } from '@/platform/query/cache-invalidation'

const broadPullTags = [
  'settings',
  'problems',
  'practice',
  'queue',
  'tracks',
  'app-shell',
] as const

export function SyncOpenCheck({ surface }: { surface: UiSurface }) {
  const queryClient = useQueryClient()

  useEffect(() => {
    let active = true

    void checkRemoteOnOpenViaRuntime(surface)
      .then((result) => {
        if (
          active &&
          result.direction === 'pull' &&
          result.outcome === 'success'
        ) {
          invalidateTaggedQueries(queryClient, broadPullTags)
        }
      })
      .catch(() => {
        // Background records sync errors. Opening a surface should not fail UI.
      })

    return () => {
      active = false
    }
  }, [queryClient, surface])

  return null
}
```

Modify `src/app/providers/app-providers.tsx` to require `surface: UiSurface` and
render `<SyncOpenCheck surface={surface} />` inside the `QueryClientProvider`.

Update entrypoints:

```tsx
<AppProviders surface="dashboard">
<AppProviders surface="popup">
<AppProviders surface="content-script">
```

- [ ] **Step 5: Run runtime/provider tests**

Run:

```sh
npm test -- src/extension/background/runtime-policy.test.ts src/extension/background/register-handlers.test.ts src/features/sync/api/sync-api.test.tsx src/app/providers/sync-open-check.test.tsx --run
```

Expected: PASS after updating existing tests that instantiate `AppProviders` to
pass a surface.

- [ ] **Step 6: Commit open-check runtime**

Run:

```sh
git add src/extension/messaging.ts src/extension/background/runtime-policy.ts src/extension/background/runtime-policy.test.ts src/extension/background/register-handlers.ts src/extension/background/register-handlers.test.ts src/features/sync/api/sync-api.ts src/features/sync/api/sync-api.test.tsx src/app/providers/sync-open-check.tsx src/app/providers/sync-open-check.test.tsx src/app/providers/app-providers.tsx src/entrypoints/dashboard/main.tsx src/entrypoints/popup/main.tsx src/entrypoints/leetcode.content.tsx
git commit -m "feat(sync): check remote data on surface open"
```

---

### Task 5: Auto-Sync Orchestrator And Mutation Scheduling

**Files:**

- Create: `src/extension/background/sync-auto-sync.ts`
- Create: `src/extension/background/sync-auto-sync.test.ts`
- Modify: `src/extension/background/register-handlers.ts`
- Modify: `src/extension/background/register-handlers.test.ts`

- [ ] **Step 1: Write failing auto-sync orchestrator tests**

Create `src/extension/background/sync-auto-sync.test.ts` with tests asserting:

```ts
expect(deps.scheduler.schedule).toHaveBeenCalledWith('sync:auto-push', {
  delayInMinutes: 0.5,
})
expect(deps.runSafePush).toHaveBeenCalledWith({
  confirmRemoteOverwrite: false,
})
expect(deps.scheduler.schedule).toHaveBeenCalledWith('sync:retry', {
  delayInMinutes: 5,
})
expect(deps.runCleanPullCheck).not.toHaveBeenCalled()
```

Use a local `createDeps()` fixture with mocked `scheduler`, `readMetadata`,
`writeMetadata`, `runSafePush`, and `runCleanPullCheck`.

- [ ] **Step 2: Run failing auto-sync tests**

Run:

```sh
npm test -- src/extension/background/sync-auto-sync.test.ts --run
```

Expected: FAIL because `sync-auto-sync.ts` does not exist.

- [ ] **Step 3: Implement auto-sync orchestration**

Create `src/extension/background/sync-auto-sync.ts`:

```ts
import type { SyncActionResult } from '@/features/sync/api/sync-contracts'
import type { SyncMetadata } from '@/features/sync/data/sync-metadata-store'
import { readAutoSyncRetryDelayMinutes } from '@/features/sync/domain/sync-auto-retry'

import type { AlarmScheduler } from './scheduler/alarm-scheduler'

export const syncAutoPushAlarmName = 'sync:auto-push'
export const syncRetryAlarmName = 'sync:retry'
export const syncPollAlarmName = 'sync:poll'
export const syncAutoPushDelayMinutes = 0.5
export const syncPollPeriodMinutes = 10

export type SyncAutoSyncDependencies = {
  now: () => Date
  readMetadata: () => Promise<SyncMetadata>
  writeMetadata: (patch: Partial<SyncMetadata>) => Promise<SyncMetadata>
  runCleanPullCheck: () => Promise<SyncActionResult>
  runSafePush: (input: {
    confirmRemoteOverwrite: false
  }) => Promise<SyncActionResult>
  scheduler: Pick<
    AlarmScheduler,
    'clear' | 'register' | 'repairStartupAlarms' | 'schedule'
  >
}

export function createSyncAutoSync(deps: SyncAutoSyncDependencies) {
  async function scheduleAutoPushAfterMutation() {
    const metadata = await deps.readMetadata()

    if (!metadata.enabled || !metadata.gistId) {
      return
    }

    await deps.scheduler.schedule(syncAutoPushAlarmName, {
      delayInMinutes: syncAutoPushDelayMinutes,
    })
  }

  async function runAutoPush() {
    const metadata = await deps.readMetadata()

    if (!metadata.enabled || !metadata.gistId || !metadata.dirtySinceLastSync) {
      return
    }

    const result = await deps.runSafePush({ confirmRemoteOverwrite: false })

    if (result.outcome === 'success' || result.outcome === 'no-change') {
      await deps.writeMetadata({
        autoSyncRetryAttempt: 0,
        lastAutoSyncAt: deps.now().toISOString(),
      })
      await deps.scheduler.clear(syncRetryAlarmName)
      return
    }

    if (
      result.outcome === 'confirmation-required' ||
      result.reason === 'remote-changed'
    ) {
      await deps.scheduler.clear(syncAutoPushAlarmName)
      await deps.scheduler.clear(syncRetryAlarmName)
      return
    }

    if (result.outcome === 'error' && result.retryable) {
      const attempt = metadata.autoSyncRetryAttempt
      await deps.writeMetadata({
        autoSyncRetryAttempt: attempt + 1,
        lastAutoSyncAt: deps.now().toISOString(),
      })
      await deps.scheduler.schedule(syncRetryAlarmName, {
        delayInMinutes: readAutoSyncRetryDelayMinutes(attempt),
      })
      return
    }

    await deps.scheduler.clear(syncRetryAlarmName)
  }

  async function runCleanPullCheck() {
    const metadata = await deps.readMetadata()

    if (!metadata.enabled || !metadata.gistId || metadata.dirtySinceLastSync) {
      return
    }

    const result = await deps.runCleanPullCheck()

    if (result.direction === 'pull' && result.outcome === 'success') {
      await deps.writeMetadata({
        autoSyncRetryAttempt: 0,
        lastAutoSyncAt: deps.now().toISOString(),
      })
      await deps.scheduler.clear(syncRetryAlarmName)
    }
  }

  async function clearPendingAutomaticSync() {
    await deps.scheduler.clear(syncAutoPushAlarmName)
    await deps.scheduler.clear(syncRetryAlarmName)
  }

  function registerJobs() {
    deps.scheduler.register({
      name: syncAutoPushAlarmName,
      run: runAutoPush,
    })
    deps.scheduler.register({
      name: syncRetryAlarmName,
      run: runAutoPush,
    })
    deps.scheduler.register({
      name: syncPollAlarmName,
      run: runCleanPullCheck,
      startup: {
        delayInMinutes: syncPollPeriodMinutes,
        periodInMinutes: syncPollPeriodMinutes,
      },
    })
  }

  return {
    clearPendingAutomaticSync,
    registerJobs,
    repairStartupAlarms: deps.scheduler.repairStartupAlarms,
    runAutoPush,
    runCleanPullCheck,
    scheduleAutoPushAfterMutation,
  }
}
```

- [ ] **Step 4: Run auto-sync tests**

Run:

```sh
npm test -- src/extension/background/sync-auto-sync.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Wire auto-sync into background handlers**

In `src/extension/background/register-handlers.ts`, import:

```ts
import { createAlarmScheduler } from './scheduler/alarm-scheduler'
import { createSyncAutoSync } from './sync-auto-sync'
```

Create the scheduler and auto-sync instance near module scope. Use
`runQueuedSyncAction` so alarm jobs share the existing mutation queue:

```ts
const alarmScheduler = createAlarmScheduler()
const syncAutoSync = createSyncAutoSync({
  scheduler: alarmScheduler,
  now: () => new Date(),
  readMetadata: readSyncMetadata,
  writeMetadata: writeSyncMetadata,
  runSafePush: async (input) => {
    const { db } = await getAppDb()
    return parseSyncActionResult(
      await runQueuedSyncAction(db, (service) => service.pushLocal(input)),
    )
  },
  runCleanPullCheck: async () => {
    const { db } = await getAppDb()
    return parseSyncActionResult(
      await runQueuedSyncAction(db, (service) => service.checkRemoteOnOpen()),
    )
  },
})
```

At the start of `registerBackgroundHandlers()`:

```ts
syncAutoSync.registerJobs()
void syncAutoSync.repairStartupAlarms()
```

In `runDbMutation`, after `afterFlush?.(result)`:

```ts
if (syncMode === 'mark-dirty') {
  await syncAutoSync.scheduleAutoPushAfterMutation()
}
```

After successful manual `sync.pullLatest`, `sync.pushLocal`, and
`sync.createGithubGist`, run:

```ts
await syncAutoSync.clearPendingAutomaticSync()
```

Also clear pending automatic sync after `sync.deleteGithubToken` and after
`sync.setEnabled(false)`.

- [ ] **Step 6: Add background integration tests**

In `src/extension/background/register-handlers.test.ts`, add:

```ts
it('repairs sync auto alarms when background handlers register', () => {
  expect(backgroundMocks.syncAutoSync.registerJobs).toHaveBeenCalledTimes(1)
  expect(
    backgroundMocks.syncAutoSync.repairStartupAlarms,
  ).toHaveBeenCalledTimes(1)
})

it('schedules auto-push after a local DB mutation flushes', async () => {
  await sendRuntimeMessage('settings.updateSettings', {
    surface: 'dashboard',
    patch: {
      practice: {
        mode: 'freePractice',
      },
    },
  })

  expect(backgroundMocks.flushDbSnapshot).toHaveBeenCalled()
  expect(
    backgroundMocks.syncAutoSync.scheduleAutoPushAfterMutation,
  ).toHaveBeenCalledTimes(1)
})

it('clears pending automatic sync after a manual push succeeds', async () => {
  backgroundMocks.syncService.pushLocal.mockResolvedValue({
    ...syncActionResult,
    action: 'push-local',
    direction: 'push',
    outcome: 'success',
  })

  await sendRuntimeMessage('sync.pushLocal', {
    surface: 'dashboard',
    confirmRemoteOverwrite: false,
  })

  expect(
    backgroundMocks.syncAutoSync.clearPendingAutomaticSync,
  ).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 7: Run background integration tests**

Run:

```sh
npm test -- src/extension/background/register-handlers.test.ts src/extension/background/sync-auto-sync.test.ts --run
```

Expected: PASS.

- [ ] **Step 8: Commit auto-sync orchestration**

Run:

```sh
git add src/extension/background/sync-auto-sync.ts src/extension/background/sync-auto-sync.test.ts src/extension/background/register-handlers.ts src/extension/background/register-handlers.test.ts
git commit -m "feat(sync): schedule automatic gist sync"
```

---

### Task 6: UI Status Guardrails And Documentation

**Files:**

- Modify: `src/features/sync/components/github-sync-panel.test.tsx`
- Modify: `src/features/sync/components/dashboard-sync-actions.test.tsx`
- Modify: `docs/product.md`
- Modify: `docs/architecture.md`
- Modify: `docs/testing.md`
- Modify: `docs/superpowers/README.md`

- [ ] **Step 1: Add UI guardrail tests**

Add component tests that assert auto-sync conflicts or retryable errors render as
status only and do not open force dialogs until the user clicks manual pull or
push:

```tsx
expect(screen.getByText(/sync conflict detected/i)).toBeVisible()
expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
```

- [ ] **Step 2: Run UI tests**

Run:

```sh
npm test -- src/features/sync/components/github-sync-panel.test.tsx src/features/sync/components/dashboard-sync-actions.test.tsx --run
```

Expected: PASS.

- [ ] **Step 3: Update docs**

Update `docs/product.md` Sync behavior with:

```md
Local writes save locally first and schedule a safe background push through
Chrome alarms. Opening popup, dashboard, or overlay surfaces performs a safe
remote check and clean-pulls changed Gist data only when local data has no
unpushed changes.

Automatic sync never force-overwrites local data or the Gist. Dirty local data
blocks automatic pull, changed remote data blocks automatic push, and manual
force pull or force push remains the recovery path after confirmation.
```

Update `docs/architecture.md` with scheduler ownership and auto-sync flow:

```md
Automatic Gist sync is orchestrated in the background layer. After a local
mutation commits, sync metadata is marked dirty, the database snapshot is
flushed, normal invalidation is broadcast, and an alarm-backed auto-push is
scheduled.
```

Update `docs/testing.md` with two-profile auto-sync smoke steps:

```md
After changing local data in one browser/profile, wait for the auto-push alarm
or trigger it in development, then open or reload the second browser/profile.
Expected: the second clean profile pulls the latest Gist data without a manual
pull.
```

In `docs/superpowers/README.md`, add this plan under Plans.

- [ ] **Step 4: Run docs and UI validation**

Run:

```sh
npm test -- src/features/sync/components/github-sync-panel.test.tsx src/features/sync/components/dashboard-sync-actions.test.tsx --run
npx prettier --check docs/product.md docs/architecture.md docs/testing.md docs/superpowers/README.md docs/superpowers/plans/2026-05-31-auto-gist-sync.md
```

Expected: PASS.

- [ ] **Step 5: Commit docs and UI guardrails**

Run:

```sh
git add src/features/sync/components/github-sync-panel.test.tsx src/features/sync/components/dashboard-sync-actions.test.tsx docs/product.md docs/architecture.md docs/testing.md docs/superpowers/README.md docs/superpowers/plans/2026-05-31-auto-gist-sync.md
git commit -m "docs(sync): document automatic gist sync"
```

---

### Task 7: Full Verification

**Files:**

- No new files.

- [ ] **Step 1: Run focused sync/background tests**

Run:

```sh
npm test -- src/features/sync/domain/sync-auto-retry.test.ts src/features/sync/data/sync-metadata-store.test.ts src/features/sync/api/sync-contracts.test.ts src/features/sync/api/sync-api.test.tsx src/features/sync/server/sync-service.test.ts src/extension/background/scheduler/alarm-scheduler.test.ts src/extension/background/sync-auto-sync.test.ts src/extension/background/runtime-policy.test.ts src/extension/background/register-handlers.test.ts src/app/providers/sync-open-check.test.tsx src/features/sync/components/github-sync-panel.test.tsx src/features/sync/components/dashboard-sync-actions.test.tsx --run
```

Expected: PASS.

- [ ] **Step 2: Run full project validation**

Run:

```sh
npm run check
```

Expected: PASS.

- [ ] **Step 3: Run touched-file formatting check**

Run:

```sh
npx prettier --check wxt.config.ts src/extension/background/scheduler/alarm-scheduler.ts src/extension/background/scheduler/alarm-scheduler.test.ts src/features/sync/domain/sync-auto-retry.ts src/features/sync/domain/sync-auto-retry.test.ts src/features/sync/data/sync-metadata-store.ts src/features/sync/data/sync-metadata-store.test.ts src/features/sync/api/sync-contracts.ts src/features/sync/api/sync-contracts.test.ts src/features/sync/domain/sync-status.ts src/features/sync/server/sync-service.ts src/features/sync/server/sync-service.test.ts src/extension/messaging.ts src/extension/background/runtime-policy.ts src/extension/background/runtime-policy.test.ts src/extension/background/register-handlers.ts src/extension/background/register-handlers.test.ts src/features/sync/api/sync-api.ts src/features/sync/api/sync-api.test.tsx src/app/providers/sync-open-check.tsx src/app/providers/sync-open-check.test.tsx src/app/providers/app-providers.tsx src/entrypoints/dashboard/main.tsx src/entrypoints/popup/main.tsx src/entrypoints/leetcode.content.tsx src/extension/background/sync-auto-sync.ts src/extension/background/sync-auto-sync.test.ts docs/product.md docs/architecture.md docs/testing.md docs/superpowers/README.md docs/superpowers/plans/2026-05-31-auto-gist-sync.md
```

Expected: PASS. Use touched-file Prettier because repo-wide `npm run format`
has previously been blocked by unrelated `.claude` artifacts.

- [ ] **Step 4: Inspect final diff**

Run:

```sh
git diff --stat HEAD
git diff --check
```

Expected: the stat only includes auto-sync, scheduler, runtime, provider, tests,
and docs files. `git diff --check` prints no output and exits successfully.

- [ ] **Step 5: Final commit if validation changed files**

Run only if verification required small fixes:

```sh
git add <fixed-files>
git commit -m "test(sync): verify automatic gist sync"
```

Expected: a small final verification commit or no new commit if no files
changed.

---

## Self-Review

- Spec coverage: scheduler foundation, `alarms` permission, auto-push after
  mutation, clean-pull on open, retry backoff, force precedence, status
  guardrails, docs, and verification are all mapped to tasks.
- Scope boundary: this plan does not implement notifications, raw Gist fallback,
  entity merge sync, hosted services, or new retry dependencies.
- Type consistency: alarm names, `checkRemoteOnOpen`, `autoSyncRetryAttempt`,
  and `lastAutoSyncAt` are introduced before later tasks use them.
