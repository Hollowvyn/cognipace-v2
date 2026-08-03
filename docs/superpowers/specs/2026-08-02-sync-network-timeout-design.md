# Sync Network Timeout and Fine-Grained Locking Design

Date: 2026-08-02
Status: Approved approach, awaiting written spec review before implementation

## Context

Users are encountering an intermittent issue where a LeetCode problem gets stuck on "CogniPace is still syncing this problem" and eventually throws the Chrome error: "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received". 

This occurs because:
1. `createHttpClient` uses the global `fetch` without any timeout.
2. The `sync.requestOpenCheck` triggers a GitHub fetch when a problem page is opened.
3. This sync check is entirely wrapped in `runQueuedSyncAction`, which locks the `dbMutationQueue` for the duration of the network request.
4. If the network drops or the fetch hangs, the `dbMutationQueue` is permanently locked.
5. The `problems.upsertFromPage` runtime message (used to save the problem) is queued behind this lock. After 5 minutes, Chrome times out the message channel, throwing the error.

## Goals

- Prevent any network request from indefinitely hanging the background service worker.
- Prevent network I/O from blocking local database mutations.
- Ensure that if local data changes while a background sync is fetching data, the incoming remote data does not overwrite the new local changes.

## Chosen Approach

We will implement a dual-layer fix combining a global HTTP timeout with fine-grained database locking for the sync service.

### 1. Global HTTP Timeout

We will modify the core HTTP client to strictly enforce a timeout on all network requests.

- In `src/platform/http/http-client.ts`, add a default 15-second timeout using `AbortSignal.timeout(15000)`.
- If a consumer provides their own `AbortSignal`, combine them using `AbortSignal.any([userSignal, timeoutSignal])`.
- Ensure that timeout rejections (`TimeoutError` or `AbortError`) are caught and wrapped in `HttpRequestError`, so upstream handlers classify them correctly as retryable network errors.

### 2. Fine-Grained Sync Locking

We will decouple the GitHub network fetch from the `dbMutationQueue`.

- In `src/extension/background/register-handlers.ts`, modify `runCleanPullCheck` and similar background-initiated checks to invoke the sync service directly without wrapping the entire operation in `runQueuedSyncAction`.
- The `syncService` instance used for these operations must still be passed a `runRemoteRestore` implementation that locks the `dbMutationQueue`.
- In `src/features/sync/server/sync-service.ts`, inside the `pullRemote` function (which is responsible for applying the fetched remote data), we will re-read `syncMetadata` **inside** the `runRemoteRestore` lock.
- If `metadata.dirtySinceLastSync` is true (indicating a local mutation occurred while the network fetch was in flight), `pullRemote` must safely abort the restore operation and log/throw an error to prevent overwriting local data.

## Acceptance Criteria

- Background HTTP requests time out after 15 seconds instead of hanging indefinitely.
- The `sync.requestOpenCheck` background job no longer blocks `dbMutationQueue` during its network fetch.
- If a local database mutation occurs while a background pull is fetching from GitHub, the pull is safely aborted and does not overwrite the local changes.
- Automated tests or manual verification confirms that slowing down the network does not block problem saving.
