# Directional GitHub Gist Sync Design

Date: 2026-05-26
Status: Approved design, awaiting written spec review before implementation
planning

## Context

CogniPace currently has optional GitHub Gist pseudo-sync built around one
user-facing `Sync now` action. That action hides the actual direction of the
operation. In browser-to-browser testing, the user needs a clear way to say
"make this browser match the Gist" or "make the Gist match this browser."

This design supersedes the user-facing `Sync now` behavior from
`docs/superpowers/specs/2026-05-26-github-gist-sync-design.md`. It does not
replace the broader approved foundation from that spec:

- GitHub Gist only for v1 sync.
- Local-first behavior remains the product default.
- GitHub PATs stay in trusted `chrome.storage.local`, read only by the
  background service worker.
- Secrets are excluded from backups, Gist payloads, logs, and UI cache data.
- The shared HTTP and secrets foundations remain the correct architecture.

This is a manual-first correction pass. It makes the direction explicit,
improves the UI, adds focused tests, and removes confusing old user-facing
surfaces. Automatic clean pull-on-open can be added in a later pass after the
manual contract is proven.

## Goals

- Replace visible `Sync now` actions with explicit `Pull latest` and
  `Push local` actions.
- Give the dashboard header compact pull and push shortcuts beside the theme
  button.
- Keep Settings as the full recovery and setup surface for GitHub Gist sync.
- Make local saves always succeed, even when remote sync later fails.
- Treat local mutations as "needs push" until a successful push or pull clears
  the dirty state.
- Block destructive pull when local changes have not been pushed.
- Require confirmation before pushing over a remote Gist that changed elsewhere.
- Return structured action outcomes that UI, tests, and local instrumentation can
  reason about.
- Add lightweight but durable tests for service rules, runtime contracts, UI
  structure, and instrumentation.
- Clean old user-facing smart-sync implementation details that no longer serve
  the product model.

## Non-Goals

- True real-time collaboration.
- Automatic pull-on-open, reload, first interaction, or mutation-triggered
  background sync in this pass.
- Entity-level merge or selective conflict resolution.
- A hosted CogniPace backend or account system.
- New secret-storage hardening beyond the approved v1 baseline.
- Passphrase lock, AWS KMS, Azure Key Vault, or enterprise key wrapping.
- Moving popup or overlay into full sync management surfaces.

## Product Semantics

The UI should teach two direct commands:

- `Pull latest`: update this browser from the connected Gist.
- `Push local`: update the connected Gist from this browser.

`Pull latest` means the current local database should match the remote backup
after the action succeeds. It is safe only when local data is clean. If local
data has unsynced changes, pull is blocked and no restore happens.

`Push local` means the remote Gist should match the current local database after
the action succeeds. If the remote Gist changed since this browser last synced,
the first push attempt returns a confirmation-required result. A confirmed
second action overwrites the remote Gist with local data.

Local saves are independent from remote sync. A local mutation must persist and
invalidate local UI as normal. Sync failure creates a status or retry alert, not
a failed save.

## User-Facing Flows

### Pull Latest

1. User clicks `Pull latest` in Settings or the dashboard header.
2. Background verifies sync is configured and loads the latest Gist file.
3. If remote data has not changed, return `no-change`.
4. If local data is dirty, return `blocked` with reason `local-dirty`.
5. If local data is clean and remote data is valid, restore the remote backup.
6. Flush the local database snapshot.
7. Broadcast cache invalidation for all affected query families.
8. Record last pull metadata, clear dirty state, and return `success`.

The blocked state should use direct copy such as:

```txt
Pull blocked: local changes have not been pushed.
```

### Push Local

1. User clicks `Push local` in Settings or the dashboard header.
2. Background verifies sync is configured and checks the latest remote version.
3. If remote has changed and the request is not confirmed, return
   `confirmation-required` with reason `remote-changed`.
4. UI shows a confirmation prompt explaining that the Gist changed elsewhere.
5. If user confirms, call push again with overwrite confirmation.
6. Export local backup, write the Gist file, record last push metadata, clear
   dirty state, and return `success`.

The confirmation action should use clear destructive copy such as:

```txt
Remote changed since this browser last synced. Push local data anyway?
```

The destructive confirmation button should be labeled `Overwrite Gist`.

### Clean No-Change

If neither local nor remote data changed, both actions should return a
`no-change` outcome with a friendly status. The UI can show `Up to date` or
`No remote changes`.

### Retryable Failure

Network, GitHub rate-limit, and temporary availability failures must not roll
back local saves. The service records a retryable sync error and returns a safe
error result to the caller. The user can retry from Settings or the header.

## Service API

The sync feature should expose directional service methods:

```ts
pullLatest(): Promise<SyncActionResult>

pushLocal(input?: {
  confirmRemoteOverwrite?: boolean
}): Promise<SyncActionResult>
```

Runtime methods should mirror those commands:

- `sync.pullLatest`
- `sync.pushLocal`

`sync.syncNow` should not be used by UI. If keeping it temporarily reduces risk,
it should be treated as an internal compatibility wrapper and removed from
visible API hooks, visible copy, and new tests.

`sync.resolveConflict` can remain only if the implementation still stores
explicit conflict summaries that need recovery. The preferred UI should no
longer present conflict as an abstract "resolve conflict" choice; it should use
the same directional pull and push language.

## Result Model

Directional actions need a richer response than a single status string. The
runtime response should validate a structured result with Zod.

```ts
type SyncAction = 'pull-latest' | 'push-local'

type SyncActionDirection = 'pull' | 'push' | null

type SyncActionOutcome =
  | 'success'
  | 'no-change'
  | 'blocked'
  | 'confirmation-required'
  | 'error'

type SyncActionReason =
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

type SyncActionResult = {
  action: SyncAction
  direction: SyncActionDirection
  outcome: SyncActionOutcome
  reason: SyncActionReason | null
  retryable: boolean
  message: string
  status: SyncStatusSnapshot
  occurredAt: string
}
```

Policy blocks such as dirty local pull or unconfirmed remote overwrite should be
normal results, not thrown exceptions. Exceptions remain appropriate for
unexpected implementation errors, but the runtime boundary should still return a
safe user-facing message.

No result, status payload, test fixture, or instrumentation event may include a
token, authorization header, secret suffix, raw backup payload, or Gist file
contents.

## Sync Status Shape

The existing sync status should evolve to support explicit decisions without
exposing implementation internals. The UI needs enough information to render
state, enable buttons, and show the next sensible action.

Important status fields:

- configured/enabled state
- token configured state
- Gist connected state
- last pull timestamp
- last push timestamp
- last remote version or timestamp
- dirty local state, exposed as `needsPush`
- pending action state when a sync operation is running
- last retryable error summary
- last blocking policy reason

Do not expose raw tokens or raw GitHub response bodies.

## UI Design

### Dashboard Header

Add compact icon shortcuts beside the theme button:

- Cloud down icon: `Pull latest from Gist`
- Cloud up icon: `Push local to Gist`

The icons should come from the existing icon library, preferably lucide
`CloudDownload` and `CloudUpload` if available. They should use the dashboard
header's existing icon-button density, tooltip behavior, disabled state, and
focus style.

Header buttons should appear only when Gist sync is configured enough to act.
They should not replace the Settings panel, because setup, token recovery,
confirmation details, and conflict explanation belong in Settings.

### Settings Panel

Replace `Sync now` with two explicit buttons:

- `Pull latest`
- `Push local`

The Settings panel remains the full operational surface for:

- token save/test/delete
- connect existing Gist
- create private Gist
- status display
- retryable sync alerts
- destructive overwrite confirmation
- blocked pull explanation

Use direct copy:

- `Up to date`
- `Last pulled: <time>`
- `Last pushed: <time>`
- `Local changes need push`
- `Pull blocked: local changes have not been pushed.`
- `Remote changed since this browser last synced.`
- `Overwrite Gist`

The previous visible `Sync now` label should be removed from Settings and any
new docs or tests for this behavior.

## Architecture Fit

Keep ownership aligned with the current project architecture:

- `src/features/sync/api`: runtime contracts, serializers, and React hooks for
  directional actions.
- `src/features/sync/server`: background orchestration for pull and push.
- `src/features/sync/domain`: pure decision rules for whether pull or push can
  proceed.
- `src/features/sync/data`: local sync metadata storage.
- `src/features/sync/components`: Settings panel UI.
- `src/app/dashboard`: header placement and composition only.
- `src/platform/http`: generic REST/GraphQL mechanics.
- `src/platform/secrets`: provider-neutral BYOK secret storage.

React components should call feature API hooks rather than constructing runtime
messages inline. The dashboard header and Settings panel should share the same
directional hooks so their status and side effects cannot drift.

## Instrumentation

Instrumentation here means local, structured sync action reporting for UI,
tests, and debugging. It does not mean external analytics.

Every directional action should produce a small structured event or result
record with:

- action
- direction
- outcome
- reason
- retryable flag
- occurred timestamp
- duration if easily available
- source surface when known, such as `settings` or `dashboard-header`

Instrumentation must be redacted by construction. It should not contain:

- GitHub token
- authorization headers
- raw Gist file content
- raw backup JSON
- full error objects from GitHub
- personally identifying GitHub account data

This result shape is also the test contract. Tests should assert meaningful
outcomes rather than brittle UI text everywhere.

## Conflict And Safety Rules

- Pull never overwrites dirty local data.
- Push never overwrites a changed remote Gist without confirmation.
- Clean remote pulls are allowed by the service model, but automatic clean
  pull-on-open is out of scope for this pass.
- A failed remote operation never reverses a successful local save.
- Remote payload validation happens before any restore write.
- Unsupported newer remote schemas block pull and show update-required guidance.
- Missing or deleted Gists block remote actions and point the user back to
  Settings setup.
- Concurrent sync actions should serialize or return an `already-running`
  result.

## Cleanup

Implementation should remove old user-facing smart-sync pieces that conflict
with the new mental model:

- visible `Sync now` button text
- UI tests that assert `Sync now`
- user-facing docs added during implementation that describe one manual smart
  sync action
- settings action names that hide direction
- header/status copy that says sync succeeded without saying pull, push, or
  no-change

Internal comparison helpers can stay if they still support directional pull and
push decisions. Do not keep public APIs or component props solely for the old
smart-sync UI.

## Test Plan

The implementation should be test-driven. Start with the smallest red tests that
define the contract, then implement the code to make them pass.

### Service Rules

- `pullLatest` restores remote data, flushes snapshots, invalidates caches, and
  records pull metadata when local is clean and remote changed.
- `pullLatest` returns `blocked` with reason `local-dirty` and does not restore
  when local data has unsynced changes.
- `pullLatest` returns `no-change` when remote data is unchanged.
- `pushLocal` writes the Gist and records push metadata when remote is unchanged.
- `pushLocal` returns `confirmation-required` with reason `remote-changed` when
  remote changed and overwrite was not confirmed.
- `pushLocal({ confirmRemoteOverwrite: true })` overwrites the Gist and records
  push metadata.
- Expected policy outcomes do not throw.
- Network or auth failures return redacted error results and preserve local data.

### Runtime And Contracts

- `sync.pullLatest` and `sync.pushLocal` validate request and response payloads
  with Zod.
- Runtime policy allows the intended dashboard/header callers and still prevents
  raw secret reads outside the background service worker.
- Directional actions refresh sync status after completion.
- Response fixtures use `satisfies` to protect the public result shape.

### UI Structure

- Settings renders `Pull latest` and `Push local`.
- Settings no longer renders visible `Sync now`.
- Dashboard header renders accessible cloud download/upload actions when sync is
  configured.
- Header actions call the same directional hooks as Settings.
- Dirty local pull shows a blocked status instead of opening a destructive
  restore path.
- Remote-changed push shows confirmation, then calls confirmed push when the
  user chooses `Overwrite Gist`.

### User Structure And Instrumentation

- `SyncActionResult` includes action, direction, outcome, reason, retryable, and
  occurred timestamp.
- Result/status payloads never include token-like values.
- Instrumentation distinguishes `pull-latest` from `push-local`.
- Retryable errors are visible in status without blocking unrelated local saves.

Avoid snapshots, CSS assertions, and duplicate render-only tests. Prefer focused
service tests, contract tests, and Testing Library assertions for visible
controls and accessibility names.

## Implementation Order For The Future Plan

The next implementation plan should be sequenced this way:

1. Add failing service/domain tests for `pullLatest` and `pushLocal`.
2. Add directional result contracts and serializers.
3. Implement service logic behind existing sync metadata and backup restore
   helpers.
4. Add runtime methods and authorization.
5. Add feature API hooks.
6. Replace Settings `Sync now` with directional actions.
7. Add dashboard header cloud pull/push shortcuts.
8. Remove old visible smart-sync tests and copy.
9. Update current product, architecture, testing, and design docs to match the
   landed behavior.
10. Run focused tests first, then `npm run check`.

The writing-plans step should turn this into exact file-level tasks after the
written spec is reviewed.
