# Auto GitHub Gist Sync Design

Date: 2026-05-31
Status: Approved design, awaiting written spec review before implementation
planning

## Context

CogniPace already has optional GitHub Gist pseudo-sync with explicit directional
manual actions:

- Pull latest updates this browser from the connected Gist.
- Push local updates the connected Gist from this browser.
- Force pull and force push are destructive recovery actions behind
  confirmation dialogs.

The current implementation is deliberately manual-first. Local mutations mark
sync metadata dirty, but they do not auto-push. Popup, dashboard, and overlay
loads do not auto-pull. This design adds automatic best-effort sync while
preserving the current local-first safety model.

The product goal is pseudo-real-time continuity, not live collaboration. A user
should be able to change data in one browser, close or reload, then open another
browser/profile and get the latest remote data on load when it is safe to do so.
Local saves must always succeed locally even if GitHub is unavailable.

## Research Findings

Current GitHub and Chrome extension docs shape the design:

- GitHub Gist data is read with `GET /gists/{gist_id}` and written with
  `PATCH /gists/{gist_id}`.
- Gist responses expose `updated_at`, file metadata, optional file content, and
  history entries whose latest `version` can be used as the remote identity.
- GitHub documents conditional `GET` requests with ETag/`If-None-Match`, but
  says conditional requests are generally not supported for unsafe methods such
  as `PATCH` unless an endpoint explicitly documents support. The Gist update
  endpoint does not document optimistic write locking.
- Browser-only Gist sync cannot receive real-time GitHub webhooks. It must use
  explicit checks and polling.
- Chrome MV3 service workers should not rely on long-lived timers. Durable
  delayed and periodic work should use `chrome.alarms`, which requires the
  `alarms` permission and has a production minimum interval of about 30 seconds.
- Chrome alarms can be delayed and should be checked or recreated on service
  worker startup.

Reference project findings:

- LeetSRS uses a private Gist with a one-minute alarm and timestamp
  last-writer-wins sync. Its fixed-file and status patterns are useful, but its
  silent overwrite behavior is not safe enough for CogniPace.
- LeetSRS stores the GitHub PAT in Chrome sync storage. CogniPace's trusted
  `chrome.storage.local`, background-only token design remains the stronger
  baseline.
- EasyRepeat stores GenAI keys in `chrome.storage.local` and strips them from
  backups. CogniPace should keep this denylist rule for all BYOK secrets.

## Goals

- Auto-push local changes after every successful local mutation, using a
  coalesced alarm-backed debounce.
- Auto-pull remote changes when a popup, dashboard, or overlay surface opens,
  but only when local data is clean.
- Add a reusable background alarm scheduler foundation for sync jobs now and
  future reminder/notification jobs later.
- Keep hard push and hard pull manual, explicit, and highest priority.
- Never let automatic sync force-overwrite local data or remote data.
- Keep local saves independent from GitHub failures.
- Preserve trusted local token storage and background-only token access.
- Add focused TDD coverage for scheduler policy, sync auto-flow, runtime
  authorization, and UI status behavior.

## Non-Goals

- True real-time sync or collaborative editing.
- Entity-level merge sync.
- A hosted CogniPace backend, account system, or cloud service.
- A new retry dependency such as `p-retry`.
- Notification delivery in this pass.
- `chrome.notifications` permission in this pass.
- Raw Gist content fallback through `gist.githubusercontent.com` in this pass.
- Storing GitHub tokens or future GenAI keys in backups, Gist payloads, logs, or
  query cache data.

## Chosen Approach

Use **coalesced auto push plus clean auto pull**.

Automatic sync runs through the same background-owned sync service rules as
manual sync. It never passes force flags. When automatic sync detects a possible
overwrite, it stops and leaves recovery to the manual directional controls.

The precedence order is:

```txt
manual force action > manual directional action > automatic sync job
```

This keeps the app local-first and makes hard push/pull reliable without
allowing old queued background jobs to undo a user decision.

## Architecture

Add a reusable alarm scheduler under the background layer:

```txt
src/extension/background/scheduler/
  alarm-scheduler.ts
  alarm-scheduler.test.ts
```

The scheduler owns generic Chrome alarm mechanics:

- job registration
- alarm creation, clearing, and inspection
- startup repair
- alarm dispatch
- namespaced alarm names
- injected alarm adapter for tests

The scheduler must not know sync policy, backup payloads, GitHub, or
notifications.

Add sync auto-orchestration beside existing background handlers:

```txt
src/extension/background/sync-auto-sync.ts
src/extension/background/sync-auto-sync.test.ts
```

The sync auto module owns sync-specific job policy:

- schedule auto-push after local mutation flush
- run safe auto-push when the push alarm fires
- run safe clean-pull checks on surface open and periodic poll alarms
- schedule retry alarms after retryable failures
- clear pending auto jobs after successful manual pull, push, force pull, or
  force push
- stop automatic retries when a conflict or non-retryable error needs manual
  attention

Existing sync feature modules keep their current ownership:

- `src/features/sync/server/sync-service.ts` owns pull/push/force rules,
  metadata writes, conflict summaries, and safe error classification.
- `src/features/sync/data/sync-metadata-store.ts` owns persisted sync metadata.
- `src/features/sync/api` owns runtime contracts and UI hooks.
- `src/features/sync/components` owns Settings/header sync UI.
- `src/extension/background/register-handlers.ts` owns runtime registration,
  mutation queue entry, snapshot flush, and cache invalidation.

## Permissions

Add the `alarms` permission in `wxt.config.ts`.

Do not add `notifications` in this pass. Daily reminder notifications can reuse
the scheduler later, but the notification product, permission, copy, and manual
testing belong in a separate task.

Do not add `https://gist.githubusercontent.com/*` in this pass. The current
service should continue rejecting truncated Gist API file content with a clear
remote-invalid error. Raw content fallback can be added later if the sync file
size makes it necessary.

## Data Flow

### Local Mutation To Auto Push

1. A local mutation succeeds through `runDbMutation`.
2. Background marks sync metadata dirty.
3. Background flushes the DB snapshot.
4. Background broadcasts normal cache invalidation.
5. Background schedules an auto-push alarm.
6. The auto-push alarm fires after the durable debounce window.
7. Auto-sync enters the existing mutation/sync queue and calls safe push:
   `pushLocal({ confirmRemoteOverwrite: false })`.

Chrome alarms have a production minimum interval of about 30 seconds, so the v1
durable debounce should be 30 seconds. A faster in-memory debounce can be added
later as an optimization, but the alarm-backed path remains the source of truth.

### Auto Push Outcomes

- If the remote Gist is unchanged, auto-push writes the local backup envelope,
  records push metadata, clears dirty state, resets retry state, and clears
  pending auto-push/retry alarms.
- If the remote Gist changed, auto-push returns `confirmation-required` with
  reason `remote-changed`, records conflict metadata, clears pending auto
  retries, and waits for a manual decision.
- If GitHub/network/rate-limit fails in a retryable way, local data remains
  saved, `needsPush` remains true, `lastError` is recorded, and a retry alarm is
  scheduled.
- If auth, permission, missing Gist, invalid remote data, or unsupported schema
  fails in a non-retryable way, local data remains saved and automatic retries
  stop until the user fixes Settings or retries manually.

### Surface Open To Auto Pull

1. Popup, dashboard, or overlay startup sends a lightweight runtime method such
   as `sync.checkRemoteOnOpen`.
2. Background authorizes the sender surface.
3. If sync is not configured, disabled, already syncing, or local data is dirty,
   the check returns no-op.
4. If local data is clean, background checks the connected Gist.
5. If remote data is unchanged, the check returns no-op or no-change.
6. If remote data changed and validates, background calls safe pull:
   `pullLatest({ confirmLocalOverwrite: false })`.
7. Pull restores the backup, flushes the DB snapshot, broadcasts broad cache
   invalidation, records pull metadata, and updates open surfaces.

The existing remote-restore guard still applies. If local data becomes dirty
before a remote restore is applied, the restore aborts rather than overwriting
new local work.

### Periodic Polling

Add a low-frequency poll alarm for best-effort catch-up while Chrome is running.
The poll should be conservative, for example every 10 minutes. It should run the
same safe clean-pull check as surface open and should never force pull or force
push.

This poll is not a real-time loop. Chrome may delay alarms, and GitHub is a
best-effort transport.

## Retry Policy

Do not add a retry library. Retry state must survive service-worker shutdown, so
retry scheduling belongs in persisted metadata plus `chrome.alarms`.

Use a capped stepped backoff:

```txt
attempt 0: 1 minute
attempt 1: 5 minutes
attempt 2: 15 minutes
attempt 3+: 30 minutes
```

Persist the retry attempt count in sync metadata or scheduler state validated by
Zod. Reset it after successful push or pull. Do not retry in a tight loop. Stop
retrying automatically for non-retryable errors or conflicts requiring manual
choice.

## Manual Hard Push/Pull

Manual actions remain the recovery surface.

- `Pull latest` remains a safe pull. It blocks dirty local data unless the user
  confirms force pull.
- `Push local` remains a safe push. It blocks remote overwrite unless the user
  confirms force push.
- `Force pull` replaces this browser's local data with validated remote data
  after confirmation.
- `Force push` replaces the connected Gist with this browser's local data after
  confirmation.

When any manual directional action succeeds, the background should clear or
supersede pending auto-push and retry alarms so stale jobs do not immediately
run after the user's decision.

Automatic jobs never open dialogs. Dialogs remain attached to explicit user
actions in Settings and the dashboard header.

## Status And UI

Automatic sync should be quiet.

- Do not show modal dialogs or toast spam for background auto-sync.
- Keep Settings as the full setup, status, and recovery surface.
- Keep dashboard header icons as compact manual shortcuts.
- Show conflicts, retryable errors, and `needsPush` through existing sync status
  surfaces.
- Manual action dialogs continue to explain force pull and force push.

The status payload must not include raw tokens, authorization headers, Gist file
contents, backup payloads, or secret suffixes.

## Runtime Contract

Add a surface-open check runtime method, likely:

```txt
sync.checkRemoteOnOpen
```

Allowed surfaces:

- popup
- dashboard
- content-script

The request should include a validated `surface` field. The response should be a
structured sync action result or a small validated no-op result. The exact shape
can be finalized during planning, but it must be safe for UI callers and must
not expose secrets or backup content.

Manual `sync.pullLatest` and `sync.pushLocal` remain dashboard-only. Automatic
background alarm jobs should not be exposed as callable UI methods.

## Scheduler Foundation For Future Notifications

The scheduler should be reusable by future reminders/notifications, but this
task does not implement notifications.

Future notification work can add jobs such as:

```txt
reminders:daily
```

That later feature should own notification copy, due-review policy,
`chrome.notifications` permission, and manual smoke tests. The scheduler should
only provide the durable alarm dispatch substrate.

## Testing Strategy

Use TDD with focused tests before implementation.

Scheduler tests:

- registers named jobs and dispatches the matching alarm
- creates, clears, and repairs namespaced alarms
- rejects or ignores unknown alarm names safely
- supports injected clock/alarm adapters for deterministic tests

Backoff tests:

- maps retry attempts to `1m`, `5m`, `15m`, and capped `30m`
- resets retry state after success
- does not schedule retry for non-retryable outcomes

Sync auto tests:

- local mutation schedules auto-push only after dirty mark and snapshot flush
- auto-push calls safe push and never passes force flags
- remote-changed auto-push records conflict and stops auto retry
- retryable push failure preserves `needsPush` and schedules retry
- successful push clears retry state and dirty state
- surface-open clean pull restores changed remote data
- dirty local data blocks auto-pull
- periodic poll uses the same safe clean-pull policy

Runtime/background tests:

- `sync.checkRemoteOnOpen` is authorized for popup, dashboard, and content
  script senders
- background startup repairs expected alarms
- alarm dispatch enters the existing mutation/sync queue
- manual pull/push success clears pending auto alarms
- scheduling failure does not fail the local mutation

UI tests:

- background auto-sync results do not open force dialogs
- Settings/header manual actions still open force dialogs when needed
- conflict and retryable error status remains visible
- status/results do not include tokens or backup payloads

Manual smoke testing:

1. Configure sync in browser/profile A and browser/profile B.
2. Change local data in A.
3. Confirm A saves locally and schedules auto-push.
4. Wait for the debounce or trigger the alarm in development.
5. Open or reload B.
6. Confirm B clean-pulls the latest remote data.
7. Create a conflict by changing both A and B before syncing.
8. Confirm automatic sync stops and manual force pull/push is required.

## Documentation Updates After Implementation

Update current docs when implementation lands:

- `docs/product.md`: describe automatic safe sync plus manual recovery.
- `docs/architecture.md`: document scheduler ownership, alarm permission,
  auto-sync flow, and force precedence.
- `docs/testing.md`: add two-profile auto-sync smoke steps and alarm
  troubleshooting.
- `docs/superpowers/README.md`: keep this spec listed as implementation
  history.

## Open Implementation Notes

- The implementation plan should decide whether the open-check response reuses
  `SyncActionResult` or introduces a smaller `SyncAutoCheckResult`.
- The existing HTTP layer currently returns response bodies, not response
  headers. ETag-based conditional GET is useful but not required for v1 because
  poll frequency is low and authenticated REST limits are high for this use.
- If sync payloads grow enough to hit Gist API truncation, add a future raw URL
  fallback with explicit `gist.githubusercontent.com` host permission.
