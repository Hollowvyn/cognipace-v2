# Directional GitHub Gist Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the vague GitHub Gist `Sync now` path with explicit manual `Pull latest` and `Push local` actions, cloud up/down dashboard shortcuts, redacted directional results, and focused TDD coverage.

**Architecture:** Keep sync ownership in `src/features/sync`: contracts and hooks in `api`, orchestration in `server`, metadata in `data`, pure status types in `domain`, and Settings/header UI in `components`. React surfaces call feature hooks over extension runtime methods; runtime handlers call the background sync service and parse all results with Zod. This pass is manual-first: local mutations mark data dirty but do not auto-push, and open/reload checks are removed from the visible/active path.

**Tech Stack:** WXT Chrome MV3, React 19, TypeScript, Zod, TanStack Query, Chrome runtime/storage APIs, existing GitHub Gist client, existing backup/restore service, Vitest, React Testing Library, lucide-react.

---

## File Structure

- Modify `src/features/sync/api/sync-contracts.ts`: add directional action/result schemas, push request schema, richer status fields, and remove old visible smart-sync contract exports.
- Create `src/features/sync/api/sync-contracts.test.ts`: assert the public directional result shape and redaction-sensitive structure.
- Modify `src/features/sync/api/sync-api.ts`: add `pullLatestViaRuntime`, `pushLocalViaRuntime`, `usePullLatest`, `usePushLocal`, and outcome-aware invalidation.
- Modify `src/features/sync/api/sync-api.test.tsx`: cover directional runtime calls and invalidation rules.
- Modify `src/features/sync/api/sync-serializers.ts`: parse richer action results where serializers are used.
- Modify `src/features/sync/domain/sync-status.ts`: add sync action, outcome, reason, result, and status field types.
- Modify `src/features/sync/data/sync-metadata-store.ts`: add `lastPullAt`, `lastPushAt`, and `lastBlockingReason` metadata with defaults.
- Modify `src/features/sync/data/sync-metadata-store.test.ts`: prove new metadata defaults and old metadata migration.
- Modify `src/features/sync/server/sync-service.ts`: add `pullLatest` and `pushLocal`, return structured results, remove active automatic sync behavior, and keep local dirty marking.
- Modify `src/features/sync/server/sync-service.test.ts`: drive pull/push service behavior with red tests first.
- Modify `src/extension/messaging.ts`: add `sync.pullLatest` and `sync.pushLocal`, remove public `sync.syncNow`, `sync.resolveConflict`, and `sync.checkOnOpen` protocol entries.
- Modify `src/extension/background/runtime-policy.ts`: authorize only dashboard for directional sync actions.
- Modify `src/extension/background/runtime-policy.test.ts`: assert the new dashboard-only sync actions and removed smart-sync methods.
- Modify `src/extension/background/register-handlers.ts`: register directional handlers and remove mutation/open auto-sync scheduling.
- Modify `src/extension/background/register-handlers.test.ts`: verify directional handlers, queued mutation ordering, and dirty-mark-only local mutations.
- Modify `src/features/sync/hooks/use-github-sync-controller.ts`: expose `onPullLatest` and `onPushLocal`, remove `onSyncNow` and `onResolveConflict`.
- Modify `src/features/sync/hooks/use-github-sync-controller.test.tsx`: cover directional hook calls and pull invalidation.
- Modify `src/features/sync/components/github-sync-panel.tsx`: replace `Sync now` and abstract conflict resolution with `Pull latest`, `Push local`, and `Overwrite Gist` confirmation.
- Modify `src/features/sync/components/github-sync-panel.test.tsx`: assert Settings structure, confirmation, blocked pull, and no visible `Sync now`.
- Modify `src/features/sync/components/github-sync-settings-section.test.tsx`: update mocked action structure.
- Create `src/features/sync/components/dashboard-sync-actions.tsx`: cloud down/up icon buttons for dashboard header.
- Create `src/features/sync/components/dashboard-sync-actions.test.tsx`: component-level behavior for accessible buttons and safe confirmation-required handling.
- Modify `src/features/sync/index.ts`: export new hooks/types/components and remove old action prop exports.
- Create `src/app/dashboard/components/dashboard-header-actions.tsx`: compose sync shortcuts with the existing theme button.
- Modify `src/app/dashboard/dashboard-shell.tsx`: provide `headerActions` instead of a theme-only action.
- Modify `src/app/dashboard/screens/analytics-page.tsx`: consume `headerActions`.
- Modify `src/app/dashboard/screens/library-page.tsx`: consume `headerActions`.
- Modify `src/app/dashboard/screens/overview-page.tsx`: consume `headerActions`.
- Modify `src/app/dashboard/screens/settings-page.tsx`: consume `headerActions`.
- Modify `src/app/dashboard/screens/tracks-page.tsx`: consume `headerActions`.
- Modify `src/app/dashboard/routes.test.tsx`: add sync status defaults and assert header cloud actions call runtime methods.
- Modify `docs/product.md`: describe manual directional Gist sync for current behavior.
- Modify `docs/architecture.md`: update sync runtime method names and manual-first mutation behavior.
- Modify `docs/testing.md`: replace `Sync now` smoke steps with `Pull latest` and `Push local`.
- Modify `docs/superpowers/README.md`: add this plan link.

## Task 1: Contracts And Metadata Shape

**Files:**

- Modify: `src/features/sync/api/sync-contracts.ts`
- Create: `src/features/sync/api/sync-contracts.test.ts`
- Modify: `src/features/sync/domain/sync-status.ts`
- Modify: `src/features/sync/data/sync-metadata-store.ts`
- Modify: `src/features/sync/data/sync-metadata-store.test.ts`

- [ ] **Step 1: Write failing contract tests**

Create `src/features/sync/api/sync-contracts.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  syncActionResultSchema,
  syncPushLocalRequestSchema,
} from './sync-contracts'

describe('sync contracts', () => {
  it('validates directional action instrumentation without secret fields', () => {
    const parsed = syncActionResultSchema.parse({
      action: 'pull-latest',
      direction: 'pull',
      outcome: 'blocked',
      reason: 'local-dirty',
      retryable: false,
      message: 'Pull blocked: local changes have not been pushed.',
      occurredAt: '2026-05-26T12:30:00.000Z',
      status: {
        enabled: true,
        configured: true,
        tokenConfigured: true,
        tokenStatus: {
          provider: 'github:gist',
          configured: true,
          updatedAt: '2026-05-26T12:00:00.000Z',
          fingerprint: 'abcdef123456',
        },
        gistId: 'gist_1',
        isSyncing: false,
        lastSyncAt: '2026-05-26T12:00:00.000Z',
        lastSyncDirection: 'push',
        lastPullAt: null,
        lastPushAt: '2026-05-26T12:00:00.000Z',
        needsPush: true,
        lastBlockingReason: 'local-dirty',
        lastError: null,
        conflict: null,
      },
    })

    expect(parsed).toMatchObject({
      action: 'pull-latest',
      direction: 'pull',
      outcome: 'blocked',
      reason: 'local-dirty',
      retryable: false,
    })
    expect(JSON.stringify(parsed)).not.toMatch(
      /ghp_|github_pat_|Bearer|secret|token-value/i,
    )
  })

  it('requires explicit confirmation for overwrite pushes at the request boundary', () => {
    expect(
      syncPushLocalRequestSchema.parse({
        surface: 'dashboard',
      }),
    ).toEqual({
      surface: 'dashboard',
      confirmRemoteOverwrite: false,
    })
    expect(
      syncPushLocalRequestSchema.parse({
        surface: 'dashboard',
        confirmRemoteOverwrite: true,
      }),
    ).toEqual({
      surface: 'dashboard',
      confirmRemoteOverwrite: true,
    })
    expect(() =>
      syncPushLocalRequestSchema.parse({
        surface: 'popup',
        confirmRemoteOverwrite: true,
      }),
    ).toThrow()
  })
})
```

- [ ] **Step 2: Write failing metadata tests**

In `src/features/sync/data/sync-metadata-store.test.ts`, update the default metadata assertion:

```ts
await expect(readSyncMetadata()).resolves.toMatchObject({
  enabled: false,
  gistId: null,
  dirtySinceLastSync: false,
  lastPullAt: null,
  lastPushAt: null,
  lastBlockingReason: null,
  conflict: null,
})
```

Add a test proving old stored metadata remains readable:

```ts
it('adds directional defaults when reading metadata written before directional sync', async () => {
  storage.set('cognipace_sync_metadata_v1', {
    enabled: true,
    gistId: 'gist_1',
    lastSyncAt: '2026-05-26T12:00:00.000Z',
    lastSyncDirection: 'push',
    lastRemoteVersion: 'remote_1',
    lastRemoteUpdatedAt: '2026-05-26T12:00:00.000Z',
    localDataUpdatedAt: '2026-05-26T11:55:00.000Z',
    dirtySinceLastSync: false,
    lastError: null,
    conflict: null,
  })

  await expect(readSyncMetadata()).resolves.toMatchObject({
    enabled: true,
    gistId: 'gist_1',
    lastPullAt: null,
    lastPushAt: null,
    lastBlockingReason: null,
  })
})
```

- [ ] **Step 3: Run the focused tests and verify failure**

Run:

```bash
npm run test -- src/features/sync/api/sync-contracts.test.ts src/features/sync/data/sync-metadata-store.test.ts
```

Expected: fail because `syncPushLocalRequestSchema`, action result fields, status fields, and metadata fields do not exist.

- [ ] **Step 4: Implement contract and metadata types**

In `src/features/sync/domain/sync-status.ts`, add these types above `SyncStatus`:

```ts
export type SyncAction =
  | 'validate-token'
  | 'save-token'
  | 'delete-token'
  | 'create-gist'
  | 'connect-gist'
  | 'set-enabled'
  | 'pull-latest'
  | 'push-local'

export type SyncActionDirection = 'pull' | 'push' | null

export type SyncActionOutcome =
  | 'success'
  | 'no-change'
  | 'blocked'
  | 'confirmation-required'
  | 'error'

export type SyncActionReason =
  | 'not-configured'
  | 'local-dirty'
  | 'remote-changed'
  | 'remote-unchanged'
  | 'auth'
  | 'permission'
  | 'missing-gist'
  | 'invalid-remote'
  | 'unsupported-schema'
  | 'network'
  | 'rate-limit'
  | 'already-running'
  | 'unknown'
```

Extend `SyncStatus`:

```ts
export interface SyncStatus {
  enabled: boolean
  configured: boolean
  tokenConfigured: boolean
  tokenStatus: SecretStatus
  gistId: string | null
  isSyncing: boolean
  lastSyncAt: string | null
  lastSyncDirection: SyncDirection | null
  lastPullAt: string | null
  lastPushAt: string | null
  needsPush: boolean
  lastBlockingReason: SyncActionReason | null
  lastError: SyncErrorSummary | null
  conflict: SyncConflictSummary | null
}

export interface SyncActionResult {
  action: SyncAction
  direction: SyncActionDirection
  outcome: SyncActionOutcome
  reason: SyncActionReason | null
  retryable: boolean
  message: string
  status: SyncStatus
  occurredAt: string
}
```

In `src/features/sync/api/sync-contracts.ts`, add literal schemas and update `syncStatusSchema` and `syncActionResultSchema`:

```ts
export const syncActionSchema = z.enum([
  'validate-token',
  'save-token',
  'delete-token',
  'create-gist',
  'connect-gist',
  'set-enabled',
  'pull-latest',
  'push-local',
])

export const syncActionDirectionSchema = z.enum(['pull', 'push']).nullable()

export const syncActionOutcomeSchema = z.enum([
  'success',
  'no-change',
  'blocked',
  'confirmation-required',
  'error',
])

export const syncActionReasonSchema = z.enum([
  'not-configured',
  'local-dirty',
  'remote-changed',
  'remote-unchanged',
  'auth',
  'permission',
  'missing-gist',
  'invalid-remote',
  'unsupported-schema',
  'network',
  'rate-limit',
  'already-running',
  'unknown',
])

export const syncPushLocalRequestSchema = z.strictObject({
  surface: z.literal('dashboard'),
  confirmRemoteOverwrite: z.boolean().default(false),
})
```

Extend `syncStatusSchema`:

```ts
lastPullAt: z.iso.datetime().nullable(),
lastPushAt: z.iso.datetime().nullable(),
needsPush: z.boolean(),
lastBlockingReason: syncActionReasonSchema.nullable(),
```

Replace `syncActionResultSchema` with:

```ts
export const syncActionResultSchema = z.strictObject({
  action: syncActionSchema,
  direction: syncActionDirectionSchema,
  outcome: syncActionOutcomeSchema,
  reason: syncActionReasonSchema.nullable(),
  retryable: z.boolean(),
  message: z.string(),
  status: syncStatusSchema,
  occurredAt: z.iso.datetime(),
})
```

Export `SyncPushLocalRequest` with the other request types.

In `src/features/sync/data/sync-metadata-store.ts`, import `syncActionReasonSchema` and extend `syncMetadataSchema`:

```ts
lastPullAt: z.iso.datetime().nullable().default(null),
lastPushAt: z.iso.datetime().nullable().default(null),
lastBlockingReason: syncActionReasonSchema.nullable().default(null),
```

Extend `defaultSyncMetadata`:

```ts
lastPullAt: null,
lastPushAt: null,
lastBlockingReason: null,
```

In `markLocalDataChanged`, keep the existing dirty write and clear blocking state:

```ts
return writeSyncMetadata({
  localDataUpdatedAt: now.toISOString(),
  dirtySinceLastSync: true,
  lastBlockingReason: null,
  lastError: null,
})
```

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
npm run test -- src/features/sync/api/sync-contracts.test.ts src/features/sync/data/sync-metadata-store.test.ts
```

Expected: pass.

Commit:

```bash
git add src/features/sync/api/sync-contracts.ts src/features/sync/api/sync-contracts.test.ts src/features/sync/domain/sync-status.ts src/features/sync/data/sync-metadata-store.ts src/features/sync/data/sync-metadata-store.test.ts
git commit -m "feat: define directional sync contracts"
```

## Task 2: Directional Sync Service

**Files:**

- Modify: `src/features/sync/server/sync-service.ts`
- Modify: `src/features/sync/server/sync-service.test.ts`

- [ ] **Step 1: Write failing `pullLatest` service tests**

In `src/features/sync/server/sync-service.test.ts`, add these tests inside the
existing `describe('sync service', () => {})` block:

```ts
it('pullLatest restores remote data when local is clean and remote changed', async () => {
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
      updatedAt: '2026-05-26T12:10:00.000Z',
      remoteVersion: 'remote_2',
      content: JSON.stringify(
        buildSyncEnvelope({
          backup,
          dataUpdatedAt: '2026-05-26T12:10:00.000Z',
        }),
      ),
    }),
  )

  await expect(harness.service.pullLatest()).resolves.toMatchObject({
    action: 'pull-latest',
    direction: 'pull',
    outcome: 'success',
    reason: null,
    retryable: false,
    message: 'Latest Gist data pulled.',
  })
  expect(harness.restoreBackup).toHaveBeenCalledWith(backup)
  expect(harness.flushDbSnapshot).toHaveBeenCalled()
  expect(harness.broadcastInvalidation).toHaveBeenCalled()
  expect(harness.getMetadata()).toMatchObject({
    dirtySinceLastSync: false,
    lastPullAt: currentTime,
    lastRemoteVersion: 'remote_2',
    lastSyncDirection: 'pull',
  })
})

it('pullLatest blocks dirty local data without restoring remote data', async () => {
  const harness = createHarness()
  harness.setMetadata({
    enabled: true,
    gistId: 'gist_1',
    dirtySinceLastSync: true,
    localDataUpdatedAt: '2026-05-26T12:05:00.000Z',
    lastRemoteVersion: 'remote_1',
  })

  await expect(harness.service.pullLatest()).resolves.toMatchObject({
    action: 'pull-latest',
    direction: 'pull',
    outcome: 'blocked',
    reason: 'local-dirty',
    retryable: false,
    message: 'Pull blocked: local changes have not been pushed.',
  })
  expect(harness.githubClient.getGist).not.toHaveBeenCalled()
  expect(harness.restoreBackup).not.toHaveBeenCalled()
  expect(harness.getMetadata()).toMatchObject({
    dirtySinceLastSync: true,
    lastBlockingReason: 'local-dirty',
  })
})

it('pullLatest returns no-change when remote is unchanged', async () => {
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
      updatedAt: '2026-05-26T12:00:00.000Z',
      remoteVersion: 'remote_1',
    }),
  )

  await expect(harness.service.pullLatest()).resolves.toMatchObject({
    action: 'pull-latest',
    direction: 'pull',
    outcome: 'no-change',
    reason: 'remote-unchanged',
    retryable: false,
    message: 'No remote changes.',
  })
  expect(harness.restoreBackup).not.toHaveBeenCalled()
  expect(harness.getMetadata()).toMatchObject({
    lastSyncAt: currentTime,
    lastSyncDirection: 'no-change',
    lastBlockingReason: null,
  })
})
```

- [ ] **Step 2: Write failing `pushLocal` service tests**

Add these tests:

```ts
it('pushLocal writes local backup when remote is unchanged', async () => {
  const harness = createHarness()
  harness.setMetadata({
    enabled: true,
    gistId: 'gist_1',
    dirtySinceLastSync: true,
    localDataUpdatedAt: '2026-05-26T12:05:00.000Z',
    lastRemoteVersion: 'remote_1',
  })
  harness.githubClient.getGist.mockResolvedValue(
    createGistSummary({
      id: 'gist_1',
      updatedAt: '2026-05-26T12:00:00.000Z',
      remoteVersion: 'remote_1',
    }),
  )
  harness.githubClient.updateSyncGist.mockResolvedValue(
    createGistSummary({
      id: 'gist_1',
      updatedAt: currentTime,
      remoteVersion: 'remote_2',
    }),
  )

  await expect(harness.service.pushLocal()).resolves.toMatchObject({
    action: 'push-local',
    direction: 'push',
    outcome: 'success',
    reason: null,
    retryable: false,
    message: 'Local data pushed to Gist.',
  })
  expect(harness.githubClient.updateSyncGist).toHaveBeenCalledTimes(1)
  expect(harness.getMetadata()).toMatchObject({
    dirtySinceLastSync: false,
    lastPushAt: currentTime,
    lastRemoteVersion: 'remote_2',
    lastSyncDirection: 'push',
  })
})

it('pushLocal requires confirmation when remote changed elsewhere', async () => {
  const harness = createHarness()
  harness.setMetadata({
    enabled: true,
    gistId: 'gist_1',
    dirtySinceLastSync: true,
    localDataUpdatedAt: '2026-05-26T12:05:00.000Z',
    lastRemoteVersion: 'remote_1',
  })
  harness.githubClient.getGist.mockResolvedValue(
    createGistSummary({
      id: 'gist_1',
      updatedAt: '2026-05-26T12:10:00.000Z',
      remoteVersion: 'remote_2',
    }),
  )

  await expect(harness.service.pushLocal()).resolves.toMatchObject({
    action: 'push-local',
    direction: 'push',
    outcome: 'confirmation-required',
    reason: 'remote-changed',
    retryable: false,
    message: 'Remote changed since this browser last synced.',
  })
  expect(harness.githubClient.updateSyncGist).not.toHaveBeenCalled()
  expect(harness.getMetadata()).toMatchObject({
    conflict: {
      localDataUpdatedAt: '2026-05-26T12:05:00.000Z',
      remoteUpdatedAt: '2026-05-26T12:10:00.000Z',
      remoteVersion: 'remote_2',
    },
    lastBlockingReason: 'remote-changed',
  })
})

it('pushLocal overwrites changed remote data after confirmation', async () => {
  const harness = createHarness()
  harness.setMetadata({
    enabled: true,
    gistId: 'gist_1',
    dirtySinceLastSync: true,
    localDataUpdatedAt: '2026-05-26T12:05:00.000Z',
    lastRemoteVersion: 'remote_1',
  })
  harness.githubClient.getGist.mockResolvedValue(
    createGistSummary({
      id: 'gist_1',
      updatedAt: '2026-05-26T12:10:00.000Z',
      remoteVersion: 'remote_2',
    }),
  )
  harness.githubClient.updateSyncGist.mockResolvedValue(
    createGistSummary({
      id: 'gist_1',
      updatedAt: currentTime,
      remoteVersion: 'remote_3',
    }),
  )

  await expect(
    harness.service.pushLocal({ confirmRemoteOverwrite: true }),
  ).resolves.toMatchObject({
    action: 'push-local',
    direction: 'push',
    outcome: 'success',
    reason: null,
    retryable: false,
  })
  expect(harness.githubClient.updateSyncGist).toHaveBeenCalledTimes(1)
  expect(harness.getMetadata()).toMatchObject({
    conflict: null,
    dirtySinceLastSync: false,
    lastBlockingReason: null,
    lastPushAt: currentTime,
  })
})

it('pushLocal returns a redacted retryable error result for network failures', async () => {
  const harness = createHarness()
  harness.setMetadata({
    enabled: true,
    gistId: 'gist_1',
    dirtySinceLastSync: true,
    localDataUpdatedAt: '2026-05-26T12:05:00.000Z',
    lastRemoteVersion: 'remote_1',
  })
  harness.githubClient.getGist.mockRejectedValue(
    new Error('Failed to fetch with Bearer ghp_secret'),
  )

  await expect(harness.service.pushLocal()).resolves.toMatchObject({
    action: 'push-local',
    direction: 'push',
    outcome: 'error',
    reason: 'network',
    retryable: true,
  })
  expect(JSON.stringify(harness.getMetadata().lastError)).not.toContain(
    'ghp_secret',
  )
  expect(harness.getMetadata().dirtySinceLastSync).toBe(true)
})
```

- [ ] **Step 3: Run service tests and verify failure**

Run:

```bash
npm run test -- src/features/sync/server/sync-service.test.ts
```

Expected: fail because `pullLatest`, `pushLocal`, richer action results, and metadata fields are not implemented.

- [ ] **Step 4: Implement structured service results**

In `src/features/sync/server/sync-service.ts`, import the new domain types:

```ts
import type {
  SyncAction,
  SyncActionDirection,
  SyncActionOutcome,
  SyncActionReason,
  SyncErrorKind,
  SyncErrorSummary,
} from '../domain/sync-status'
```

Add a result input type near the other local types:

```ts
type SyncActionResultInput = {
  action: SyncAction
  direction: SyncActionDirection
  outcome: SyncActionOutcome
  reason: SyncActionReason | null
  retryable: boolean
  message: string
}
```

Replace `createActionResult(message: string)` with:

```ts
async function createActionResult(
  input: SyncActionResultInput,
): Promise<SyncActionResult> {
  return {
    ...input,
    status: await getStatus(),
    occurredAt: deps.now().toISOString(),
  }
}
```

Add an error-result helper:

```ts
async function createErrorActionResult(input: {
  action: SyncAction
  direction: SyncActionDirection
  error: unknown
}) {
  const retryable = isRetryableSyncError(input.error)
  await recordError(input.error, retryable)

  return createActionResult({
    action: input.action,
    direction: input.direction,
    outcome: 'error',
    reason: mapErrorKindToActionReason(classifySyncError(input.error)),
    retryable,
    message: createSafeSyncErrorMessage(input.error),
  })
}
```

Add the mapper near `classifySyncError`:

```ts
function mapErrorKindToActionReason(kind: SyncErrorKind): SyncActionReason {
  const reasons = {
    auth: 'auth',
    conflict: 'remote-changed',
    'gist-missing': 'missing-gist',
    network: 'network',
    'rate-limit': 'rate-limit',
    'remote-invalid': 'invalid-remote',
    'schema-unsupported': 'unsupported-schema',
    unknown: 'unknown',
  } satisfies Record<SyncErrorKind, SyncActionReason>

  return reasons[kind]
}
```

Update existing setup methods to call `createActionResult` with a full input.
For example:

```ts
return createActionResult({
  action: 'save-token',
  direction: null,
  outcome: 'success',
  reason: null,
  retryable: false,
  message: 'GitHub token saved.',
})
```

Use the matching `action` value and current message for validate-token,
delete-token, create-gist, connect-gist, and set-enabled.

- [ ] **Step 5: Implement `pullLatest` and `pushLocal`**

Add both service methods above `syncAfterMutation`:

```ts
async function pullLatest(): Promise<SyncActionResult> {
  try {
    return await runExclusive(async () => {
      const metadata = await deps.readMetadata()

      if (!metadata.enabled || !metadata.gistId) {
        await deps.writeMetadata({ lastBlockingReason: 'not-configured' })

        return createActionResult({
          action: 'pull-latest',
          direction: 'pull',
          outcome: 'blocked',
          reason: 'not-configured',
          retryable: false,
          message: 'GitHub Gist sync is not configured.',
        })
      }

      if (metadata.dirtySinceLastSync) {
        await deps.writeMetadata({
          lastBlockingReason: 'local-dirty',
          lastError: null,
        })

        return createActionResult({
          action: 'pull-latest',
          direction: 'pull',
          outcome: 'blocked',
          reason: 'local-dirty',
          retryable: false,
          message: 'Pull blocked: local changes have not been pushed.',
        })
      }

      const client = await readConfiguredClient()
      const remote = await client.getGist(metadata.gistId)

      if (!hasRemoteChanged(remote, metadata)) {
        await deps.writeMetadata({
          lastSyncAt: deps.now().toISOString(),
          lastSyncDirection: 'no-change',
          lastBlockingReason: null,
          lastError: null,
        })

        return createActionResult({
          action: 'pull-latest',
          direction: 'pull',
          outcome: 'no-change',
          reason: 'remote-unchanged',
          retryable: false,
          message: 'No remote changes.',
        })
      }

      await pullRemote(remote)

      return createActionResult({
        action: 'pull-latest',
        direction: 'pull',
        outcome: 'success',
        reason: null,
        retryable: false,
        message: 'Latest Gist data pulled.',
      })
    })
  } catch (error) {
    return createErrorActionResult({
      action: 'pull-latest',
      direction: 'pull',
      error,
    })
  }
}

async function pushLocal(
  input: { confirmRemoteOverwrite?: boolean } = {},
): Promise<SyncActionResult> {
  try {
    return await runExclusive(async () => {
      const metadata = await deps.readMetadata()

      if (!metadata.enabled || !metadata.gistId) {
        await deps.writeMetadata({ lastBlockingReason: 'not-configured' })

        return createActionResult({
          action: 'push-local',
          direction: 'push',
          outcome: 'blocked',
          reason: 'not-configured',
          retryable: false,
          message: 'GitHub Gist sync is not configured.',
        })
      }

      const client = await readConfiguredClient()
      const remote = await client.getGist(metadata.gistId)

      if (hasRemoteChanged(remote, metadata) && !input.confirmRemoteOverwrite) {
        await deps.writeMetadata({
          conflict: createSyncConflict({
            detectedAt: deps.now(),
            localDataUpdatedAt: metadata.localDataUpdatedAt,
            remoteUpdatedAt: remote.updatedAt,
            remoteVersion: getRemoteIdentity(remote),
          }),
          lastBlockingReason: 'remote-changed',
          lastError: null,
        })

        return createActionResult({
          action: 'push-local',
          direction: 'push',
          outcome: 'confirmation-required',
          reason: 'remote-changed',
          retryable: false,
          message: 'Remote changed since this browser last synced.',
        })
      }

      const local = await createLocalEnvelopeContent()
      const updated = await client.updateSyncGist(
        metadata.gistId,
        local.content,
      )
      await recordPush(updated, local.dataUpdatedAt)

      return createActionResult({
        action: 'push-local',
        direction: 'push',
        outcome: 'success',
        reason: null,
        retryable: false,
        message: 'Local data pushed to Gist.',
      })
    })
  } catch (error) {
    return createErrorActionResult({
      action: 'push-local',
      direction: 'push',
      error,
    })
  }
}
```

Update `pullRemote` metadata writes:

```ts
lastPullAt: deps.now().toISOString(),
lastBlockingReason: null,
```

Update `recordPush` metadata writes:

```ts
lastPushAt: deps.now().toISOString(),
lastBlockingReason: null,
```

Extend `createStatus`:

```ts
lastPullAt: metadata.lastPullAt,
lastPushAt: metadata.lastPushAt,
needsPush: metadata.dirtySinceLastSync,
lastBlockingReason: metadata.lastBlockingReason,
```

Return `pullLatest` and `pushLocal` from the service object.

- [ ] **Step 6: Keep compatibility methods inactive for this manual-first pass**

Replace `checkOnOpen` and `syncAfterMutation` with no-network compatibility methods:

```ts
async function checkOnOpen(): Promise<null> {
  return null
}

async function syncAfterMutation(): Promise<null> {
  return null
}
```

Replace `syncNow` with a compatibility wrapper only if a transitional test still imports it:

```ts
async function syncNow(): Promise<SyncActionResult> {
  return pullLatest()
}
```

Do not call `syncNow` from UI or new runtime handlers after Task 4.

- [ ] **Step 7: Run service tests and commit**

Run:

```bash
npm run test -- src/features/sync/server/sync-service.test.ts
```

Expected: pass.

Commit:

```bash
git add src/features/sync/server/sync-service.ts src/features/sync/server/sync-service.test.ts
git commit -m "feat: add directional sync service actions"
```

## Task 3: Runtime Directional Methods And Manual-First Mutations

**Files:**

- Modify: `src/extension/messaging.ts`
- Modify: `src/extension/background/runtime-policy.ts`
- Modify: `src/extension/background/runtime-policy.test.ts`
- Modify: `src/extension/background/register-handlers.ts`
- Modify: `src/extension/background/register-handlers.test.ts`

- [ ] **Step 1: Write failing runtime policy tests**

In `src/extension/background/runtime-policy.test.ts`, replace old privileged sync methods:

```ts
it('keeps privileged sync writes dashboard-only', () => {
  for (const method of [
    'sync.validateGithubToken',
    'sync.saveGithubToken',
    'sync.deleteGithubToken',
    'sync.createGithubGist',
    'sync.connectGithubGist',
    'sync.setEnabled',
    'sync.pullLatest',
    'sync.pushLocal',
  ]) {
    expect(canCallExtensionMethod(method, 'dashboard')).toBe(true)
    expect(canCallExtensionMethod(method, 'popup')).toBe(false)
    expect(canCallExtensionMethod(method, 'content-script')).toBe(false)
  }
})

it('does not expose old smart sync runtime methods', () => {
  for (const method of [
    'sync.syncNow',
    'sync.resolveConflict',
    'sync.checkOnOpen',
  ]) {
    expect(canCallExtensionMethod(method, 'dashboard')).toBe(false)
    expect(canCallExtensionMethod(method, 'popup')).toBe(false)
    expect(canCallExtensionMethod(method, 'content-script')).toBe(false)
  }
})
```

- [ ] **Step 2: Write failing background handler tests**

In `src/extension/background/register-handlers.test.ts`, update the sync service mock:

```ts
syncService: {
  connectGithubGist: vi.fn(),
  createGithubGist: vi.fn(),
  deleteGithubToken: vi.fn(),
  getStatus: vi.fn(),
  pullLatest: vi.fn(),
  pushLocal: vi.fn(),
  saveGithubToken: vi.fn(),
  setEnabled: vi.fn(),
  validateGithubToken: vi.fn(),
},
```

In `beforeEach`, replace old mocks:

```ts
backgroundMocks.syncService.pullLatest.mockResolvedValue(syncActionResult)
backgroundMocks.syncService.pushLocal.mockResolvedValue(syncActionResult)
```

Replace the privileged sync handler test with:

```ts
it('registers privileged directional sync dashboard actions with request and response parsing', async () => {
  const savedToken = await sendRuntimeMessage('sync.saveGithubToken', {
    surface: 'dashboard',
    token: '  github-token  ',
  })
  const createdGist = await sendRuntimeMessage('sync.createGithubGist', {
    surface: 'dashboard',
  })
  const connectedGist = await sendRuntimeMessage('sync.connectGithubGist', {
    surface: 'dashboard',
    gistId: ' gist_1 ',
  })
  const pulledLatest = await sendRuntimeMessage('sync.pullLatest', {
    surface: 'dashboard',
  })
  const pushedLocal = await sendRuntimeMessage('sync.pushLocal', {
    surface: 'dashboard',
    confirmRemoteOverwrite: true,
  })

  expectRuntimePolicy('sync.saveGithubToken', 'dashboard')
  expectRuntimePolicy('sync.createGithubGist', 'dashboard')
  expectRuntimePolicy('sync.connectGithubGist', 'dashboard')
  expectRuntimePolicy('sync.pullLatest', 'dashboard')
  expectRuntimePolicy('sync.pushLocal', 'dashboard')
  expect(backgroundMocks.syncService.saveGithubToken).toHaveBeenCalledWith(
    'github-token',
  )
  expect(backgroundMocks.syncService.createGithubGist).toHaveBeenCalledTimes(1)
  expect(backgroundMocks.syncService.connectGithubGist).toHaveBeenCalledWith(
    'gist_1',
  )
  expect(backgroundMocks.syncService.pullLatest).toHaveBeenCalledTimes(1)
  expect(backgroundMocks.syncService.pushLocal).toHaveBeenCalledWith({
    confirmRemoteOverwrite: true,
  })
  for (const response of [
    savedToken,
    createdGist,
    connectedGist,
    pulledLatest,
    pushedLocal,
  ]) {
    expect(response).toEqual(syncActionResultSchema.parse(syncActionResult))
  }
})
```

Replace mutation auto-sync expectations with dirty-mark-only behavior:

```ts
it('marks local mutations dirty without auto-pushing to Gist', async () => {
  vi.useFakeTimers()

  await sendRuntimeMessage(
    'problems.createProblem',
    binarySearchCreateRequest(),
  )
  await vi.advanceTimersByTimeAsync(600)

  expect(backgroundMocks.markSyncLocalDataChanged).toHaveBeenCalledTimes(1)
  expect(backgroundMocks.syncService.pushLocal).not.toHaveBeenCalled()
  expect(backgroundMocks.syncService.pullLatest).not.toHaveBeenCalled()
})
```

Update the manual queue test to use `sync.pullLatest`:

```ts
it('queues manual pull so later local mutations wait behind the sync work', async () => {
  const pullLatest = createDeferred<typeof syncActionResult>()
  backgroundMocks.syncService.pullLatest.mockReturnValueOnce(pullLatest.promise)

  const syncPromise = sendRuntimeMessage('sync.pullLatest', {
    surface: 'dashboard',
  })
  await waitUntil(() => {
    expect(backgroundMocks.syncService.pullLatest).toHaveBeenCalled()
  })

  const mutationPromise = sendRuntimeMessage(
    'problems.createProblem',
    binarySearchCreateRequest(),
  )

  await Promise.resolve()
  expect(backgroundMocks.createProblem).not.toHaveBeenCalled()

  pullLatest.resolve(syncActionResult)
  await syncPromise
  await mutationPromise

  expect(backgroundMocks.createProblem).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 3: Run runtime tests and verify failure**

Run:

```bash
npm run test -- src/extension/background/runtime-policy.test.ts src/extension/background/register-handlers.test.ts
```

Expected: fail because protocol methods and handler names have not changed yet.

- [ ] **Step 4: Implement runtime protocol and policy**

In `src/extension/messaging.ts`, import `syncPushLocalRequestSchema` and `SyncPushLocalRequest`. Replace:

```ts
'sync.checkOnOpen'(request: SyncRequest): SyncActionResult | null
'sync.syncNow'(request: SyncRequest): SyncActionResult | null
'sync.resolveConflict'(request: SyncResolveConflictRequest): SyncActionResult
```

with:

```ts
'sync.pullLatest'(request: SyncRequest): SyncActionResult
'sync.pushLocal'(request: SyncPushLocalRequest): SyncActionResult
```

In `src/extension/background/runtime-policy.ts`, replace:

```ts
'sync.checkOnOpen': ['popup', 'dashboard', 'content-script'],
'sync.syncNow': ['dashboard'],
'sync.resolveConflict': ['dashboard'],
```

with:

```ts
'sync.pullLatest': ['dashboard'],
'sync.pushLocal': ['dashboard'],
```

- [ ] **Step 5: Implement background handlers and remove auto-sync scheduling**

In `src/extension/background/register-handlers.ts`, remove imports and handler usage for `syncResolveConflictRequestSchema`. Import `syncPushLocalRequestSchema`.

Remove the `sync.checkOnOpen`, `sync.syncNow`, and `sync.resolveConflict` handlers.

Add:

```ts
onMessage('sync.pullLatest', ({ data, sender }) => {
  const request = syncRequestSchema.parse(data)

  assertCanSenderCallExtensionMethod('sync.pullLatest', request.surface, sender)
  return getAppDb().then(async ({ db }) =>
    parseSyncActionResult(
      await runQueuedSyncAction(db, (service) => service.pullLatest()),
    ),
  )
})

onMessage('sync.pushLocal', ({ data, sender }) => {
  const request = syncPushLocalRequestSchema.parse(data)

  assertCanSenderCallExtensionMethod('sync.pushLocal', request.surface, sender)
  return getAppDb().then(async ({ db }) =>
    parseSyncActionResult(
      await runQueuedSyncAction(db, (service) =>
        service.pushLocal({
          confirmRemoteOverwrite: request.confirmRemoteOverwrite,
        }),
      ),
    ),
  )
})
```

Delete `parseNullableSyncActionResult`.

In `runDbMutation`, remove this block:

```ts
if (syncMode === 'mark-dirty') {
  scheduleSyncAfterMutation(db)
}
```

Delete `syncAfterMutationTimer`, `syncAfterMutationGeneration`, `scheduleSyncAfterMutation`, and `runSyncAfterMutationWhenQueueIdle`. Keep `markSyncLocalDataChangedBestEffort`, `retryPendingDirtyMark`, and `runRemoteRestoreInMutationQueue` because local dirty tracking and remote restore safety still matter.

- [ ] **Step 6: Run runtime tests and commit**

Run:

```bash
npm run test -- src/extension/background/runtime-policy.test.ts src/extension/background/register-handlers.test.ts
```

Expected: pass.

Commit:

```bash
git add src/extension/messaging.ts src/extension/background/runtime-policy.ts src/extension/background/runtime-policy.test.ts src/extension/background/register-handlers.ts src/extension/background/register-handlers.test.ts
git commit -m "feat: expose directional sync runtime methods"
```

## Task 4: Feature API Hooks And Controller

**Files:**

- Modify: `src/features/sync/api/sync-api.ts`
- Modify: `src/features/sync/api/sync-api.test.tsx`
- Modify: `src/features/sync/api/sync-serializers.ts`
- Modify: `src/features/sync/hooks/use-github-sync-controller.ts`
- Modify: `src/features/sync/hooks/use-github-sync-controller.test.tsx`
- Modify: `src/features/sync/index.ts`

- [ ] **Step 1: Write failing API tests**

In `src/features/sync/api/sync-api.test.tsx`, replace old open/sync tests with:

```ts
import {
  connectGithubGistViaRuntime,
  pullLatestViaRuntime,
  pushLocalViaRuntime,
  saveGithubTokenViaRuntime,
  useSyncAction,
} from './sync-api'

it('sends pull latest through the dashboard runtime boundary', async () => {
  vi.mocked(sendMessage).mockResolvedValue(pullResult)

  await pullLatestViaRuntime()

  expect(sendMessage).toHaveBeenCalledWith('sync.pullLatest', {
    surface: 'dashboard',
  })
})

it('sends push local through the dashboard runtime boundary with overwrite confirmation', async () => {
  vi.mocked(sendMessage).mockResolvedValue(pushResult)

  await pushLocalViaRuntime({ confirmRemoteOverwrite: true })

  expect(sendMessage).toHaveBeenCalledWith('sync.pushLocal', {
    surface: 'dashboard',
    confirmRemoteOverwrite: true,
  })
})

it('broad-invalidates local data views only when an action pulls data successfully', async () => {
  const { queryClient, wrapper } = createQueryTestHarness()
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  const { result } = renderHook(
    () =>
      useSyncAction(() => Promise.resolve(pullResult), {
        shouldInvalidateData: (value) =>
          value.direction === 'pull' && value.outcome === 'success',
      }),
    { wrapper },
  )

  await act(async () => {
    await result.current.mutateAsync()
  })

  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: queryKeys.settings.all,
  })
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: queryKeys.problems.all,
  })
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: queryKeys.sync.all,
  })
})

it('does not broad-invalidate data views for blocked pulls', async () => {
  const { queryClient, wrapper } = createQueryTestHarness()
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  const { result } = renderHook(
    () =>
      useSyncAction(() => Promise.resolve(blockedPullResult), {
        shouldInvalidateData: (value) =>
          value.direction === 'pull' && value.outcome === 'success',
      }),
    { wrapper },
  )

  await act(async () => {
    await result.current.mutateAsync()
  })

  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: queryKeys.sync.all,
  })
  expect(invalidateQueries).not.toHaveBeenCalledWith({
    queryKey: queryKeys.problems.all,
  })
})
```

Use these fixtures at the bottom of the file:

```ts
const configuredStatus = {
  enabled: true,
  configured: true,
  tokenConfigured: true,
  tokenStatus: {
    provider: 'github:gist',
    configured: true,
    updatedAt: '2026-05-26T12:00:00.000Z',
    fingerprint: 'abcdef123456',
  },
  gistId: 'gist_1',
  isSyncing: false,
  lastSyncAt: '2026-05-26T12:00:00.000Z',
  lastSyncDirection: 'push',
  lastPullAt: null,
  lastPushAt: '2026-05-26T12:00:00.000Z',
  needsPush: false,
  lastBlockingReason: null,
  lastError: null,
  conflict: null,
} as const

const pullResult = {
  action: 'pull-latest',
  direction: 'pull',
  outcome: 'success',
  reason: null,
  retryable: false,
  message: 'Latest Gist data pulled.',
  occurredAt: '2026-05-26T12:30:00.000Z',
  status: configuredStatus,
} as const

const blockedPullResult = {
  ...pullResult,
  outcome: 'blocked',
  reason: 'local-dirty',
  message: 'Pull blocked: local changes have not been pushed.',
} as const

const pushResult = {
  ...pullResult,
  action: 'push-local',
  direction: 'push',
  message: 'Local data pushed to Gist.',
} as const
```

- [ ] **Step 2: Write failing controller test**

In `src/features/sync/hooks/use-github-sync-controller.test.tsx`, add:

```ts
it('exposes directional pull and push actions through the sync controller', async () => {
  vi.mocked(sendMessage).mockImplementation((method) => {
    if (method === 'sync.getStatus') {
      return Promise.resolve(configuredStatus)
    }

    if (method === 'sync.pullLatest') {
      return Promise.resolve(pullResult)
    }

    if (method === 'sync.pushLocal') {
      return Promise.resolve(pushResult)
    }

    return Promise.reject(new Error(`Unexpected method ${method}`))
  })
  const { wrapper } = createQueryTestHarness()
  const { result } = renderHook(() => useGithubSyncController(), { wrapper })

  await waitFor(() => {
    expect(result.current.status).toEqual(configuredStatus)
  })

  await act(async () => {
    await result.current.actions.onPullLatest()
    await result.current.actions.onPushLocal({ confirmRemoteOverwrite: true })
  })

  expect(sendMessage).toHaveBeenCalledWith('sync.pullLatest', {
    surface: 'dashboard',
  })
  expect(sendMessage).toHaveBeenCalledWith('sync.pushLocal', {
    surface: 'dashboard',
    confirmRemoteOverwrite: true,
  })
})
```

Reuse the `pullResult` and `pushResult` fixture shape from the API test.

- [ ] **Step 3: Run API and controller tests and verify failure**

Run:

```bash
npm run test -- src/features/sync/api/sync-api.test.tsx src/features/sync/hooks/use-github-sync-controller.test.tsx
```

Expected: fail because directional API functions and controller actions do not exist.

- [ ] **Step 4: Implement API functions and outcome-aware invalidation**

In `src/features/sync/api/sync-api.ts`, remove `syncNowViaRuntime`, `resolveSyncConflictViaRuntime`, and `checkSyncOnOpenViaRuntime`.

Add:

```ts
import type { SyncActionResult } from './sync-contracts'

export function pullLatestViaRuntime() {
  return sendMessage('sync.pullLatest', { surface: 'dashboard' })
}

export function pushLocalViaRuntime(
  input: { confirmRemoteOverwrite?: boolean } = {},
) {
  return sendMessage('sync.pushLocal', {
    surface: 'dashboard',
    confirmRemoteOverwrite: input.confirmRemoteOverwrite ?? false,
  })
}
```

Change `useSyncAction` options:

```ts
export function useSyncAction<TVariables = void, TResult = unknown>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  options: {
    invalidateData?: boolean
    shouldInvalidateData?: (result: TResult) => boolean
  } = {},
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: syncQueryKeys.all })
    },
    onSuccess: (result) => {
      if (
        options.invalidateData ||
        options.shouldInvalidateData?.(result) === true
      ) {
        invalidateTaggedQueries(queryClient, broadSyncInvalidationTags)
      }
    },
  })
}
```

Add convenience hooks:

```ts
function didPullRemoteData(result: SyncActionResult) {
  return result.direction === 'pull' && result.outcome === 'success'
}

export function usePullLatest() {
  return useSyncAction(() => pullLatestViaRuntime(), {
    shouldInvalidateData: didPullRemoteData,
  })
}

export function usePushLocal() {
  return useSyncAction(
    (input: { confirmRemoteOverwrite?: boolean } | undefined) =>
      pushLocalViaRuntime(input),
  )
}
```

- [ ] **Step 5: Implement controller actions**

In `src/features/sync/hooks/use-github-sync-controller.ts`, replace sync imports with:

```ts
import {
  connectGithubGistViaRuntime,
  createGithubGistViaRuntime,
  deleteGithubTokenViaRuntime,
  pullLatestViaRuntime,
  pushLocalViaRuntime,
  saveGithubTokenViaRuntime,
  usePullLatest,
  usePushLocal,
  useSyncAction,
  useSyncStatus,
  validateGithubTokenViaRuntime,
} from '../api/sync-api'
```

Replace `syncNow` and `resolveConflict` mutations:

```ts
const pullLatest = usePullLatest()
const pushLocal = usePushLocal()
```

Update `connectGist` invalidation to use the pull-success predicate:

```ts
const connectGist = useSyncAction(
  (gistId: string) => connectGithubGistViaRuntime(gistId),
  {
    shouldInvalidateData: (result) =>
      result.direction === 'pull' && result.outcome === 'success',
  },
)
```

Update actions:

```ts
const actions = {
  onConnectGist: (gistId) => connectGist.mutateAsync(gistId),
  onCreateGist: () => createGist.mutateAsync(),
  onDeleteToken: () => deleteToken.mutateAsync(),
  onPullLatest: () => pullLatest.mutateAsync(),
  onPushLocal: (input) => pushLocal.mutateAsync(input),
  onSaveToken: (token) => saveToken.mutateAsync(token),
  onValidateToken: (token) => validateToken.mutateAsync(token),
} satisfies GitHubSyncPanelActions
```

Update pending state to include `pullLatest.isPending` and `pushLocal.isPending`.

- [ ] **Step 6: Update serializers and exports**

In `src/features/sync/api/sync-serializers.ts`, ensure action result parsing uses the richer `syncActionResultSchema`:

```ts
import {
  syncActionResultSchema,
  syncStatusSchema,
  type SerializedSyncStatus,
  type SyncActionResult,
} from './sync-contracts'

export function serializeSyncActionResult(result: SyncActionResult) {
  return syncActionResultSchema.parse(result)
}
```

In `src/features/sync/index.ts`, export `DashboardSyncActions` after Task 6 creates it. For now remove exports for `SyncResolveConflictRequest` and export `SyncPushLocalRequest`.

- [ ] **Step 7: Run tests and commit**

Run:

```bash
npm run test -- src/features/sync/api/sync-api.test.tsx src/features/sync/hooks/use-github-sync-controller.test.tsx
```

Expected: pass.

Commit:

```bash
git add src/features/sync/api/sync-api.ts src/features/sync/api/sync-api.test.tsx src/features/sync/api/sync-serializers.ts src/features/sync/hooks/use-github-sync-controller.ts src/features/sync/hooks/use-github-sync-controller.test.tsx src/features/sync/index.ts
git commit -m "feat: add directional sync hooks"
```

## Task 5: Settings Panel Directional UI

**Files:**

- Modify: `src/features/sync/components/github-sync-panel.tsx`
- Modify: `src/features/sync/components/github-sync-panel.test.tsx`
- Modify: `src/features/sync/components/github-sync-settings-section.test.tsx`

- [ ] **Step 1: Write failing panel tests**

In `src/features/sync/components/github-sync-panel.test.tsx`, update action objects to use:

```ts
actions={{
  onConnectGist: vi.fn(),
  onCreateGist: vi.fn(),
  onDeleteToken: vi.fn(),
  onPullLatest: vi.fn(),
  onPushLocal: vi.fn(),
  onSaveToken,
  onValidateToken: vi.fn(),
}}
```

Add:

```ts
it('renders explicit pull and push actions instead of Sync now', () => {
  render(
    <GitHubSyncPanel
      actions={createActions()}
      status={configuredStatus}
    />,
  )

  expect(screen.getByRole('button', { name: /Pull latest/i })).toBeEnabled()
  expect(screen.getByRole('button', { name: /Push local/i })).toBeEnabled()
  expect(
    screen.queryByRole('button', { name: /Sync now/i }),
  ).not.toBeInTheDocument()
})

it('calls pullLatest and shows blocked pull feedback', async () => {
  const user = userEvent.setup()
  const onPullLatest = vi.fn().mockResolvedValue(blockedPullResult)

  render(
    <GitHubSyncPanel
      actions={{ ...createActions(), onPullLatest }}
      status={{ ...configuredStatus, needsPush: true }}
    />,
  )

  await user.click(screen.getByRole('button', { name: /Pull latest/i }))

  expect(onPullLatest).toHaveBeenCalledTimes(1)
  expect(await screen.findByRole('status')).toHaveTextContent(
    /Pull blocked: local changes have not been pushed/i,
  )
})

it('requires overwrite confirmation when push local finds a changed remote', async () => {
  const user = userEvent.setup()
  const onPushLocal = vi
    .fn()
    .mockResolvedValueOnce(confirmPushResult)
    .mockResolvedValueOnce(pushResult)

  render(
    <GitHubSyncPanel
      actions={{ ...createActions(), onPushLocal }}
      status={configuredStatus}
    />,
  )

  await user.click(screen.getByRole('button', { name: /Push local/i }))

  expect(onPushLocal).toHaveBeenCalledWith({
    confirmRemoteOverwrite: false,
  })
  expect(
    await screen.findByRole('button', { name: /Overwrite Gist/i }),
  ).toBeEnabled()

  await user.click(screen.getByRole('button', { name: /Overwrite Gist/i }))

  expect(onPushLocal).toHaveBeenCalledWith({
    confirmRemoteOverwrite: true,
  })
})
```

Add helpers:

```ts
function createActions() {
  return {
    onConnectGist: vi.fn(),
    onCreateGist: vi.fn(),
    onDeleteToken: vi.fn(),
    onPullLatest: vi.fn(),
    onPushLocal: vi.fn(),
    onSaveToken: vi.fn(),
    onValidateToken: vi.fn(),
  }
}
```

Extend status fixtures with:

```ts
lastPullAt: null,
lastPushAt: '2026-05-26T12:00:00.000Z',
needsPush: false,
lastBlockingReason: null,
```

Use action result fixtures matching Task 4.

- [ ] **Step 2: Update settings section mocked actions**

In `src/features/sync/components/github-sync-settings-section.test.tsx`, replace mocked `onResolveConflict` and `onSyncNow` with `onPullLatest` and `onPushLocal`, and add status fields from Task 1.

- [ ] **Step 3: Run panel tests and verify failure**

Run:

```bash
npm run test -- src/features/sync/components/github-sync-panel.test.tsx src/features/sync/components/github-sync-settings-section.test.tsx
```

Expected: fail because props and buttons still use the old smart-sync action names.

- [ ] **Step 4: Implement panel props and actions**

In `src/features/sync/components/github-sync-panel.tsx`, update imports:

```ts
import {
  CheckCircle2,
  CloudDownload,
  CloudUpload,
  GitBranch,
  KeyRound,
  Loader2,
  Trash2,
  UploadCloud,
} from 'lucide-react'
```

Replace `SyncConflictResolution` with:

```ts
type PushConfirmation = 'remote-overwrite' | null
```

Update `GitHubSyncPanelActions`:

```ts
export interface GitHubSyncPanelActions {
  onConnectGist: (gistId: string) => GitHubSyncActionResult
  onCreateGist: () => GitHubSyncActionResult
  onDeleteToken: () => GitHubSyncActionResult
  onPullLatest: () => GitHubSyncActionResult
  onPushLocal: (input: {
    confirmRemoteOverwrite?: boolean
  }) => GitHubSyncActionResult
  onSaveToken: (token: string) => GitHubSyncActionResult
  onValidateToken: (token: string) => GitHubSyncActionResult
}
```

Replace `resolutionToConfirm` state:

```ts
const [pushConfirmation, setPushConfirmation] = useState<PushConfirmation>(null)
```

Add:

```ts
async function handlePushLocal(confirmRemoteOverwrite: boolean) {
  setFeedback(null)

  try {
    const result = await actions.onPushLocal({ confirmRemoteOverwrite })

    if (
      result &&
      typeof result === 'object' &&
      'outcome' in result &&
      result.outcome === 'confirmation-required'
    ) {
      setPushConfirmation('remote-overwrite')
      setFeedback({
        message: readActionMessage(
          result,
          'Remote changed since this browser last synced.',
        ),
        tone: 'warning',
      })
      return
    }

    setPushConfirmation(null)
    setFeedback({
      message: readActionMessage(result, 'Local data pushed to Gist.'),
      tone: 'success',
    })
  } catch (error) {
    setFeedback({
      message: readErrorMessage(error, 'Push local failed.'),
      tone: 'danger',
    })
  }
}
```

Replace the old non-conflict action block with:

```tsx
<div className="flex flex-wrap items-center gap-2">
  <Button
    disabled={isPending || !status.configured}
    onClick={() => {
      void runPanelAction(
        () => actions.onPullLatest(),
        'Latest Gist data pulled.',
      )
    }}
    size="sm"
    variant="outline"
  >
    <CloudDownload aria-hidden="true" />
    Pull latest
  </Button>
  <Button
    disabled={isPending || !status.configured}
    onClick={() => {
      void handlePushLocal(false)
    }}
    size="sm"
    variant="outline"
  >
    <CloudUpload aria-hidden="true" />
    Push local
  </Button>
  <Button
    disabled={isPending || !status.tokenConfigured}
    onClick={() => {
      void runPanelAction(
        () => actions.onDeleteToken(),
        'GitHub token deleted.',
        {
          afterSuccess: () => {
            setTokenSavedInSession(false)
          },
        },
      )
    }}
    size="sm"
    variant="ghost"
  >
    <Trash2 aria-hidden="true" />
    Delete token
  </Button>
</div>
```

Render confirmation below that block:

```tsx
{
  pushConfirmation === 'remote-overwrite' ? (
    <div className="grid gap-2">
      <InlineStatus tone="warning">
        Remote changed since this browser last synced. Push local data anyway?
      </InlineStatus>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={isPending}
          onClick={() => {
            void handlePushLocal(true)
          }}
          size="sm"
          variant="destructive"
        >
          Overwrite Gist
        </Button>
        <Button
          disabled={isPending}
          onClick={() => {
            setPushConfirmation(null)
          }}
          size="sm"
          variant="ghost"
        >
          Cancel
        </Button>
      </div>
    </div>
  ) : null
}
```

Remove `ConflictActions`. Existing `status.conflict` should no longer hide the main pull/push buttons; it should be represented as status text plus directional actions.

Update `SyncStatusBlock`:

```tsx
if (status.lastBlockingReason === 'local-dirty') {
  return (
    <InlineStatus role="status" tone="warning">
      Pull blocked: local changes have not been pushed.
    </InlineStatus>
  )
}

if (status.needsPush) {
  return (
    <InlineStatus role="status" tone="warning">
      Local changes need push.
    </InlineStatus>
  )
}
```

For the success case, prefer directional timestamps:

```tsx
const lastDirectionalSync = status.lastPushAt
  ? `Last pushed: ${formatDateTime(status.lastPushAt)}`
  : status.lastPullAt
    ? `Last pulled: ${formatDateTime(status.lastPullAt)}`
    : status.lastSyncAt
      ? `Last ${status.lastSyncDirection ?? 'sync'}: ${formatDateTime(status.lastSyncAt)}`
      : 'GitHub sync is ready.'
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm run test -- src/features/sync/components/github-sync-panel.test.tsx src/features/sync/components/github-sync-settings-section.test.tsx
```

Expected: pass.

Commit:

```bash
git add src/features/sync/components/github-sync-panel.tsx src/features/sync/components/github-sync-panel.test.tsx src/features/sync/components/github-sync-settings-section.test.tsx
git commit -m "feat: replace sync now with directional settings actions"
```

## Task 6: Dashboard Header Cloud Actions

**Files:**

- Create: `src/features/sync/components/dashboard-sync-actions.tsx`
- Create: `src/features/sync/components/dashboard-sync-actions.test.tsx`
- Create: `src/app/dashboard/components/dashboard-header-actions.tsx`
- Modify: `src/app/dashboard/dashboard-shell.tsx`
- Modify: `src/app/dashboard/screens/analytics-page.tsx`
- Modify: `src/app/dashboard/screens/library-page.tsx`
- Modify: `src/app/dashboard/screens/overview-page.tsx`
- Modify: `src/app/dashboard/screens/settings-page.tsx`
- Modify: `src/app/dashboard/screens/tracks-page.tsx`
- Modify: `src/app/dashboard/routes.test.tsx`
- Modify: `src/features/sync/index.ts`

- [ ] **Step 1: Write failing sync header component tests**

Create `src/features/sync/components/dashboard-sync-actions.test.tsx`:

```ts
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DashboardSyncActionsView } from './dashboard-sync-actions'

describe('DashboardSyncActions', () => {
  it('hides actions when Gist sync is not configured', () => {
    render(
      <DashboardSyncActionsView
        onPullLatest={vi.fn()}
        onPushLocal={vi.fn()}
        status={notConfiguredStatus}
      />,
    )

    expect(
      screen.queryByRole('button', { name: /Pull latest from Gist/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Push local to Gist/i }),
    ).not.toBeInTheDocument()
  })

  it('renders cloud actions and calls directional handlers', async () => {
    const user = userEvent.setup()
    const onPullLatest = vi.fn().mockResolvedValue(pullResult)
    const onPushLocal = vi.fn().mockResolvedValue(pushResult)

    render(
      <DashboardSyncActionsView
        onPullLatest={onPullLatest}
        onPushLocal={onPushLocal}
        status={configuredStatus}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: /Pull latest from Gist/i }),
    )
    await user.click(
      screen.getByRole('button', { name: /Push local to Gist/i }),
    )

    expect(onPullLatest).toHaveBeenCalledTimes(1)
    expect(onPushLocal).toHaveBeenCalledWith({
      confirmRemoteOverwrite: false,
    })
  })

  it('does not overwrite the Gist from the header when confirmation is required', async () => {
    const user = userEvent.setup()
    const onPushLocal = vi.fn().mockResolvedValue(confirmPushResult)

    render(
      <DashboardSyncActionsView
        onPullLatest={vi.fn()}
        onPushLocal={onPushLocal}
        status={configuredStatus}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: /Push local to Gist/i }),
    )

    expect(onPushLocal).toHaveBeenCalledWith({
      confirmRemoteOverwrite: false,
    })
    expect(onPushLocal).not.toHaveBeenCalledWith({
      confirmRemoteOverwrite: true,
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /open Settings to overwrite/i,
    )
  })
})
```

Reuse the same status/result fixture shapes from Task 5 in this file.

- [ ] **Step 2: Write failing dashboard route test**

In `src/app/dashboard/routes.test.tsx`, add a `sync.getStatus` branch to the default `sendMessage` mock:

```ts
if (method === 'sync.getStatus') {
  return Promise.resolve(notConfiguredSyncStatus)
}
```

Add status fixtures near the existing test fixtures:

```ts
const notConfiguredSyncStatus = {
  enabled: false,
  configured: false,
  tokenConfigured: false,
  tokenStatus: {
    provider: 'github:gist',
    configured: false,
    updatedAt: null,
    fingerprint: null,
  },
  gistId: null,
  isSyncing: false,
  lastSyncAt: null,
  lastSyncDirection: null,
  lastPullAt: null,
  lastPushAt: null,
  needsPush: false,
  lastBlockingReason: null,
  lastError: null,
  conflict: null,
} as const

const configuredSyncStatus = {
  ...notConfiguredSyncStatus,
  enabled: true,
  configured: true,
  tokenConfigured: true,
  tokenStatus: {
    provider: 'github:gist',
    configured: true,
    updatedAt: '2026-05-26T12:00:00.000Z',
    fingerprint: 'abcdef123456',
  },
  gistId: 'gist_1',
  lastSyncAt: '2026-05-26T12:00:00.000Z',
  lastSyncDirection: 'push',
  lastPushAt: '2026-05-26T12:00:00.000Z',
} as const
```

Add:

```ts
it('renders dashboard header pull and push shortcuts when sync is configured', async () => {
  vi.mocked(sendMessage).mockImplementation((method) => {
    if (method === 'settings.getSettings') {
      return Promise.resolve(defaultUserSettings)
    }

    if (method === 'app.getShellData') {
      return Promise.resolve(createDashboardAppShellData())
    }

    if (method === 'sync.getStatus') {
      return Promise.resolve(configuredSyncStatus)
    }

    if (method === 'sync.pullLatest' || method === 'sync.pushLocal') {
      return Promise.resolve({
        action: method === 'sync.pullLatest' ? 'pull-latest' : 'push-local',
        direction: method === 'sync.pullLatest' ? 'pull' : 'push',
        outcome: 'success',
        reason: null,
        retryable: false,
        message:
          method === 'sync.pullLatest'
            ? 'Latest Gist data pulled.'
            : 'Local data pushed to Gist.',
        occurredAt: '2026-05-26T12:30:00.000Z',
        status: configuredSyncStatus,
      })
    }

    if (method === 'tracks.getWorkspace') {
      return Promise.resolve(createTrackWorkspaceResponse())
    }

    return Promise.resolve(defaultUserSettings)
  })

  const { user } = renderDashboard('/')

  await screen.findByRole('heading', { name: 'Overview' })
  await user.click(
    await screen.findByRole('button', { name: /Pull latest from Gist/i }),
  )
  await user.click(screen.getByRole('button', { name: /Push local to Gist/i }))

  expect(sendMessage).toHaveBeenCalledWith('sync.pullLatest', {
    surface: 'dashboard',
  })
  expect(sendMessage).toHaveBeenCalledWith('sync.pushLocal', {
    surface: 'dashboard',
    confirmRemoteOverwrite: false,
  })
})
```

- [ ] **Step 3: Run header tests and verify failure**

Run:

```bash
npm run test -- src/features/sync/components/dashboard-sync-actions.test.tsx src/app/dashboard/routes.test.tsx
```

Expected: fail because the header component and context wiring do not exist.

- [ ] **Step 4: Implement dashboard sync action component**

Create `src/features/sync/components/dashboard-sync-actions.tsx`:

```tsx
import { CloudDownload, CloudUpload } from 'lucide-react'
import { useState } from 'react'

import { IconButton } from '@/components/ui/icon-button'

import type {
  SerializedSyncStatus,
  SyncActionResult,
} from '../api/sync-contracts'
import { usePullLatest, usePushLocal, useSyncStatus } from '../api/sync-api'

type MaybePromise<T> = T | Promise<T>

export function DashboardSyncActions() {
  const statusQuery = useSyncStatus()
  const pullLatest = usePullLatest()
  const pushLocal = usePushLocal()

  return (
    <DashboardSyncActionsView
      isPending={
        statusQuery.isPending ||
        pullLatest.isPending ||
        pushLocal.isPending ||
        Boolean(statusQuery.data?.isSyncing)
      }
      onPullLatest={() => pullLatest.mutateAsync()}
      onPushLocal={(input) => pushLocal.mutateAsync(input)}
      status={statusQuery.data ?? null}
    />
  )
}

export function DashboardSyncActionsView({
  isPending = false,
  onPullLatest,
  onPushLocal,
  status,
}: {
  isPending?: boolean
  onPullLatest: () => MaybePromise<SyncActionResult>
  onPushLocal: (input: {
    confirmRemoteOverwrite?: boolean
  }) => MaybePromise<SyncActionResult>
  status: SerializedSyncStatus | null
}) {
  const [feedback, setFeedback] = useState<{
    message: string
    role: 'alert' | 'status'
  } | null>(null)
  const resolvedStatus = status

  if (!resolvedStatus?.configured) {
    return null
  }

  async function runPullLatest() {
    setFeedback(null)
    try {
      const result = await onPullLatest()
      setFeedback({ message: result.message, role: 'status' })
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : 'Pull latest from Gist failed.',
        role: 'alert',
      })
    }
  }

  async function runPushLocal() {
    setFeedback(null)
    try {
      const result = await onPushLocal({ confirmRemoteOverwrite: false })
      setFeedback({
        message:
          result.outcome === 'confirmation-required'
            ? 'Remote changed. Open Settings to overwrite the Gist.'
            : result.message,
        role:
          result.outcome === 'confirmation-required' ||
          result.outcome === 'error'
            ? 'alert'
            : 'status',
      })
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error ? error.message : 'Push local to Gist failed.',
        role: 'alert',
      })
    }
  }

  return (
    <>
      <IconButton
        disabled={Boolean(isPending)}
        label="Pull latest from Gist"
        onClick={() => {
          void runPullLatest()
        }}
        tooltip="Pull latest from Gist"
        variant="ghost"
      >
        <CloudDownload aria-hidden="true" />
      </IconButton>
      <IconButton
        disabled={Boolean(isPending)}
        label="Push local to Gist"
        onClick={() => {
          void runPushLocal()
        }}
        tooltip="Push local to Gist"
        variant="ghost"
      >
        <CloudUpload aria-hidden="true" />
      </IconButton>
      {feedback ? (
        <span className="sr-only" role={feedback.role}>
          {feedback.message}
        </span>
      ) : null}
    </>
  )
}
```

Export it from `src/features/sync/index.ts`:

```ts
export { DashboardSyncActions } from './components/dashboard-sync-actions'
```

- [ ] **Step 5: Implement dashboard header composition**

Create `src/app/dashboard/components/dashboard-header-actions.tsx`:

```tsx
import { DashboardSyncActions } from '@/features/sync'
import { type ThemeMode } from '@/features/settings'

import { ThemeModeButton } from './theme-mode-button'

export function DashboardHeaderActions({
  isThemePending,
  onCycleThemeMode,
  themeMode,
}: {
  isThemePending: boolean
  onCycleThemeMode: () => void
  themeMode: ThemeMode
}) {
  return (
    <>
      <DashboardSyncActions />
      <ThemeModeButton
        isPending={isThemePending}
        onCycleThemeMode={onCycleThemeMode}
        themeMode={themeMode}
      />
    </>
  )
}
```

In `src/app/dashboard/dashboard-shell.tsx`, replace `themeAction` with `headerActions`:

```ts
interface DashboardChromeContextValue {
  headerActions: ReactNode
  themeMode: ThemeMode
}
```

Import `DashboardHeaderActions` and create:

```tsx
const headerActions = (
  <DashboardHeaderActions
    isThemePending={cycleThemeMode.isPending}
    onCycleThemeMode={handleCycleThemeMode}
    themeMode={themeMode}
  />
)
```

Provide:

```tsx
<DashboardChromeContext.Provider value={{ headerActions, themeMode }}>
```

In the dashboard page files, replace:

```ts
const { themeAction } = useDashboardChrome()
```

with:

```ts
const { headerActions } = useDashboardChrome()
```

and replace `actions={themeAction}` with `actions={headerActions}`.

- [ ] **Step 6: Run header tests and commit**

Run:

```bash
npm run test -- src/features/sync/components/dashboard-sync-actions.test.tsx src/app/dashboard/routes.test.tsx
```

Expected: pass.

Commit:

```bash
git add src/features/sync/components/dashboard-sync-actions.tsx src/features/sync/components/dashboard-sync-actions.test.tsx src/app/dashboard/components/dashboard-header-actions.tsx src/app/dashboard/dashboard-shell.tsx src/app/dashboard/screens/analytics-page.tsx src/app/dashboard/screens/library-page.tsx src/app/dashboard/screens/overview-page.tsx src/app/dashboard/screens/settings-page.tsx src/app/dashboard/screens/tracks-page.tsx src/app/dashboard/routes.test.tsx src/features/sync/index.ts
git commit -m "feat: add dashboard sync header shortcuts"
```

## Task 7: Cleanup Old Smart-Sync Tests, Copy, And Exports

**Files:**

- Modify files found by `rg -n "Sync now|syncNow|resolveConflict|checkSyncOnOpen|sync\\.syncNow|sync\\.resolveConflict|sync\\.checkOnOpen" src docs`.

- [ ] **Step 1: Scan for old smart-sync references**

Run:

```bash
rg -n "Sync now|syncNow|resolveConflict|checkSyncOnOpen|sync\\.syncNow|sync\\.resolveConflict|sync\\.checkOnOpen" src docs
```

Expected after Tasks 1-6: remaining matches are only in historical Superpowers specs/plans or explicit compatibility notes in `sync-service.ts`. No current docs, user-facing UI, runtime policy, runtime protocol, tests, or feature API hooks should reference the old user-facing smart-sync model.

- [ ] **Step 2: Remove or update current-code references**

For each current source/test match:

- Replace `Sync now` visible copy with `Pull latest` and `Push local`.
- Replace `syncNow` function calls with `pullLatest` or `pushLocal`.
- Replace `resolveConflict('pull-remote')` with `pullLatest`.
- Replace `resolveConflict('push-local')` with `pushLocal({ confirmRemoteOverwrite: true })`.
- Remove `checkSyncOnOpenViaRuntime` imports and tests.

Do not edit historical files under `docs/superpowers/specs` or older plans unless they are the new directional plan or README index.

- [ ] **Step 3: Run focused search until clean**

Run:

```bash
rg -n "Sync now|syncNow|resolveConflict|checkSyncOnOpen|sync\\.syncNow|sync\\.resolveConflict|sync\\.checkOnOpen" src docs/product.md docs/architecture.md docs/testing.md
```

Expected: no matches.

- [ ] **Step 4: Run sync-focused tests and commit**

Run:

```bash
npm run test -- src/features/sync src/extension/background/runtime-policy.test.ts src/extension/background/register-handlers.test.ts src/app/dashboard/routes.test.tsx
```

Expected: pass.

Commit:

```bash
git add src docs/product.md docs/architecture.md docs/testing.md
git commit -m "refactor: remove old smart sync surface"
```

If no docs were edited in this task, omit the docs paths from `git add`.

## Task 8: Current Docs And Full Verification

**Files:**

- Modify: `docs/product.md`
- Modify: `docs/architecture.md`
- Modify: `docs/testing.md`
- Modify: `docs/superpowers/README.md`

- [ ] **Step 1: Update product docs**

In `docs/product.md`, replace the current Sync section paragraph that says sync happens on open/reload/first interaction/manual settings actions/after local mutations with:

```md
GitHub Gist sync is optional, BYOK, and pseudo-real-time rather than live
collaborative editing. A user stores a GitHub token locally, creates or connects
a private CogniPace Gist, then uses explicit directional actions:

- Pull latest: update this browser from the connected Gist.
- Push local: update the connected Gist from this browser.

Local writes always save locally first and mark data as needing push. A pull is
blocked when local changes have not been pushed. A push that would overwrite a
changed remote Gist requires explicit confirmation. Retryable sync failures are
shown in Settings and do not roll back local saves.
```

- [ ] **Step 2: Update architecture docs**

In `docs/architecture.md`, update the Sync ownership and runtime method names in the relevant sections:

```md
The sync feature owns GitHub Gist configuration, metadata, directional pull/push
rules, and Settings/header sync UI. Manual `sync.pullLatest` and
`sync.pushLocal` runtime methods are dashboard-only. Local mutations mark sync
metadata dirty after the database snapshot is flushed; this manual-first pass
does not auto-push after mutations or auto-pull on surface open.
```

In the runtime method checklist, ensure directional sync follows the same Zod,
authorization, service, flush, and invalidation rules as other runtime methods.

- [ ] **Step 3: Update testing docs**

In `docs/testing.md`, replace the GitHub Gist Sync smoke steps with:

```md
4. Create a private Gist, then use Push local.
5. Export a backup and confirm the token value is not present in the JSON.
6. Load CogniPace in a second Chrome profile or browser install.
7. Save the same token and connect the Gist ID.
8. Use Pull latest and confirm the second install matches the pushed data.
9. Make a local change in one install and confirm Settings shows local data needs push.
10. Use Push local, then Pull latest in the other install.
11. Create a conflict by changing both installs before pushing, then confirm pull is blocked when local data is dirty and push requires overwrite confirmation when the remote changed.
```

Update the expected paragraph:

```md
Expected: sync is pseudo-real-time rather than live collaborative editing. Manual
pull and push are directionally clear, local writes are not blocked by GitHub
failures, destructive overwrite requires confirmation, and tokens stay in
trusted local extension storage rather than backups or sync files.
```

- [ ] **Step 4: Add this plan to Superpowers README**

In `docs/superpowers/README.md`, add under Plans:

```md
- [`plans/2026-05-26-directional-gist-sync.md`](./plans/2026-05-26-directional-gist-sync.md): implementation plan for directional manual GitHub Gist pull/push actions, dashboard header shortcuts, and sync test cleanup.
```

- [ ] **Step 5: Run docs formatting**

Run:

```bash
npx prettier --check docs/product.md docs/architecture.md docs/testing.md docs/superpowers/README.md docs/superpowers/plans/2026-05-26-directional-gist-sync.md
```

Expected: pass. If it fails, run:

```bash
npx prettier --write docs/product.md docs/architecture.md docs/testing.md docs/superpowers/README.md docs/superpowers/plans/2026-05-26-directional-gist-sync.md
```

Then rerun the `--check` command.

- [ ] **Step 6: Run full verification**

Run:

```bash
npm run check
```

Expected: pass.

- [ ] **Step 7: Commit docs and verification cleanup**

Commit:

```bash
git add docs/product.md docs/architecture.md docs/testing.md docs/superpowers/README.md docs/superpowers/plans/2026-05-26-directional-gist-sync.md
git commit -m "docs: update directional sync behavior"
```

If implementation tasks already committed the plan file, only stage docs changed in this task.

## Final Review Checklist

- [ ] Settings shows `Pull latest` and `Push local`.
- [ ] Settings does not show `Sync now`.
- [ ] Dashboard header shows cloud down/up buttons only when sync is configured.
- [ ] Pull with dirty local data returns `blocked` and does not restore.
- [ ] Push with changed remote returns `confirmation-required` and does not overwrite.
- [ ] Confirmed push overwrites remote and clears dirty state.
- [ ] Local mutations mark `needsPush` and do not auto-push in this pass.
- [ ] Directional action results include action, direction, outcome, reason, retryable, message, status, and occurredAt.
- [ ] Result/status payloads do not contain token-like strings.
- [ ] Current docs describe manual directional sync, not the old smart-sync model.
- [ ] Focused sync/runtime/dashboard tests pass.
- [ ] `npm run check` passes before handoff.
