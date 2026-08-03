# Sync Network Timeout and Fine-Grained Locking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent GitHub API fetches from blocking the `dbMutationQueue` and add a global 15-second timeout to all HTTP fetches.

**Architecture:** We will add an `AbortSignal.timeout` to `createHttpClient`. We will then refactor `runQueuedSyncAction` in `register-handlers.ts` to only lock the mutation queue for dirty marking, allowing the network sync service to run outside the queue. We will provide the queue lock capability down to `sync-service.ts` so it can lock specifically when creating a backup (push) or restoring a backup (pull), re-verifying `dirtySinceLastSync` during pull.

**Tech Stack:** TypeScript, Web Extensions API, Zod

## Global Constraints

- No new dependencies.
- Use standard Web APIs (`AbortSignal`).
- Follow existing codebase patterns.

---

### Task 1: Add Timeout to HTTP Client

**Files:**
- Modify: `src/platform/http/http-client.ts:33-90`

**Interfaces:**
- Modifies `createHttpClient` to add a 15-second timeout to all network requests.

- [ ] **Step 1: Write the minimal implementation**

Modify `requestJson` in `createHttpClient` to include a timeout signal. Catch `TimeoutError` explicitly and ensure the message contains "timeout" so `classifySyncError` recognizes it.

```typescript
    async requestJson<T = unknown>(request: HttpJsonRequest): Promise<T> {
      const headers = new Headers(request.headers)

      if (request.body !== undefined && !headers.has('content-type')) {
        headers.set('content-type', 'application/json')
      }

      const debug = createDebug(request)

      try {
        const init: RequestInit = {
          method: request.method,
          headers,
        }

        const body = createJsonBody(request.body)
        if (body !== undefined) {
          init.body = body
        }

        if (request.credentials !== undefined) {
          init.credentials = request.credentials
        }

        const timeoutSignal = AbortSignal.timeout(15000)
        init.signal = request.signal
          ? AbortSignal.any([request.signal, timeoutSignal])
          : timeoutSignal

        const response = await fetchImpl(request.url, init)
        // ... rest of try block remains unchanged
        const payload = await readResponsePayload(response, request)

        if (!response.ok) {
          throw new HttpRequestError(
            createHttpErrorMessage(
              response.status,
              payload,
              request.sensitiveValues,
            ),
            { ...debug, status: response.status },
            response.status,
          )
        }

        return payload as T
      } catch (error) {
        if (error instanceof HttpRequestError) {
          throw error
        }

        const isTimeout =
          error instanceof Error &&
          (error.name === 'TimeoutError' || error.name === 'AbortError')

        const errorMessage = isTimeout
          ? 'Network request timed out.'
          : error instanceof Error
            ? error.message
            : String(error)

        throw new HttpRequestError(
          redactString(errorMessage, request.sensitiveValues),
          debug,
          undefined,
          { cause: createSanitizedCause(error, request.sensitiveValues) },
        )
      }
    }
```

- [ ] **Step 2: Commit**

```bash
git add src/platform/http/http-client.ts
git commit -m "fix(http): add 15s timeout to all network requests"
```

---

### Task 2: Refactor Sync Service to Support Fine-Grained Locking

**Files:**
- Modify: `src/features/sync/server/sync-service.ts` (search for `runRemoteRestore` and replace with `runWithLocalDataLock`)

**Interfaces:**
- Replaces `runRemoteRestore` with `runWithLocalDataLock` across the file.
- `createBackgroundSyncService` takes `runWithLocalDataLock`.
- `pullRemote` uses `runWithLocalDataLock` and re-checks `dirtySinceLastSync`.
- `createLocalEnvelopeContent` uses `runWithLocalDataLock` around `deps.exportFullBackup()`.

- [ ] **Step 1: Update dependencies type**

Find `SyncServiceDependencies` and replace `runRemoteRestore` with `runWithLocalDataLock`:

```typescript
export type SyncServiceDependencies = {
  // ... other properties
  runWithLocalDataLock?: (<T>(work: () => Promise<T>) => Promise<T>) | undefined
  // ...
}
```

- [ ] **Step 2: Update internal helper**

Find `function runRemoteRestore` at the bottom of `createSyncService` and rename it:

```typescript
  function runWithLocalDataLock<T>(work: () => Promise<T>) {
    return deps.runWithLocalDataLock ? deps.runWithLocalDataLock(work) : work()
  }
```
Return it in the object returned by `createSyncService`. Actually, no, it's not exported from `createSyncService`. Just rename it internally.

- [ ] **Step 3: Update `createLocalEnvelopeContent`**

Find `createLocalEnvelopeContent` and wrap `deps.exportFullBackup()`:

```typescript
  async function createLocalEnvelopeContent() {
    const metadata = await deps.readMetadata()
    const dataUpdatedAt =
      metadata.localDataUpdatedAt ?? deps.now().toISOString()
    const backup = await runWithLocalDataLock(() => deps.exportFullBackup())

    return {
      content: JSON.stringify(
        buildSyncEnvelope({
          backup,
          dataUpdatedAt,
          exportedAt: deps.now(),
        }),
        null,
        2,
      ),
      dataUpdatedAt,
    }
  }
```

- [ ] **Step 4: Update `pullRemote`**

Find `pullRemote` and replace `runRemoteRestore` with `runWithLocalDataLock`. Also add the `dirtySinceLastSync` re-check:

```typescript
  async function pullRemote(
    gist: GitHubGistSummary,
    options: { enabled?: boolean } = {},
  ) {
    const envelope = parseRemoteSyncEnvelope(gist)
    await runWithLocalDataLock(async () => {
      const currentMetadata = await deps.readMetadata()
      if (currentMetadata.dirtySinceLastSync) {
        throw new Error('Local data changed during sync. Aborting pull to prevent overwrite.')
      }

      await deps.restoreBackup(envelope.backup)
      await deps.flushDbSnapshot()
      await Promise.resolve(deps.broadcastInvalidation())
      await deps.writeMetadata({
        enabled: options.enabled ?? true,
        gistId: gist.id,
        lastSyncAt: deps.now().toISOString(),
        lastSyncDirection: 'pull',
        lastPullAt: deps.now().toISOString(),
        lastRemoteVersion: gist.remoteVersion,
        lastRemoteUpdatedAt: gist.updatedAt,
        localDataUpdatedAt: envelope.dataUpdatedAt,
        dirtySinceLastSync: false,
        lastBlockingReason: null,
        conflict: null,
        lastError: null,
      })
    })
  }
```

- [ ] **Step 5: Update `createBackgroundSyncService` factory**

Find `createBackgroundSyncService` and rename `runRemoteRestore` to `runWithLocalDataLock` in its options and implementation:

```typescript
export function createBackgroundSyncService(
  db: Db,
  broadcastInvalidation: () => MaybePromise<void>,
  options: {
    runWithLocalDataLock?: SyncServiceDependencies['runWithLocalDataLock']
    syncCoordinator?: SyncOperationCoordinator
  } = {},
) {
  return createSyncService({
    readToken: () => readSecret('github:gist'),
    saveToken: (token) => saveSecret('github:gist', token),
    deleteToken: () => deleteSecret('github:gist'),
    getTokenStatus: () => getSecretStatus('github:gist'),
    createGitHubClient: (token) => createGitHubGistClient({ token }),
    readMetadata: readSyncMetadata,
    writeMetadata: writeSyncMetadata,
    exportFullBackup: () => exportFullBackup(db),
    restoreBackup: (backup) => restoreValidatedBackupData(db, backup),
    flushDbSnapshot,
    broadcastInvalidation,
    syncCoordinator: options.syncCoordinator ?? sharedSyncOperationCoordinator,
    ...(options.runWithLocalDataLock
      ? { runWithLocalDataLock: options.runWithLocalDataLock }
      : {}),
    now: () => new Date(),
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add src/features/sync/server/sync-service.ts
git commit -m "refactor(sync): support fine-grained database locking during sync"
```

---

### Task 3: Unblock dbMutationQueue in Background Handlers

**Files:**
- Modify: `src/extension/background/register-handlers.ts`

**Interfaces:**
- Modifies `runQueuedSyncAction` to execute the sync action outside `runInMutationQueue`.
- Updates `createSyncServiceForDbInQueue` to pass `runWithLocalDataLock`.

- [ ] **Step 1: Write the minimal implementation**

Find `createSyncServiceForDbInQueue` and rename the option property from `runRemoteRestore` to `runWithLocalDataLock`. Also change `isAlreadyInQueue` to always be `false` effectively, or just change the logic:

```typescript
function createSyncServiceForDbInQueue(db: Db, isAlreadyInQueue: boolean) {
  return createBackgroundSyncService(
    db,
    () => broadcastSyncInvalidation('all'),
    {
      runWithLocalDataLock: isAlreadyInQueue
        ? undefined
        : (work) => runInMutationQueue(work),
    },
  )
}
```

Find `runQueuedSyncAction` and change it so the actual sync action runs OUTSIDE `runInMutationQueue`:

```typescript
async function runQueuedSyncAction<T>(
  db: Db,
  action: (service: ReturnType<typeof createBackgroundSyncService>) => Promise<T>,
) {
  await runInMutationQueue(async () => {
    const dirtyMarkReady = await retryPendingDirtyMark()

    if (!dirtyMarkReady) {
      throw new Error(
        'Local data changed but sync metadata could not be saved.',
      )
    }
  })

  // Pass false so the sync service knows it is OUTSIDE the queue and must lock when needed
  return action(createSyncServiceForDbInQueue(db, false))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/extension/background/register-handlers.ts
git commit -m "fix(sync): run network sync actions outside of dbMutationQueue"
```
