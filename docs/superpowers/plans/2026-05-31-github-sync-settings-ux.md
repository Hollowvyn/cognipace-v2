# GitHub Sync Settings UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign GitHub Sync Settings so connection setup lives in a dialog, connected state is clear, auto-sync can be paused without disconnecting, and manual pull/push still work while paused.

**Architecture:** Keep ownership in `src/features/sync`. Treat `status.configured` as the connection state and `status.enabled` as the auto-sync state, while preserving existing runtime/storage names for v1. Split the settings card from the new connect/manage dialog so token and Gist drafts stay localized and manual sync result dialogs remain unchanged.

**Tech Stack:** React 19, TypeScript, Tailwind tokens, lucide-react, TanStack Query, Zod runtime contracts, Vitest, React Testing Library, WXT Chrome MV3 runtime.

---

## Scope Check

This plan covers one subsystem: GitHub Sync Settings UX and the minimum service semantics required by that UX. It does not change backup/import cards, GitHub token storage, OAuth, sync envelope format, or automatic sync scheduling internals.

## File Structure

- Modify `src/features/sync/server/sync-service.ts`
  - Keep automatic sync gated by `metadata.enabled`.
  - Let manual `pullLatest` and `pushLocal` run when token plus Gist are configured, even if `metadata.enabled` is false.
  - Add a stored-token validation service method so the UI can re-check a saved token without exposing it.
  - Change `setEnabled` result messages to auto-sync language.
- Modify `src/features/sync/server/sync-service.test.ts`
  - Lock in manual pull/push behavior while auto-sync is paused.
  - Lock in saved-token validation without UI token reads.
  - Lock in auto-sync pause/resume messages.
- Modify `src/features/sync/api/sync-api.ts`
  - Add `validateStoredGithubTokenViaRuntime`.
- Modify `src/features/sync/api/sync-api.test.tsx`
  - Assert stored-token validation sends a dashboard-only runtime request.
- Modify `src/extension/messaging.ts`
  - Add the `sync.validateStoredGithubToken` protocol method.
- Modify `src/extension/background/runtime-policy.ts`
  - Authorize stored-token validation for dashboard only.
- Modify `src/extension/background/runtime-policy.test.ts`
  - Keep privileged sync methods dashboard-only.
- Modify `src/extension/background/register-handlers.ts`
  - Add the stored-token validation runtime handler.
- Modify `src/extension/background/register-handlers.test.ts`
  - Assert parsing, authorization, and service delegation for the new runtime method.
- Modify `src/features/sync/hooks/use-github-sync-controller.ts`
  - Expose `onSetAutoSyncEnabled(enabled)` to the panel.
  - Expose `onValidateStoredToken()` to the panel.
- Modify `src/features/sync/hooks/use-github-sync-controller.test.tsx`
  - Assert the controller wires the runtime set-enabled mutation into the panel actions.
  - Assert the controller wires stored-token validation into the panel actions.
- Modify `src/features/sync/components/github-sync-panel.tsx`
  - Replace always-visible setup fields with the summary card.
  - Add `Connect GitHub Sync` and `Manage connection` dialog entry points.
  - Add `Pause auto-sync` / `Resume auto-sync` action.
  - Keep manual pull/push result and force dialogs.
- Create `src/features/sync/components/github-sync-connection-dialog.tsx`
  - Own token draft, token replacement mode, Gist draft, same-row field/action groups, and scoped setup feedback.
- Create `src/features/sync/components/github-sync-connection-dialog.test.tsx`
  - Test token masking, replacement, validation, same logical row grouping, and Gist action availability.
- Modify `src/features/sync/components/github-sync-panel.test.tsx`
  - Replace old always-visible field tests with card/dialog behavior tests.
  - Preserve force pull/push/manual result coverage.
- Modify `src/features/sync/components/dashboard-sync-actions.test.tsx`
  - Add paused connected coverage for header shortcuts.
- Modify docs:
  - `docs/product.md`
  - `docs/testing.md`
  - `docs/architecture.md`

## Task 1: Manual Sync Works While Auto-Sync Is Paused

**Files:**

- Modify: `src/features/sync/server/sync-service.test.ts`
- Modify: `src/features/sync/server/sync-service.ts`

- [ ] **Step 1: Write failing service tests**

Add these tests near the existing `pullLatest` and `pushLocal` tests in `src/features/sync/server/sync-service.test.ts`:

```ts
it('pullLatest works while auto-sync is paused when token and Gist are connected', async () => {
  const harness = createHarness()
  harness.setMetadata({
    enabled: false,
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
    message: 'Latest Gist data pulled.',
  })
  expect(harness.restoreBackup).toHaveBeenCalledWith(backup)
  expect(harness.getMetadata()).toMatchObject({
    enabled: true,
    gistId: 'gist_1',
    lastPullAt: currentTime,
    lastSyncDirection: 'pull',
  })
})

it('pushLocal works while auto-sync is paused when token and Gist are connected', async () => {
  const harness = createHarness()
  harness.setMetadata({
    enabled: false,
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
    message: 'Local data pushed to Gist.',
  })
  expect(harness.githubClient.updateSyncGist).toHaveBeenCalledTimes(1)
  expect(harness.getMetadata()).toMatchObject({
    enabled: true,
    dirtySinceLastSync: false,
    lastPushAt: currentTime,
    lastSyncDirection: 'push',
  })
})

it('uses auto-sync wording when pausing or resuming sync automation', async () => {
  const harness = createHarness()

  await expect(harness.service.setEnabled(false)).resolves.toMatchObject({
    action: 'set-enabled',
    direction: null,
    outcome: 'success',
    message: 'Auto-sync paused.',
  })
  expect(harness.getMetadata().enabled).toBe(false)

  await expect(harness.service.setEnabled(true)).resolves.toMatchObject({
    action: 'set-enabled',
    direction: null,
    outcome: 'success',
    message: 'Auto-sync resumed.',
  })
  expect(harness.getMetadata().enabled).toBe(true)
})
```

- [ ] **Step 2: Run the focused service tests and verify failure**

Run:

```bash
npm test -- src/features/sync/server/sync-service.test.ts
```

Expected: the new paused manual pull/push tests fail because `pullLatest` and `pushLocal` currently treat `enabled: false` as not configured. The wording test fails because `setEnabled` returns `GitHub sync enabled.` / `GitHub sync disabled.`.

- [ ] **Step 3: Implement the service behavior**

In `src/features/sync/server/sync-service.ts`, change `setEnabled`:

```ts
async function setEnabled(enabled: boolean): Promise<SyncActionResult> {
  const message = await runExclusive(async () => {
    await deps.writeMetadata({ enabled })

    return enabled ? 'Auto-sync resumed.' : 'Auto-sync paused.'
  })

  return createActionResult({
    action: 'set-enabled',
    direction: null,
    message,
  })
}
```

In `pullLatest`, replace the not-configured guard with a token-plus-Gist guard:

```ts
const [metadata, tokenStatus] = await Promise.all([
  deps.readMetadata(),
  deps.getTokenStatus(),
])

if (!metadata.gistId || !tokenStatus.configured) {
  await deps.writeMetadata({ lastBlockingReason: 'not-configured' })

  return createActionResult({
    action: 'pull-latest',
    direction: 'pull',
    outcome: 'blocked',
    reason: 'not-configured',
    message: 'GitHub Gist sync is not connected.',
  })
}
```

In `pushLocal`, make the same guard:

```ts
const [metadata, tokenStatus] = await Promise.all([
  deps.readMetadata(),
  deps.getTokenStatus(),
])

if (!metadata.gistId || !tokenStatus.configured) {
  await deps.writeMetadata({ lastBlockingReason: 'not-configured' })

  return createActionResult({
    action: 'push-local',
    direction: 'push',
    outcome: 'blocked',
    reason: 'not-configured',
    message: 'GitHub Gist sync is not connected.',
  })
}
```

Do not change `checkRemoteOnOpen`; it must continue to skip when `metadata.enabled` is false.

- [ ] **Step 4: Run the service tests and verify pass**

Run:

```bash
npm test -- src/features/sync/server/sync-service.test.ts
```

Expected: all sync service tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/sync/server/sync-service.ts src/features/sync/server/sync-service.test.ts
git commit -m "fix(sync): allow manual sync while auto-sync is paused"
```

## Task 2: Add Stored Token Validation Runtime

**Files:**

- Modify: `src/features/sync/server/sync-service.test.ts`
- Modify: `src/features/sync/server/sync-service.ts`
- Modify: `src/features/sync/api/sync-api.test.tsx`
- Modify: `src/features/sync/api/sync-api.ts`
- Modify: `src/extension/messaging.ts`
- Modify: `src/extension/background/runtime-policy.test.ts`
- Modify: `src/extension/background/runtime-policy.ts`
- Modify: `src/extension/background/register-handlers.test.ts`
- Modify: `src/extension/background/register-handlers.ts`

- [ ] **Step 1: Write failing service and API tests**

Add this test near the token validation tests in `src/features/sync/server/sync-service.test.ts`:

```ts
it('validates the configured token without exposing it to the UI', async () => {
  const harness = createHarness()

  await expect(
    harness.service.validateStoredGithubToken(),
  ).resolves.toMatchObject({
    action: 'validate-token',
    direction: null,
    outcome: 'success',
    message: 'GitHub token validated.',
  })

  expect(harness.githubClient.validateToken).toHaveBeenCalledTimes(1)
})
```

Add this test in `src/features/sync/api/sync-api.test.tsx`:

```ts
it('validates the stored token through a dashboard runtime request', async () => {
  vi.mocked(sendMessage).mockResolvedValue(syncActionResult)

  await validateStoredGithubTokenViaRuntime()

  expect(sendMessage).toHaveBeenCalledWith('sync.validateStoredGithubToken', {
    surface: 'dashboard',
  })
})
```

Update the import from `./sync-api` in that test file:

```ts
import {
  checkRemoteOnOpenViaRuntime,
  connectGithubGistViaRuntime,
  pullLatestViaRuntime,
  pushLocalViaRuntime,
  saveGithubTokenViaRuntime,
  usePullLatest,
  usePushLocal,
  useSyncAction,
  validateStoredGithubTokenViaRuntime,
} from './sync-api'
```

Add `sync.validateStoredGithubToken` to the privileged sync method list in `src/extension/background/runtime-policy.test.ts`:

```ts
for (const method of [
  'sync.validateGithubToken',
  'sync.validateStoredGithubToken',
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
```

Add this handler test near the existing sync token handler tests in `src/extension/background/register-handlers.test.ts`:

```ts
it('validates the stored GitHub token through the dashboard runtime boundary', async () => {
  backgroundMocks.syncService.validateStoredGithubToken.mockResolvedValue(
    parsedSyncActionResult,
  )

  const response = await sendRuntimeMessage('sync.validateStoredGithubToken', {
    surface: 'dashboard',
  })

  expectRuntimePolicy('sync.validateStoredGithubToken', 'dashboard')
  expect(
    backgroundMocks.syncService.validateStoredGithubToken,
  ).toHaveBeenCalledTimes(1)
  expect(response).toEqual(parsedSyncActionResult)
})
```

If `backgroundMocks.syncService` has a typed mock object, add `validateStoredGithubToken: vi.fn()` beside `validateGithubToken`.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
npm test -- \
  src/features/sync/server/sync-service.test.ts \
  src/features/sync/api/sync-api.test.tsx \
  src/extension/background/runtime-policy.test.ts \
  src/extension/background/register-handlers.test.ts
```

Expected: FAIL because the stored-token runtime path is not implemented.

- [ ] **Step 3: Implement stored-token service validation**

In `src/features/sync/server/sync-service.ts`, add this function next to `validateGithubToken`:

```ts
async function validateStoredGithubToken(): Promise<SyncActionResult> {
  try {
    const client = await readConfiguredClient()
    await client.validateToken()
    await deps.writeMetadata({ lastError: null })

    return createActionResult({
      action: 'validate-token',
      direction: null,
      message: 'GitHub token validated.',
    })
  } catch (error) {
    await recordError(error, false)
    throw error
  }
}
```

Return it from the service object:

```ts
return {
  checkRemoteOnOpen,
  connectGithubGist,
  createGithubGist,
  deleteGithubToken,
  getStatus,
  pullLatest,
  pushLocal,
  saveGithubToken,
  setEnabled,
  validateGithubToken,
  validateStoredGithubToken,
}
```

- [ ] **Step 4: Implement API, messaging, policy, and handler wiring**

In `src/features/sync/api/sync-api.ts`, add:

```ts
export function validateStoredGithubTokenViaRuntime() {
  return sendMessage('sync.validateStoredGithubToken', {
    surface: 'dashboard',
  })
}
```

In `src/extension/messaging.ts`, add the protocol method:

```ts
'sync.validateStoredGithubToken'(request: SyncRequest): SyncActionResult
```

In `src/extension/background/runtime-policy.ts`, add dashboard-only access:

```ts
'sync.validateStoredGithubToken': ['dashboard'],
```

In `src/extension/background/register-handlers.ts`, add the handler immediately after `sync.validateGithubToken`:

```ts
onMessage('sync.validateStoredGithubToken', ({ data, sender }) => {
  const request = syncRequestSchema.parse(data)

  assertCanSenderCallExtensionMethod(
    'sync.validateStoredGithubToken',
    request.surface,
    sender,
  )
  return getAppDb().then(async ({ db }) =>
    parseSyncActionResult(
      await runQueuedSyncAction(db, (service) =>
        service.validateStoredGithubToken(),
      ),
    ),
  )
})
```

- [ ] **Step 5: Run focused tests and verify pass**

Run:

```bash
npm test -- \
  src/features/sync/server/sync-service.test.ts \
  src/features/sync/api/sync-api.test.tsx \
  src/extension/background/runtime-policy.test.ts \
  src/extension/background/register-handlers.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add \
  src/features/sync/server/sync-service.ts \
  src/features/sync/server/sync-service.test.ts \
  src/features/sync/api/sync-api.ts \
  src/features/sync/api/sync-api.test.tsx \
  src/extension/messaging.ts \
  src/extension/background/runtime-policy.ts \
  src/extension/background/runtime-policy.test.ts \
  src/extension/background/register-handlers.ts \
  src/extension/background/register-handlers.test.ts
git commit -m "feat(sync): validate stored GitHub token in background"
```

## Task 3: Expose Auto-Sync and Stored-Token Actions Through the Controller

**Files:**

- Modify: `src/features/sync/hooks/use-github-sync-controller.test.tsx`
- Modify: `src/features/sync/hooks/use-github-sync-controller.ts`
- Modify: `src/features/sync/components/github-sync-panel.tsx`

- [ ] **Step 1: Write the failing controller tests**

In `src/features/sync/hooks/use-github-sync-controller.test.tsx`, add import mock assertions for `setSyncEnabledViaRuntime` and `validateStoredGithubTokenViaRuntime` if they are not already exposed in the existing mock, then add these tests:

```ts
it('exposes auto-sync pause and resume through panel actions', async () => {
  const { result } = renderHook(() => useGithubSyncController(), {
    wrapper: createQueryWrapper(),
  })

  await waitFor(() => {
    expect(result.current.status).toEqual(configuredStatus)
  })

  await result.current.actions.onSetAutoSyncEnabled(false)

  expect(setSyncEnabledViaRuntime).toHaveBeenCalledWith(false)

  await result.current.actions.onSetAutoSyncEnabled(true)

  expect(setSyncEnabledViaRuntime).toHaveBeenCalledWith(true)
})

it('exposes stored token validation through panel actions', async () => {
  const { result } = renderHook(() => useGithubSyncController(), {
    wrapper: createQueryWrapper(),
  })

  await waitFor(() => {
    expect(result.current.status).toEqual(configuredStatus)
  })

  await result.current.actions.onValidateStoredToken()

  expect(validateStoredGithubTokenViaRuntime).toHaveBeenCalledTimes(1)
})
```

If this test file mocks `sync-api` as a module factory, add this mock function in that factory:

```ts
const setSyncEnabledViaRuntime = vi.fn().mockResolvedValue({
  ...syncActionResult,
  action: 'set-enabled',
  message: 'Auto-sync paused.',
})

const validateStoredGithubTokenViaRuntime = vi.fn().mockResolvedValue({
  ...syncActionResult,
  action: 'validate-token',
  message: 'GitHub token validated.',
})
```

- [ ] **Step 2: Run the focused controller test and verify failure**

Run:

```bash
npm test -- src/features/sync/hooks/use-github-sync-controller.test.tsx
```

Expected: FAIL because `actions.onSetAutoSyncEnabled` and `actions.onValidateStoredToken` do not exist on the controller actions.

- [ ] **Step 3: Add the action type and controller wiring**

In `src/features/sync/components/github-sync-panel.tsx`, extend `GitHubSyncPanelActions`:

```ts
export interface GitHubSyncPanelActions {
  onConnectGist: (gistId: string) => GitHubSyncActionResult
  onCreateGist: () => GitHubSyncActionResult
  onDeleteToken: () => GitHubSyncActionResult
  onPullLatest: (input?: {
    confirmLocalOverwrite?: boolean
  }) => GitHubSyncActionResult
  onPushLocal: (input?: {
    confirmRemoteOverwrite?: boolean
  }) => GitHubSyncActionResult
  onSaveToken: (token: string) => GitHubSyncActionResult
  onSetAutoSyncEnabled: (enabled: boolean) => GitHubSyncActionResult
  onValidateStoredToken: () => GitHubSyncActionResult
  onValidateToken: (token: string) => GitHubSyncActionResult
}
```

In `src/features/sync/hooks/use-github-sync-controller.ts`, import `setSyncEnabledViaRuntime` and `validateStoredGithubTokenViaRuntime`:

```ts
import {
  connectGithubGistViaRuntime,
  createGithubGistViaRuntime,
  deleteGithubTokenViaRuntime,
  saveGithubTokenViaRuntime,
  setSyncEnabledViaRuntime,
  usePullLatest,
  usePushLocal,
  useSyncAction,
  useSyncStatus,
  validateGithubTokenViaRuntime,
  validateStoredGithubTokenViaRuntime,
} from '../api/sync-api'
```

Create the mutations:

```ts
const setAutoSyncEnabled = useSyncAction((enabled: boolean) =>
  setSyncEnabledViaRuntime(enabled),
)
const validateStoredToken = useSyncAction(() =>
  validateStoredGithubTokenViaRuntime(),
)
```

Add them to actions:

```ts
onSetAutoSyncEnabled: (enabled) => setAutoSyncEnabled.mutateAsync(enabled),
onValidateStoredToken: () => validateStoredToken.mutateAsync(),
```

Add them to `isPending`:

```ts
setAutoSyncEnabled.isPending ||
validateStoredToken.isPending ||
```

- [ ] **Step 4: Run the controller test and verify pass**

Run:

```bash
npm test -- src/features/sync/hooks/use-github-sync-controller.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sync/hooks/use-github-sync-controller.ts src/features/sync/hooks/use-github-sync-controller.test.tsx src/features/sync/components/github-sync-panel.tsx
git commit -m "feat(sync): expose auto-sync toggle action"
```

## Task 4: Build the Connect/Manage Dialog with Tests

**Files:**

- Create: `src/features/sync/components/github-sync-connection-dialog.tsx`
- Create: `src/features/sync/components/github-sync-connection-dialog.test.tsx`
- Modify: `src/features/sync/components/github-sync-panel.tsx`

- [ ] **Step 1: Write failing dialog tests**

Create `src/features/sync/components/github-sync-connection-dialog.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { SerializedSyncStatus } from '../api/sync-contracts'
import type { GitHubSyncPanelActions } from './github-sync-panel'
import { GitHubSyncConnectionDialog } from './github-sync-connection-dialog'

describe('GitHubSyncConnectionDialog', () => {
  it('renders setup token and Gist controls in grouped rows', () => {
    render(
      <GitHubSyncConnectionDialog
        actions={createActions()}
        isPending={false}
        onActionResult={vi.fn()}
        onClose={vi.fn()}
        status={notConfiguredStatus}
      />,
    )

    expect(
      screen.getByRole('dialog', { name: 'Connect GitHub Sync' }),
    ).toBeVisible()

    const tokenGroup = screen.getByRole('group', { name: 'GitHub token' })
    expect(within(tokenGroup).getByLabelText('GitHub token')).toHaveAttribute(
      'type',
      'password',
    )
    expect(
      within(tokenGroup).getByRole('button', { name: 'Save token' }),
    ).toBeDisabled()
    expect(
      within(tokenGroup).getByRole('button', { name: 'Test token' }),
    ).toBeDisabled()

    const gistGroup = screen.getByRole('group', { name: 'Private Gist' })
    expect(within(gistGroup).getByLabelText('Private Gist')).toBeVisible()
    expect(
      within(gistGroup).getByRole('button', { name: 'Connect Gist' }),
    ).toBeDisabled()
    expect(
      within(gistGroup).getByRole('button', { name: 'Create private Gist' }),
    ).toBeDisabled()
  })

  it('shows a masked verified saved token without exposing the token value', () => {
    render(
      <GitHubSyncConnectionDialog
        actions={createActions()}
        isPending={false}
        onActionResult={vi.fn()}
        onClose={vi.fn()}
        status={configuredStatus}
      />,
    )

    const tokenGroup = screen.getByRole('group', { name: 'GitHub token' })
    expect(within(tokenGroup).getByLabelText('GitHub token')).toHaveValue(
      '................',
    )
    expect(within(tokenGroup).getByLabelText('GitHub token')).toHaveAttribute(
      'readOnly',
    )
    expect(screen.getByText(/Verified with GitHub/i)).toBeVisible()
    expect(screen.queryByDisplayValue('ghp_secret')).not.toBeInTheDocument()
  })

  it('switches from masked saved token to password entry when replacing token', async () => {
    const user = userEvent.setup()
    render(
      <GitHubSyncConnectionDialog
        actions={createActions()}
        isPending={false}
        onActionResult={vi.fn()}
        onClose={vi.fn()}
        status={configuredStatus}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Replace token' }))

    expect(screen.getByLabelText('GitHub token')).toHaveAttribute(
      'type',
      'password',
    )
    expect(screen.getByLabelText('GitHub token')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Save token' })).toBeDisabled()
  })

  it('validates and saves tokens before enabling Gist actions in the dialog session', async () => {
    const user = userEvent.setup()
    const actions = createActions()
    actions.onSaveToken.mockResolvedValue(syncActionResult)
    const onActionResult = vi.fn()

    render(
      <GitHubSyncConnectionDialog
        actions={actions}
        isPending={false}
        onActionResult={onActionResult}
        onClose={vi.fn()}
        status={notConfiguredStatus}
      />,
    )

    await user.type(screen.getByLabelText('GitHub token'), 'ghp_secret')
    await user.click(screen.getByRole('button', { name: 'Save token' }))

    expect(actions.onSaveToken).toHaveBeenCalledWith('ghp_secret')
    expect(onActionResult).toHaveBeenCalledWith(syncActionResult)
    expect(
      screen.getByRole('button', { name: 'Create private Gist' }),
    ).toBeEnabled()
  })

  it('tests a token without saving it', async () => {
    const user = userEvent.setup()
    const actions = createActions()
    actions.onValidateToken.mockResolvedValue(syncActionResult)

    render(
      <GitHubSyncConnectionDialog
        actions={actions}
        isPending={false}
        onActionResult={vi.fn()}
        onClose={vi.fn()}
        status={notConfiguredStatus}
      />,
    )

    await user.type(screen.getByLabelText('GitHub token'), 'ghp_secret')
    await user.click(screen.getByRole('button', { name: 'Test token' }))

    expect(actions.onValidateToken).toHaveBeenCalledWith('ghp_secret')
    expect(actions.onSaveToken).not.toHaveBeenCalled()
  })

  it('tests a saved token through the background without exposing the token', async () => {
    const user = userEvent.setup()
    const actions = createActions()
    actions.onValidateStoredToken.mockResolvedValue(syncActionResult)

    render(
      <GitHubSyncConnectionDialog
        actions={actions}
        isPending={false}
        onActionResult={vi.fn()}
        onClose={vi.fn()}
        status={configuredStatus}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Test token' }))

    expect(actions.onValidateStoredToken).toHaveBeenCalledTimes(1)
    expect(actions.onValidateToken).not.toHaveBeenCalled()
  })

  it('connects or creates a private Gist from the same Gist row', async () => {
    const user = userEvent.setup()
    const actions = createActions()
    actions.onConnectGist.mockResolvedValue(syncActionResult)
    actions.onCreateGist.mockResolvedValue(syncActionResult)

    render(
      <GitHubSyncConnectionDialog
        actions={actions}
        isPending={false}
        onActionResult={vi.fn()}
        onClose={vi.fn()}
        status={configuredStatus}
      />,
    )

    await user.clear(screen.getByLabelText('Private Gist'))
    await user.type(screen.getByLabelText('Private Gist'), 'gist_2')
    await user.click(screen.getByRole('button', { name: 'Connect Gist' }))
    await user.click(
      screen.getByRole('button', { name: 'Create private Gist' }),
    )

    expect(actions.onConnectGist).toHaveBeenCalledWith('gist_2')
    expect(actions.onCreateGist).toHaveBeenCalledTimes(1)
  })
})

const notConfiguredStatus = {
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
} satisfies SerializedSyncStatus

const configuredStatus = {
  ...notConfiguredStatus,
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
} satisfies SerializedSyncStatus

const syncActionResult = {
  action: 'set-enabled',
  direction: null,
  outcome: 'success',
  reason: null,
  retryable: false,
  message: 'GitHub sync updated.',
  status: configuredStatus,
  occurredAt: '2026-05-26T12:00:00.000Z',
} as const

function createActions() {
  return {
    onConnectGist: vi.fn(),
    onCreateGist: vi.fn(),
    onDeleteToken: vi.fn(),
    onPullLatest: vi.fn(),
    onPushLocal: vi.fn(),
    onSaveToken: vi.fn(),
    onSetAutoSyncEnabled: vi.fn(),
    onValidateStoredToken: vi.fn(),
    onValidateToken: vi.fn(),
  } satisfies Record<keyof GitHubSyncPanelActions, ReturnType<typeof vi.fn>>
}
```

- [ ] **Step 2: Run the dialog tests and verify failure**

Run:

```bash
npm test -- src/features/sync/components/github-sync-connection-dialog.test.tsx
```

Expected: FAIL because `github-sync-connection-dialog.tsx` does not exist.

- [ ] **Step 3: Implement the dialog component**

Create `src/features/sync/components/github-sync-connection-dialog.tsx`:

```tsx
import { GitBranch, KeyRound, Loader2, Trash2, UploadCloud } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { readErrorMessage } from '@/utils/errors'

import type {
  SerializedSyncStatus,
  SyncActionResult,
} from '../api/sync-contracts'
import type { GitHubSyncPanelActions } from './github-sync-panel'

const maskedTokenValue = '................'

export function GitHubSyncConnectionDialog({
  actions,
  isPending,
  onActionResult,
  onClose,
  status,
}: {
  actions: GitHubSyncPanelActions
  isPending: boolean
  onActionResult: (result: SyncActionResult | null | undefined | void) => void
  onClose: () => void
  status: SerializedSyncStatus
}) {
  const [token, setToken] = useState('')
  const [gistId, setGistId] = useState(status.gistId ?? '')
  const [tokenSavedInSession, setTokenSavedInSession] = useState(false)
  const [isReplacingToken, setIsReplacingToken] = useState(
    !status.tokenConfigured,
  )
  const [feedback, setFeedback] = useState<{
    message: string
    tone: 'danger' | 'success' | 'warning'
  } | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)

  const title = status.configured ? 'Manage GitHub Sync' : 'Connect GitHub Sync'
  const titleId = 'github-sync-connection-dialog-title'
  const descriptionId = 'github-sync-connection-dialog-description'
  const hasUsableToken = status.tokenConfigured || tokenSavedInSession
  const trimmedToken = token.trim()
  const trimmedGistId = gistId.trim()

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    closeButtonRef.current?.focus()

    return () => {
      previouslyFocused?.focus()
    }
  }, [])

  async function runConnectionAction(
    action: () =>
      | Promise<SyncActionResult | null | undefined | void>
      | SyncActionResult
      | null
      | undefined
      | void,
    successMessage: string,
    options: { afterSuccess?: () => void } = {},
  ) {
    try {
      const result = await action()
      const successful =
        !result ||
        result.outcome === 'success' ||
        result.outcome === 'no-change'

      setFeedback({
        message: result?.message ?? successMessage,
        tone: successful
          ? 'success'
          : result.outcome === 'error'
            ? 'danger'
            : 'warning',
      })
      onActionResult(result)

      if (successful) {
        options.afterSuccess?.()
      }
    } catch (error) {
      setFeedback({
        message: readErrorMessage(error, 'GitHub sync action failed.'),
        tone: 'danger',
      })
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !isPending) {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const dialog = dialogRef.current
    const focusableElements = dialog ? getFocusableElements(dialog) : []
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (!firstElement || !lastElement) {
      event.preventDefault()
      dialog?.focus()
      return
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
      return
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/75 p-4"
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !isPending) {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <section
        aria-busy={isPending || undefined}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="grid w-full max-w-3xl gap-4 rounded-[var(--cp-panel-radius)] border border-border bg-card p-[var(--cp-panel-padding)] text-card-foreground shadow-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="grid gap-1">
          <h2
            className="m-0 text-[length:var(--cp-title-font-size)] font-bold leading-tight"
            id={titleId}
          >
            {title}
          </h2>
          <p
            className="m-0 text-[length:var(--cp-copy-font-size)] text-muted-foreground"
            id={descriptionId}
          >
            {status.configured
              ? 'Update the token, connect another Gist, or pause automatic syncing.'
              : 'Add a GitHub token, then create or connect a private Gist.'}
          </p>
        </div>

        {feedback ? (
          <InlineStatus
            role={feedback.tone === 'danger' ? 'alert' : 'status'}
            tone={feedback.tone}
          >
            {feedback.message}
          </InlineStatus>
        ) : null}

        <fieldset
          aria-label="GitHub token"
          className="grid min-w-0 gap-2 border-0 p-0"
        >
          <legend className="text-[length:var(--cp-copy-font-size)] font-semibold">
            GitHub token
          </legend>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <input
              aria-label="GitHub token"
              autoComplete="off"
              className="min-w-[16rem] flex-1 rounded-[var(--cp-control-radius)] border border-border bg-background px-3 py-2 text-[length:var(--cp-copy-font-size)]"
              onChange={(event) => setToken(event.currentTarget.value)}
              placeholder="ghp_..."
              readOnly={!isReplacingToken}
              spellCheck={false}
              type={isReplacingToken ? 'password' : 'text'}
              value={isReplacingToken ? token : maskedTokenValue}
            />
            {isReplacingToken ? (
              <Button
                disabled={isPending || !trimmedToken}
                onClick={() => {
                  void runConnectionAction(
                    () => actions.onSaveToken(trimmedToken),
                    'GitHub token saved.',
                    {
                      afterSuccess: () => {
                        setToken('')
                        setTokenSavedInSession(true)
                        setIsReplacingToken(false)
                      },
                    },
                  )
                }}
                size="sm"
              >
                {isPending ? (
                  <Loader2
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <KeyRound aria-hidden="true" />
                )}
                Save token
              </Button>
            ) : (
              <Button
                disabled={isPending}
                onClick={() => setIsReplacingToken(true)}
                size="sm"
                variant="outline"
              >
                <KeyRound aria-hidden="true" />
                Replace token
              </Button>
            )}
            <Button
              disabled={isPending || (isReplacingToken && !trimmedToken)}
              onClick={() => {
                void runConnectionAction(
                  () =>
                    isReplacingToken
                      ? actions.onValidateToken(trimmedToken)
                      : actions.onValidateStoredToken(),
                  'GitHub token validated.',
                )
              }}
              size="sm"
              variant="outline"
            >
              Test token
            </Button>
          </div>
          {hasUsableToken && !isReplacingToken ? (
            <p className="m-0 text-[length:var(--cp-badge-font-size)] text-primary">
              Verified with GitHub. Stored only in trusted extension storage.
            </p>
          ) : (
            <p className="m-0 text-[length:var(--cp-badge-font-size)] text-muted-foreground">
              Stored locally in trusted extension storage. It is not included in
              backups or exports.
            </p>
          )}
        </fieldset>

        <fieldset
          aria-label="Private Gist"
          className="grid min-w-0 gap-2 border-0 p-0"
        >
          <legend className="text-[length:var(--cp-copy-font-size)] font-semibold">
            Private Gist
          </legend>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <input
              aria-label="Private Gist"
              className="min-w-[16rem] flex-1 rounded-[var(--cp-control-radius)] border border-border bg-background px-3 py-2 text-[length:var(--cp-copy-font-size)]"
              onChange={(event) => setGistId(event.currentTarget.value)}
              placeholder="Existing Gist ID"
              spellCheck={false}
              value={gistId}
            />
            <Button
              disabled={isPending || !trimmedGistId || !hasUsableToken}
              onClick={() => {
                void runConnectionAction(
                  () => actions.onConnectGist(trimmedGistId),
                  'GitHub Gist connected.',
                )
              }}
              size="sm"
              variant="outline"
            >
              <GitBranch aria-hidden="true" />
              Connect Gist
            </Button>
            <Button
              disabled={isPending || !hasUsableToken}
              onClick={() => {
                void runConnectionAction(
                  () => actions.onCreateGist(),
                  'Private GitHub Gist created.',
                )
              }}
              size="sm"
              variant="outline"
            >
              <UploadCloud aria-hidden="true" />
              Create private Gist
            </Button>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {status.configured ? (
              <Button
                disabled={isPending}
                onClick={() => {
                  void runConnectionAction(
                    () => actions.onSetAutoSyncEnabled(!status.enabled),
                    status.enabled ? 'Auto-sync paused.' : 'Auto-sync resumed.',
                  )
                }}
                size="sm"
                variant="ghost"
              >
                {status.enabled ? 'Pause auto-sync' : 'Resume auto-sync'}
              </Button>
            ) : null}
            {status.tokenConfigured ? (
              <Button
                disabled={isPending}
                onClick={() => {
                  void runConnectionAction(
                    () => actions.onDeleteToken(),
                    'GitHub token deleted.',
                    {
                      afterSuccess: () => {
                        setTokenSavedInSession(false)
                        setIsReplacingToken(true)
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
            ) : null}
          </div>
          <Button
            disabled={isPending}
            onClick={onClose}
            ref={closeButtonRef}
            size="sm"
            variant="ghost"
          >
            Close
          </Button>
        </div>
      </section>
    </div>
  )
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableElements(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((candidate) => !candidate.hasAttribute('disabled'))
    .filter((candidate) => candidate.getAttribute('aria-hidden') !== 'true')
    .filter((candidate) => candidate.tabIndex >= 0)
}
```

- [ ] **Step 4: Run dialog tests and verify pass**

Run:

```bash
npm test -- src/features/sync/components/github-sync-connection-dialog.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sync/components/github-sync-connection-dialog.tsx src/features/sync/components/github-sync-connection-dialog.test.tsx
git commit -m "feat(sync): add GitHub sync connection dialog"
```

## Task 5: Replace the Settings Card Structure

**Files:**

- Modify: `src/features/sync/components/github-sync-panel.test.tsx`
- Modify: `src/features/sync/components/github-sync-panel.tsx`

- [ ] **Step 1: Replace outdated panel tests with failing UX tests**

In `src/features/sync/components/github-sync-panel.test.tsx`, replace the old `saves a token and creates a Gist from the not configured state` test with:

```tsx
it('renders a not-connected summary with one setup CTA and no setup fields', async () => {
  const user = userEvent.setup()
  render(
    <GitHubSyncPanel actions={createActions()} status={notConfiguredStatus} />,
  )

  expect(screen.getByRole('heading', { name: /GitHub Sync/i })).toBeVisible()
  expect(screen.getByText('Not connected')).toBeVisible()
  expect(
    screen.getByText('Connect a GitHub token and private Gist'),
  ).toBeVisible()
  expect(screen.queryByLabelText('GitHub token')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Private Gist')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /Pull latest/i }),
  ).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Connect GitHub Sync' }))

  expect(
    await screen.findByRole('dialog', { name: 'Connect GitHub Sync' }),
  ).toBeVisible()
})
```

Add these panel tests:

```tsx
it('renders a connected summary with auto-sync state and manual actions', async () => {
  const user = userEvent.setup()
  render(
    <GitHubSyncPanel actions={createActions()} status={configuredStatus} />,
  )

  expect(screen.getByText('Connected')).toBeVisible()
  expect(screen.getByText('Auto-sync on')).toBeVisible()
  expect(screen.getByText('Connected to private Gist')).toBeVisible()
  expect(screen.getByText(/Token saved and verified/i)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Pull latest' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Push local' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Pause auto-sync' })).toBeEnabled()

  await user.click(screen.getByRole('button', { name: 'Manage connection' }))

  expect(
    await screen.findByRole('dialog', { name: 'Manage GitHub Sync' }),
  ).toBeVisible()
})

it('renders a paused connected summary while keeping manual actions enabled', async () => {
  const user = userEvent.setup()
  const actions = createActions()
  actions.onSetAutoSyncEnabled.mockResolvedValue({
    ...syncActionResult,
    action: 'set-enabled',
    message: 'Auto-sync resumed.',
  })

  render(
    <GitHubSyncPanel
      actions={actions}
      status={{
        ...configuredStatus,
        enabled: false,
      }}
    />,
  )

  expect(screen.getByText('Connected')).toBeVisible()
  expect(screen.getByText('Auto-sync paused')).toBeVisible()
  expect(
    screen.getByText(
      /Automatic sync is paused. Manual pull and push still work/i,
    ),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Pull latest' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Push local' })).toBeEnabled()

  await user.click(screen.getByRole('button', { name: 'Resume auto-sync' }))

  expect(actions.onSetAutoSyncEnabled).toHaveBeenCalledWith(true)
})
```

Add this helper near the test fixtures and replace every inline `actions={{ ... }}` object in this test file with `actions={createActions()}` unless the test needs to override a specific action mock:

```ts
function createActions() {
  return {
    onConnectGist: vi.fn(),
    onCreateGist: vi.fn(),
    onDeleteToken: vi.fn(),
    onPullLatest: vi.fn(),
    onPushLocal: vi.fn(),
    onSaveToken: vi.fn(),
    onSetAutoSyncEnabled: vi.fn(),
    onValidateStoredToken: vi.fn(),
    onValidateToken: vi.fn(),
  }
}
```

Update existing test action objects by adding `onSetAutoSyncEnabled: vi.fn()`.

- [ ] **Step 2: Run panel tests and verify failure**

Run:

```bash
npm test -- src/features/sync/components/github-sync-panel.test.tsx
```

Expected: FAIL because the current panel still renders setup fields directly and lacks auto-sync actions.

- [ ] **Step 3: Implement the new panel summary**

In `src/features/sync/components/github-sync-panel.tsx`:

- Import the new dialog:

```ts
import { GitHubSyncConnectionDialog } from './github-sync-connection-dialog'
```

- Add state:

```ts
const [connectionDialogOpen, setConnectionDialogOpen] = useState(false)
```

- Replace the token and Gist input blocks with summary rendering:

```tsx
{
  status.configured ? (
    <ConnectedSyncSummary
      isPending={isPending}
      onManageConnection={() => setConnectionDialogOpen(true)}
      onSetAutoSyncEnabled={(enabled) => {
        void runPanelAction(
          () => actions.onSetAutoSyncEnabled(enabled),
          enabled ? 'Auto-sync resumed.' : 'Auto-sync paused.',
        )
      }}
      status={status}
    />
  ) : (
    <NotConnectedSyncSummary onConnect={() => setConnectionDialogOpen(true)} />
  )
}
```

- Render manual actions only when connected:

```tsx
{
  status.configured ? (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        disabled={isPending || status.isSyncing}
        onClick={() => {
          void runPullLatestAction(false)
        }}
        size="sm"
        variant="outline"
      >
        <CloudDownload aria-hidden="true" />
        Pull latest
      </Button>
      <Button
        disabled={isPending || status.isSyncing}
        onClick={() => {
          void runPushLocalAction(false)
        }}
        size="sm"
        variant="outline"
      >
        <CloudUpload aria-hidden="true" />
        Push local
      </Button>
    </div>
  ) : null
}
```

- Render the connection dialog:

```tsx
{
  connectionDialogOpen ? (
    <GitHubSyncConnectionDialog
      actions={actions}
      isPending={isPending}
      onActionResult={(result) => {
        if (
          isSuccessfulAction(result) &&
          (result?.action === 'connect-gist' ||
            result?.action === 'create-gist' ||
            result?.action === 'delete-token' ||
            result?.action === 'set-enabled')
        ) {
          setConnectionDialogOpen(false)
        }
      }}
      onClose={() => setConnectionDialogOpen(false)}
      status={status}
    />
  ) : null
}
```

- Add summary helpers:

```tsx
function NotConnectedSyncSummary({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-[var(--cp-control-radius)] border border-border bg-background p-3">
      <div className="grid gap-1">
        <h3 className="m-0 text-[length:var(--cp-copy-font-size)] font-bold">
          Connect a GitHub token and private Gist
        </h3>
        <p className="m-0 text-[length:var(--cp-badge-font-size)] text-muted-foreground">
          Your token stays in trusted extension storage and is never exported.
        </p>
      </div>
      <Button onClick={onConnect} size="sm">
        <KeyRound aria-hidden="true" />
        Connect GitHub Sync
      </Button>
    </div>
  )
}

function ConnectedSyncSummary({
  isPending,
  onManageConnection,
  onSetAutoSyncEnabled,
  status,
}: {
  isPending: boolean
  onManageConnection: () => void
  onSetAutoSyncEnabled: (enabled: boolean) => void
  status: SerializedSyncStatus
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-[var(--cp-control-radius)] border border-primary/40 bg-primary/10 p-3">
      <div className="grid gap-1">
        <h3 className="m-0 text-[length:var(--cp-copy-font-size)] font-bold text-primary">
          Connected to private Gist
        </h3>
        <p className="m-0 text-[length:var(--cp-badge-font-size)] text-muted-foreground">
          {readConnectedSummaryDetail(status)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={isPending}
          onClick={onManageConnection}
          size="sm"
          variant="outline"
        >
          Manage connection
        </Button>
        <Button
          disabled={isPending}
          onClick={() => onSetAutoSyncEnabled(!status.enabled)}
          size="sm"
          variant="ghost"
        >
          {status.enabled ? 'Pause auto-sync' : 'Resume auto-sync'}
        </Button>
      </div>
    </div>
  )
}

function readConnectedSummaryDetail(status: SerializedSyncStatus) {
  const latest = readLastSyncStatus(status)

  if (!status.enabled) {
    return latest
      ? `Automatic sync is paused. Manual pull and push still work. ${latest}.`
      : 'Automatic sync is paused. Manual pull and push still work.'
  }

  return latest
    ? `Token saved and verified. ${latest}`
    : 'Token saved and verified.'
}
```

- Change the header badges:

```tsx
;<Badge tone={status.configured ? 'success' : 'neutral'} variant="outline">
  {status.configured ? 'Connected' : 'Not connected'}
</Badge>
{
  status.configured ? (
    <Badge tone={status.enabled ? 'success' : 'warning'} variant="outline">
      {status.enabled ? 'Auto-sync on' : 'Auto-sync paused'}
    </Badge>
  ) : null
}
```

- Keep `SyncStatusBlock` below the summary for conflict/error/dirty/push-needed status, but remove the old token and Gist setup text from normal connected/not-connected rendering.

- [ ] **Step 4: Run panel tests and verify pass**

Run:

```bash
npm test -- src/features/sync/components/github-sync-panel.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sync/components/github-sync-panel.tsx src/features/sync/components/github-sync-panel.test.tsx
git commit -m "feat(sync): simplify GitHub sync settings card"
```

## Task 6: Preserve Header Shortcuts and Paused Manual Actions

**Files:**

- Modify: `src/features/sync/components/dashboard-sync-actions.test.tsx`
- Modify: `src/features/sync/components/dashboard-sync-actions.tsx`

- [ ] **Step 1: Add a paused header shortcut test**

In `src/features/sync/components/dashboard-sync-actions.test.tsx`, add:

```tsx
it('keeps header pull and push actions available when auto-sync is paused', async () => {
  const user = userEvent.setup()
  const onPullLatest = vi.fn()
  const onPushLocal = vi.fn()

  render(
    <DashboardSyncActionsView
      isPending={false}
      onPullLatest={onPullLatest}
      onPushLocal={onPushLocal}
      status={{
        ...configuredStatus,
        enabled: false,
      }}
    />,
  )

  await user.click(
    screen.getByRole('button', { name: 'Pull latest from Gist' }),
  )
  await user.click(screen.getByRole('button', { name: 'Push local to Gist' }))

  expect(onPullLatest).toHaveBeenCalledWith({
    confirmLocalOverwrite: false,
  })
  expect(onPushLocal).toHaveBeenCalledWith({
    confirmRemoteOverwrite: false,
  })
})
```

- [ ] **Step 2: Run the header tests**

Run:

```bash
npm test -- src/features/sync/components/dashboard-sync-actions.test.tsx
```

Expected: PASS if the header already keys off `status.configured`; FAIL if implementation drift blocks actions when `enabled` is false.

- [ ] **Step 3: Confirm header implementation remains configured-based**

The action visibility and disabled logic should remain:

```ts
if (!status?.configured) {
  return null
}

const disabled = isPending || status.isSyncing
```

- [ ] **Step 4: Run the header tests again**

Run:

```bash
npm test -- src/features/sync/components/dashboard-sync-actions.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sync/components/dashboard-sync-actions.tsx src/features/sync/components/dashboard-sync-actions.test.tsx
git commit -m "test(sync): cover paused header sync actions"
```

If `dashboard-sync-actions.tsx` did not change, omit it from `git add`.

## Task 7: Update Product and Testing Docs

**Files:**

- Modify: `docs/product.md`
- Modify: `docs/testing.md`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Update product sync wording**

In `docs/product.md`, update the Sync feature section to include this paragraph after the manual action paragraph:

```md
The Settings card separates connection from automation. Connected means a GitHub
token and private Gist are configured. Auto-sync on or paused controls only
background automatic push and clean open-check pull. Manual Pull latest and Push
local remain available while connected, including when auto-sync is paused.
```

- [ ] **Step 2: Update architecture state-flow wording**

In `docs/architecture.md`, update the automatic sync paragraph under State And Data Flow so it includes:

```md
The sync metadata `enabled` flag represents auto-sync on or paused. It gates
automatic open-check pulls and alarm-backed pushes. Manual pull and push depend
on a connected token and Gist, not on the auto-sync flag.
```

- [ ] **Step 3: Update manual testing flow**

In `docs/testing.md`, update the GitHub Gist Sync smoke flow by adding steps after the header shortcut step:

```md
10. Open Manage connection and confirm the saved token appears as a masked,
    verified value rather than an empty editable field.
11. Pause auto-sync and confirm the card says Auto-sync paused while Pull latest
    and Push local remain available.
12. Resume auto-sync and confirm the card returns to Auto-sync on.
```

Renumber the remaining steps in that smoke flow.

- [ ] **Step 4: Format docs**

Run:

```bash
npx prettier --write docs/product.md docs/testing.md docs/architecture.md
```

Expected: Prettier completes without errors.

- [ ] **Step 5: Commit**

```bash
git add docs/product.md docs/testing.md docs/architecture.md
git commit -m "docs(sync): document connection and auto-sync states"
```

## Task 8: Focused Verification and Full Check

**Files:**

- No source edits expected unless verification exposes failures.

- [ ] **Step 1: Run the focused sync suite**

Run:

```bash
npm test -- \
  src/features/sync/server/sync-service.test.ts \
  src/features/sync/api/sync-api.test.tsx \
  src/features/sync/hooks/use-github-sync-controller.test.tsx \
  src/features/sync/components/github-sync-connection-dialog.test.tsx \
  src/features/sync/components/github-sync-panel.test.tsx \
  src/features/sync/components/dashboard-sync-actions.test.tsx \
  src/extension/background/runtime-policy.test.ts \
  src/extension/background/register-handlers.test.ts
```

Expected: all focused sync tests pass.

- [ ] **Step 2: Run the route smoke tests that include dashboard header actions**

Run:

```bash
npm test -- src/app/dashboard/routes.test.tsx
```

Expected: PASS. If labels changed in a way that intentionally affects this test, update the assertions to the final accessible names and rerun.

- [ ] **Step 3: Run the full project check**

Run:

```bash
npm run check
```

Expected: Drizzle check, WXT type generation, TypeScript, ESLint, and Vitest all pass.

- [ ] **Step 4: Run formatting check**

Run:

```bash
npm run format
```

Expected: PASS.

- [ ] **Step 5: Commit verification repairs after a failed command**

If a verification command failed and a code or docs repair was required, commit the repair:

```bash
git add <changed-files>
git commit -m "fix(sync): address GitHub sync UX verification"
```

When all verification commands pass without source changes, skip this commit step.

## Task 9: Rendered UI QA

**Files:**

- No committed files for screenshots or temporary scripts.

- [ ] **Step 1: Start the extension dev server**

Run:

```bash
npm run dev
```

Expected: WXT dev server starts and generates `.output/chrome-mv3`. Keep the session running until Browser QA is complete.

- [ ] **Step 2: Use Browser plugin for rendered verification**

Use the Browser plugin path from `build-web-apps:frontend-testing-debugging`:

```ts
await agent.browser.nameSession('CogniPace GitHub Sync Settings UX')
const tab = await agent.browser.tabs.selected()
await tab.goto('<dashboard-settings-url>')
```

The flow under test is:

```text
dashboard Settings -> GitHub Sync card -> connect/manage dialog -> pause/resume and manual action availability
```

- [ ] **Step 3: Verify not-connected state**

In a clean or reset test profile, confirm:

- Page identity is the CogniPace dashboard Settings route.
- The page is not blank.
- No framework overlay is visible.
- Console has no relevant app errors or warnings.
- GitHub Sync shows `Not connected`.
- The card shows `Connect GitHub Sync`.
- Token and Gist inputs are not visible until the dialog opens.

- [ ] **Step 4: Verify connected state**

In a connected test profile, confirm:

- GitHub Sync shows `Connected` and `Auto-sync on`.
- Summary says `Connected to private Gist`.
- Summary says `Token saved and verified`.
- `Manage connection`, `Pull latest`, `Push local`, and `Pause auto-sync` are visible.
- Opening `Manage connection` shows masked token and same-row token/Gist controls.

- [ ] **Step 5: Verify paused state**

Pause auto-sync and confirm:

- Badge changes to `Auto-sync paused`.
- Summary says manual pull and push still work.
- `Pull latest` and `Push local` remain enabled when no sync action is pending.
- Dashboard header cloud pull/push buttons remain visible.

- [ ] **Step 6: Verify mobile/narrow layout**

Set a mobile-sized viewport and confirm:

- Token row input stays first and buttons wrap below without overlap.
- Gist row input stays first and buttons wrap below without overlap.
- Dialog buttons remain readable and reachable.
- Card buttons do not overflow their container.

- [ ] **Step 7: Record QA evidence in final response**

Do not commit screenshots. In the final response, include:

- Browser/IAB path used.
- Desktop and mobile viewports checked.
- Console health.
- Interaction path tested.
- Screenshot evidence displayed through Browser if available.
- Remaining risks or untested profile states.

## Final Verification Checklist

- [ ] Focused sync tests pass.
- [ ] Dashboard route tests pass.
- [ ] `npm run check` passes.
- [ ] `npm run format` passes.
- [ ] Browser QA confirms not-connected, connected, dialog, paused, and narrow layout states.
- [ ] No token value appears in DOM, screenshots, logs, backups, or sync payloads.
- [ ] Manual pull/push work while auto-sync is paused.
- [ ] Automatic sync remains gated by `enabled`.
- [ ] Force pull/push dialogs still appear only after explicit manual actions.
