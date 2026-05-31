# Non-Blocking Gist Open Check Design

Date: 2026-05-31
Status: Approved approach, awaiting written spec review before implementation
planning

## Context

The automatic Gist sync branch added a `SyncOpenCheck` provider that runs on
popup, dashboard, and LeetCode overlay mount. The provider uses a delayed
`useEffect` to call `sync.checkRemoteOnOpen`. That effect does not directly
block React's first paint, but the runtime message currently asks the
background service worker to immediately do database and sync work:

```text
surface mounts
-> SyncOpenCheck effect
-> sync.checkRemoteOnOpen runtime message
-> getAppDb()
-> queued sync service work
-> possibly GitHub Gist network I/O
```

On a cold extension reload, that work can compete with the real startup queries
such as `app.getShellData` and `settings.getSettings`. The result is an
intermittent slow first open even though the UI is not explicitly awaiting the
sync check.

React's `useEffect` is appropriate for non-visual side effects and generally
does not block paint. The problem to solve is therefore not React rendering; it
is that a startup UI effect currently triggers expensive background I/O too
early.

## Goals

- Surface startup must never wait on GitHub, sync restore, or sync metadata
  repair work.
- Opening popup, dashboard, or overlay should remain lightweight even after a
  cold extension reload.
- Preserve pseudo-real-time behavior: opening a clean surface should still
  request a best-effort remote catch-up.
- Preserve automatic sync safety rules: no automatic force pull, no automatic
  force push, and no destructive overwrite without manual confirmation.
- Keep background ownership of sync orchestration, token access, database
  access, and alarm scheduling.
- Keep app/provider code inside Bulletproof React boundaries by depending on
  public feature surfaces, not deep feature internals.
- Keep runtime contracts type-safe and validated with Zod.

## Non-Goals

- Removing automatic open checks entirely.
- Changing manual Pull latest or Push local behavior.
- Adding visible sync loading UI during app startup.
- Adding notifications or new Chrome permissions.
- Adding a hosted backend, websockets, or true real-time sync.
- Reworking the app-shell startup queries in this pass.

## Chosen Approach

Use **fire-and-forget background scheduling** for surface-open sync checks.

The UI should no longer call a runtime method that performs the clean pull in
the request/response path. Instead, it sends a cheap signal that a surface has
opened. The background handler validates and authorizes that signal, asks the
auto-sync orchestrator to schedule or enqueue a clean open check, and returns
immediately.

The expensive work remains in the background:

```text
surface mounts
-> SyncOpenCheck effect
-> sync.requestOpenCheck runtime message
-> sender policy + request parse
-> schedule background open-check work
-> immediate response

later / independently:
background open-check job
-> getAppDb()
-> queued sync service work
-> clean remote check
-> optional safe pull
-> cache invalidation broadcast if data changed
```

This keeps startup responsive while preserving the product behavior that a clean
browser/profile eventually catches up after open or reload.

## Runtime Contract

Add this lightweight runtime action:

```ts
'sync.requestOpenCheck'(request: SyncRequest): null
```

The behavior must not vary:

- Parse with `syncRequestSchema`.
- Authorize `popup`, `dashboard`, and `content-script`.
- Return `null` immediately.
- Avoid `getAppDb()`.
- Avoid GitHub network calls.
- Avoid `runQueuedSyncAction`.
- Avoid parsing or returning `SyncActionResult`.

The old `sync.checkRemoteOnOpen` can remain as a background/service capability
or be kept for focused tests, but it should not be called directly from
`SyncOpenCheck` on surface startup.

## Background Scheduling

Extend the existing sync auto-sync orchestrator with
`requestOpenCheckAfterSurfaceOpen`.

The method should coalesce repeated requests and schedule the existing safe
clean-pull check outside the UI request path:

- Set a single in-memory background timer for
  `syncSurfaceOpenCheckDelayMs = 2_000`.
- Schedule a durable fallback alarm named `sync:open-check` with
  `delayInMinutes: 0.5`.
- If the in-memory timer runs first, execute the safe clean-pull check and clear
  the fallback alarm.
- If the service worker is suspended before the timer fires, the fallback alarm
  can run the same safe clean-pull check later.
- Multiple popup/dashboard/overlay open requests while a timer or fallback is
  pending should not schedule duplicate checks.

The two-second in-memory delay gives app-shell and settings startup requests
first access to the background service worker and database. The alarm fallback
preserves best-effort catch-up if the service worker does not stay alive long
enough for the timer.

The scheduled job must use the same safety policy already implemented:

- No-op if sync is disabled or not configured.
- No-op if local metadata is dirty.
- Fetch remote only after the local clean/configured checks pass.
- Pull only through the existing safe `checkRemoteOnOpen` service path.
- Never pass force flags.
- Broadcast invalidation only after a successful pull.

The background request handler should treat scheduling failures as best effort:
the UI open request still returns successfully because opening the app should
not fail due to auto-sync scheduling.

## React Provider Behavior

`SyncOpenCheck` remains a null provider mounted under `AppProviders`, but its
responsibility changes:

- It sends only the lightweight open-check request.
- It does not await remote sync results.
- It does not invalidate queries directly based on a returned pull result,
  because the request no longer returns sync work output.
- It catches and ignores request errors; background sync status remains the
  source of truth.
- It keeps the StrictMode duplicate suppression behavior so development builds
  do not send two open-check requests from the setup/cleanup probe.

The provider should continue importing through the sync feature public surface:

```ts
import { requestOpenCheckViaRuntime } from '@/features/sync'
```

That keeps the app layer aligned with the existing architecture boundary test.

## Data Freshness

The background safe pull path already broadcasts broad cache invalidation after
remote restore. That should remain the mechanism that updates open surfaces
after an automatic pull.

For no-change open checks, UI freshness is less important than startup
responsiveness. The background may update sync metadata such as last check time,
but the UI does not need to block startup or immediately refetch sync status for
that metadata-only update. Manual Settings and header actions still provide
explicit status feedback.

## Error Handling

Open-check scheduling errors are swallowed in the UI provider and treated as
best effort in the background request handler.

Actual sync errors remain recorded by the sync service when the background job
runs. Retryable errors can continue using the existing retry/backoff metadata
and status surfaces. Non-retryable errors still require manual Settings
recovery.

## TypeScript And Validation

- Runtime request payloads must use existing Zod schemas.
- Runtime protocol types must be explicit in `ProtocolMap`.
- New API helpers should preserve literal surface types where useful and avoid
  `any`.
- Indexed access and optional fields must stay compatible with
  `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- Tests should assert the request does not return `SyncActionResult`, so the UI
  cannot accidentally depend on remote work completing during startup.

## Testing

Add focused tests at these seams:

- `sync-api` sends `sync.requestOpenCheck` with the claimed surface and expects
  a lightweight acknowledgement.
- `runtime-policy` allows the method from popup, dashboard, and content-script.
- `register-handlers` parses and authorizes the method, calls the auto-sync
  scheduler, returns immediately, and does not call `getAppDb()` or
  `service.checkRemoteOnOpen()` in that handler.
- `register-handlers` keeps the response successful when scheduling rejects.
- `sync-auto-sync` coalesces open-check requests, sets a two-second in-memory
  timer, schedules a `sync:open-check` fallback alarm, clears the fallback after
  an in-memory run, and delegates actual clean pull work to the existing safe
  check path.
- `SyncOpenCheck` calls the lightweight helper once under StrictMode and no
  longer invalidates query families from the returned value.
- Existing service tests continue covering the real `checkRemoteOnOpen` safety
  behavior.

Full verification should include focused sync/background/provider tests and
`npm run check`.

## Acceptance Criteria

- Opening a surface sends only a cheap runtime scheduling request.
- The surface-open request path does not call `getAppDb()`.
- The surface-open request path does not perform GitHub network I/O.
- UI startup does not render any sync loading state or wait for sync completion.
- Clean automatic pulls still happen from background work after open/reload.
- Dirty local data still blocks automatic pull.
- Changed remote data still blocks automatic push.
- Manual force pull and force push behavior is unchanged.
- Architecture boundary tests pass.
