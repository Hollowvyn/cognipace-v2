# Non-Blocking LeetCode Open Sync Design

Date: 2026-06-07
Status: Approved design, awaiting implementation plan

## Context

CogniPace currently mounts `SyncOpenCheck` inside `AppProviders` for popup,
dashboard, and the LeetCode content-script overlay. On mount, that provider
calls `sync.checkRemoteOnOpen`. The background handler for that method opens the
database and runs the sync service through the same serialized mutation queue
used by LeetCode page upserts, review writes, backup restore, and manual sync.

That path is safe for data integrity, but it is too expensive for surface
startup. When GitHub Gist sync is configured and GitHub or extension database
startup is slow, opening a LeetCode problem can enqueue sync work that competes
with the overlay's real startup path:

```text
LeetCode content script mounts
-> SyncOpenCheck effect
-> sync.checkRemoteOnOpen
-> getAppDb()
-> runQueuedSyncAction()
-> possible GitHub Gist request and restore
```

The overlay itself should only need local page capture, local problem upsert,
and local app-shell reads to become usable. Gist freshness is useful, but it
must not be part of the immediate LeetCode page-open path.

## Goals

- Make LeetCode problem pages responsive even when GitHub Gist sync is
  configured.
- Keep surface-open sync as best-effort background behavior.
- Preserve automatic sync safety rules: no force pull, no force push, and no
  destructive overwrite without explicit confirmation.
- Keep GitHub token access, database access, and sync orchestration in the
  background service worker.
- Protect popup and dashboard startup from the same heavy open-check request
  path.
- Keep runtime payloads validated with Zod and sender authorization.

## Non-Goals

- Removing GitHub Gist sync.
- Removing automatic clean pull checks entirely.
- Changing manual Pull latest or Push local behavior.
- Changing queue composition or local review scheduling.
- Adding visible sync loading UI to LeetCode, popup, or dashboard startup.
- Expanding Chrome permissions or adding a backend service.

## Chosen Approach

Replace startup's heavy open-check call with a lightweight scheduling request.

The UI surfaces should call a new runtime method named `sync.requestOpenCheck`.
That method validates the sender, asks the background auto-sync orchestrator to
schedule a clean pull check, and returns immediately. The existing heavy
clean-pull behavior remains in the background job path.

```text
surface mounts
-> SyncOpenCheck effect
-> sync.requestOpenCheck
-> parse and authorize sender
-> coalesce/schedule background clean check
-> immediate null response

later, outside the UI request path:
background open-check job
-> getAppDb()
-> runQueuedSyncAction()
-> sync.checkRemoteOnOpen service path
-> optional safe pull
-> cache invalidation broadcast after pull
```

This keeps LeetCode startup local-first while preserving the product behavior
that clean profiles can catch up from Gist after opening a surface.

## Runtime Contract

Add a lightweight runtime method:

```ts
'sync.requestOpenCheck'(request: SyncRequest): null
```

The handler must:

- parse `syncRequestSchema`
- authorize popup, dashboard, and content-script senders
- schedule or enqueue the background open-check job
- return `null` immediately
- treat scheduling failures as best-effort

The handler must not:

- call `getAppDb()`
- call GitHub
- call `runQueuedSyncAction()`
- return `SyncActionResult`
- invalidate TanStack Query directly

The existing `sync.checkRemoteOnOpen` runtime method may remain for direct
background/service tests and any non-startup caller, but `SyncOpenCheck` must no
longer call it.

## Background Scheduling

Extend `createSyncAutoSync` with a method named
`requestOpenCheckAfterSurfaceOpen`.

The method should coalesce duplicate surface-open requests and run the existing
safe clean-pull behavior later:

- Use one in-memory timer for quick best-effort execution after a 2,000 ms
  delay.
- Use a durable fallback alarm named `sync:open-check` with a 0.5 minute delay
  so service-worker suspension does not drop the request.
- If the in-memory timer fires first, clear the fallback alarm.
- If the fallback alarm fires, run the same safe clean-pull job.
- Avoid scheduling duplicate jobs while one open-check request is pending.

The scheduled job must keep the current safety policy:

- no-op if sync is disabled
- no-op if Gist sync is not configured
- no-op if local metadata is dirty
- fetch remote only after local clean/configured checks pass
- pull only through the existing safe `checkRemoteOnOpen` service path
- broadcast broad cache invalidation only after a successful pull

## React Provider Behavior

`SyncOpenCheck` remains a null provider under `AppProviders`, but its role
changes from "run the remote check" to "request background scheduling".

It should:

- call the new sync feature API method, for example
  `requestOpenCheckViaRuntime(surface)`
- ignore request failures so UI startup continues
- stop invalidating queries based on a returned pull result
- keep StrictMode duplicate protection
- keep using the public `features/sync` export

Freshness after an automatic pull should come from the existing background
cache-invalidation broadcast, not from the startup provider awaiting a result.

## Testing

Focused tests should cover:

- `SyncOpenCheck` calls the new request method instead of
  `checkRemoteOnOpenViaRuntime`.
- StrictMode does not duplicate the startup request.
- The runtime handler authorizes popup, dashboard, and content-script callers.
- The runtime handler returns immediately without calling `getAppDb()` or
  `runQueuedSyncAction()`.
- `createSyncAutoSync` coalesces repeated surface-open requests.
- The scheduled open-check job uses the existing safe clean-pull path.
- Successful background pulls still broadcast the normal broad invalidation.

Manual validation should load the local extension, open a LeetCode problem with
Gist sync configured, and confirm the overlay becomes usable without waiting for
GitHub. Dashboard and popup should still reflect pulled data after the
background check completes.

## Implementation Boundaries

Expected ownership:

- `src/app/providers`: startup provider behavior
- `src/features/sync/api`: public runtime API wrapper and contracts
- `src/extension/messaging.ts`: runtime protocol shape
- `src/extension/background/runtime-policy.ts`: sender authorization
- `src/extension/background/register-handlers.ts`: lightweight handler
- `src/extension/background/sync-auto-sync.ts`: scheduling/coalescing

No account, backend, new host permission, broad queue rewrite, or LeetCode
capture rewrite is in scope.
