# GitHub Gist Sync And Secrets Design

Date: 2026-05-26
Status: Approved design, awaiting written spec review before implementation
planning

## Context

CogniPace v2 is a local-first WXT, React, TypeScript, Chrome MV3 extension. The
current source of truth is the local SQLite WASM database restored from
`chrome.storage.local` snapshots. The product currently has backup, restore, and
reset flows in Settings, but no approved cloud sync, account system, backend, or
generic SaaS behavior.

This design intentionally changes that product scope in one narrow way:
CogniPace will support user-provided GitHub Gist sync for pseudo real-time
cross-browser continuity. The app remains local-first. There is no CogniPace
account, hosted backend, or collaborative real-time service.

The user-approved v1 security baseline is:

- `chrome.storage.local` for persisted secrets
- `chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS_ONLY' })`
- background-only secret use through runtime methods
- no secrets in backup export, Gist payloads, query caches, or logs
- future hardening reserved for passphrase lock and enterprise KMS-backed
  secret wrapping

This design also introduces a shared external API transport layer so GitHub REST,
LeetCode REST/GraphQL, and future GenAI calls follow one disciplined pattern
instead of ad hoc fetch calls.

## Reference Findings

LeetSRS is the main reference point. It uses one private Gist JSON file and a
simple timestamp-based last-writer-wins sync. The useful pieces are:

- dedicated Gist sync service
- one private Gist file
- PAT excluded from export/import
- explicit create, validate, connect, sync-now, and auto-sync flows
- service-level sync tests

The pieces CogniPace should improve are:

- LeetSRS stores the GitHub PAT in Chrome sync storage. CogniPace should not.
- LeetSRS validates auth with `users.getAuthenticated`, not direct Gist
  read/write capability. CogniPace should validate the actual Gist operations it
  needs.
- LeetSRS pulls destructively by timestamp. CogniPace should only auto-pull when
  local state is clean.
- LeetSRS does not use a strong runtime/backup validation boundary. CogniPace
  already has Zod backup contracts and should reuse them.

EasyRepeat stores GenAI keys in `chrome.storage.local` and strips them from
backup export. That is closer to the desired baseline, but CogniPace should add
trusted-context-only storage access, dedicated secret APIs, and background-only
use rather than storing keys inside a general settings object.

## Goals

- Add GitHub Gist pseudo-sync for durable CogniPace data.
- Reuse the existing backup contract as the remote data payload.
- Make schema evolution explicit through backup/envelope versioning and future
  migrators.
- Keep local saves authoritative and non-blocking when sync fails.
- Auto-pull clean remote updates on popup, overlay, dashboard, reload, or first
  interaction.
- Auto-push after local mutations when sync is configured.
- Detect true conflicts and require a user choice in Settings.
- Add a provider-neutral local secrets substrate that future GenAI keys can use.
- Add a shared external network API layer for REST and GraphQL request
  declarations.
- Keep React components behind feature APIs and extension runtime messages.

## Non-Goals

- CogniPace accounts, authentication, or hosted identity.
- A hosted backend service.
- True real-time collaboration or live multi-client conflict resolution.
- Entity-level merge sync in v1.
- Raw SQLite database sync.
- Visible GenAI API key UI in v1.
- Passphrase encryption in v1.
- AWS KMS, Azure Key Vault, or enterprise key wrapping in v1.
- Syncing secrets across devices.

## Chosen Approach

Use a comprehensive remote backup envelope stored in one private GitHub Gist
file.

The Gist file is not raw SQLite bytes. It contains a versioned sync envelope with
a versioned CogniPace backup inside it. The backup remains the public durable
data contract and is validated before restore. If future database migrations do
not change the public backup shape, sync keeps working without remote file
changes. If the backup shape changes, the backup schema version changes and
migrators convert supported old backups into the current restore shape.

This approach is smaller and safer than an entity-level sync engine for v1 while
remaining comprehensive enough for new schemas and all durable data.

## User-Facing Behavior

GitHub Sync lives in Settings, inside the Data Management area.

The user can:

- paste and test a GitHub PAT
- create a private CogniPace Gist
- connect an existing CogniPace Gist
- enable or disable sync
- run Sync now
- delete the local GitHub token
- resolve conflicts by pulling remote or pushing local

Popup and overlay do not become sync management surfaces. They can benefit from
safe sync-on-open and may show compact non-blocking sync status when the shell
already has feedback space, but recovery actions live in Settings.

## Secrets Foundation

Create shared secret infrastructure under:

```txt
src/platform/secrets/
  secret-store.ts
  secret-contracts.ts
  secret-redaction.ts
```

The API is provider-neutral:

```ts
type SecretProviderId =
  | 'github:gist'
  | 'genai:openai'
  | 'genai:anthropic'
  | 'genai:google'

type SecretStatus = {
  provider: SecretProviderId
  configured: boolean
  updatedAt: string | null
  fingerprint: string | null
}
```

The store supports:

- `saveSecret(provider, secret)`
- `readSecret(provider)`
- `deleteSecret(provider)`
- `getSecretStatus(provider)`
- `restrictSecretStorageAccess()`

Rules:

- Store secret values in `chrome.storage.local` only.
- Call `chrome.storage.local.setAccessLevel({ accessLevel:
'TRUSTED_CONTEXTS_ONLY' })` during background startup before secret reads.
- Never store secrets in SQLite `settings_kv`.
- Never include secrets in backup export, sync envelopes, query caches, status
  payloads, or logs.
- Status can include a short non-secret fingerprint derived from a one-way
  digest, but never the raw value or raw suffix.
- React components never import the secret store directly.
- Feature runtime methods can save, delete, validate, and report status, but
  must not return full secret values to UI callers.

This is stronger than storing secrets in a general settings object and keeps the
future GenAI key path aligned with the GitHub PAT path.

## External API Layer

Create a shared transport layer under:

```txt
src/platform/http/
  http-client.ts
  http-error.ts
  json.ts
  redaction.ts
  graphql-client.ts
  rest-client.ts
```

The platform HTTP layer owns generic network mechanics only:

- one configured client or client factory per runtime context
- JSON request and response handling
- REST helper
- GraphQL POST helper
- normalized HTTP errors
- status-code mapping
- redaction of headers, bearer tokens, API keys, query-string keys, and request
  bodies before errors/logs leave the transport boundary
- injected `fetch` for tests
- pass-through `AbortSignal` support when a caller supplies one; standalone
  timeout infrastructure is not required for v1

It does not know GitHub, LeetCode, or GenAI domain rules.

Product integrations declare their own requests on top of `platform/http`:

```txt
src/lib/github/api/
  github-client.ts
  gist-contracts.ts
  gist-requests.ts

src/lib/leetcode/api/
  leetcode-graphql-client.ts
  problem-metadata-request.ts
  problem-content-request.ts
  submission-requests.ts

future:
src/lib/genai/api/
  openai-requests.ts
  anthropic-requests.ts
  gemini-requests.ts
```

Each request declaration owns:

- request type
- response Zod schema
- endpoint path
- required headers
- fetcher function
- service-specific error mapping when generic HTTP status is not enough

React Query hooks remain in `src/features/*/api`, not in `src/lib/*`, because
CogniPace UI talks to extension runtime methods. This adapts Bulletproof React's
API-layer rule to a Chrome extension:

```txt
React component
-> feature API hook
-> extension runtime message
-> background feature service
-> lib external API request declaration
-> platform/http
```

## LeetCode Library Impact

The existing `src/features/leetcode-capture` feature remains the runtime and
product boundary for LeetCode page capture. It still owns:

- runtime contracts for page/content/submission reads
- allowed content-script sender behavior
- background capture service orchestration

The network transport inside the LeetCode library should be cleaned up:

- Generic GraphQL fetch/error mechanics move from
  `src/lib/leetcode/core/graphql-client.ts` into `src/platform/http`.
- LeetCode-specific GraphQL endpoint construction, CSRF headers, credentials,
  operation names, and response schemas live under `src/lib/leetcode/api`.
- Submission list and submission check REST calls move behind
  LeetCode-specific request declarations that use `platform/http`.
- DOM readers, content parsing, editor readers, page watchers, and capture state
  stay in `src/lib/leetcode`; they are not network concerns.
- `createLeetCodeFetchRemoteClient` remains the facade used by
  `features/leetcode-capture/server`, but internally it should call the new
  LeetCode API request declarations.

This keeps `leetcode-capture` from becoming a transport layer while preserving
the existing feature boundary and product behavior.

## GitHub Integration

Create GitHub request declarations under `src/lib/github/api`.

Required operations:

- validate token by calling a GitHub endpoint that proves authenticated access
  and, when possible, the specific Gist read/write capability needed by v1
- get a Gist
- create a private Gist
- update a Gist file
- read the latest remote version from Gist history or `updated_at`
- map 401, 403, 404, 422, 429, and network failures into safe application
  errors

Use GitHub REST with standard JSON headers and the configured API version. The
extension needs GitHub API network access. Prefer optional host permission for
`https://api.github.com/*` if WXT keeps the implementation clean; otherwise add
the narrow required host permission.

The Gist file name should be stable, for example:

```txt
cognipace-sync.json
```

The Gist should be private by default. Public Gists are not part of v1.

## Sync Feature Architecture

Create a new owning feature:

```txt
src/features/sync/
  api/
    sync-api.ts
    sync-contracts.ts
    sync-serializers.ts
  components/
    github-sync-panel.tsx
  data/
    sync-metadata-store.ts
  domain/
    sync-status.ts
    sync-conflict.ts
  server/
    sync-service.ts
```

The sync feature owns status, configuration, metadata, conflict detection, and
Gist orchestration. It does not directly own practice, problems, tracks, or
settings rows.

Sync service dependencies:

- `features/backup/server` for export, validation, and restore
- `platform/secrets` for GitHub PAT access
- `lib/github/api` for GitHub REST calls
- `platform/db` mutation/snapshot flushing via background handlers
- cache invalidation broadcaster after successful pull/restore

Runtime methods:

- `sync.getStatus`
- `sync.saveGithubToken`
- `sync.deleteGithubToken`
- `sync.validateGithubToken`
- `sync.createGithubGist`
- `sync.connectGithubGist`
- `sync.setEnabled`
- `sync.checkOnOpen`
- `sync.syncNow`
- `sync.resolveConflict`

Surface access:

- Dashboard can configure, validate, connect, sync now, disable, delete token,
  and resolve conflicts.
- Popup, dashboard, and content-script can trigger safe `sync.checkOnOpen`.
- No surface receives raw token values.

## Local Sync Metadata

Sync metadata is product state but not part of the backed-up durable study data.
Store it in `chrome.storage.local` through `src/features/sync/data`.

Metadata shape:

```ts
type SyncMetadata = {
  enabled: boolean
  gistId: string | null
  lastSyncAt: string | null
  lastSyncDirection: 'push' | 'pull' | 'no-change' | null
  lastRemoteVersion: string | null
  lastRemoteUpdatedAt: string | null
  localDataUpdatedAt: string | null
  dirtySinceLastSync: boolean
  lastError: SyncErrorSummary | null
  conflict: SyncConflictSummary | null
}
```

`localDataUpdatedAt` changes whenever local durable CogniPace data changes.
`dirtySinceLastSync` means local data changed after the last successful sync.

Sync metadata is intentionally excluded from the backup payload so restoring a
backup or pulling from a Gist does not accidentally import stale token or sync
configuration from another install.

## Remote Sync Envelope

The Gist file contains one JSON envelope:

```ts
type CogniPaceSyncEnvelope = {
  syncEnvelopeVersion: 1
  app: 'cognipace'
  exportedAt: string
  dataUpdatedAt: string
  backup: CogniPaceBackupFile
}
```

Rules:

- `syncEnvelopeVersion` versions sync metadata outside the backup.
- `backup.schemaVersion` versions the durable data payload.
- `app` must be `cognipace`.
- `backup.app` must be `cognipace`.
- `dataUpdatedAt` is the local durable data timestamp at push time.
- Secrets are never included.
- Unknown top-level fields are rejected in v1 unless a future schema explicitly
  allows extension fields.

If the remote sync envelope version is newer than this extension supports, sync
must not pull. If the backup schema version is newer than this extension
supports, sync must not pull. In both cases Settings shows an update-required
status.

## Backup Schema Evolution

The current backup contract is schema version 1. V1 sync should make the backup
parser migrator-ready even if only schema version 1 is supported initially.

Policy:

- Export always writes the latest backup schema.
- Import/sync pull parses envelope first, then backup.
- Supported old backup versions are migrated into the current restore shape.
- Future backup versions are rejected before any write.
- Malformed backup data is rejected before any write.
- Broken references are rejected before any write.
- The remote file is never trusted just because it came from the user's Gist.

This keeps schema evolution at the public backup-contract layer instead of
coupling sync to Drizzle migration internals.

## Sync Flows

### Setup

1. User opens Settings/Data Management.
2. User enters GitHub PAT.
3. Dashboard calls `sync.validateGithubToken` for a non-persisting check or
   `sync.saveGithubToken` to validate and persist the token.
4. Background validates GitHub/Gist access, then stores a successfully saved
   token through `platform/secrets`.
5. User creates a private Gist or connects an existing Gist.
6. Sync metadata stores `gistId` and `enabled`.
7. Initial sync pushes local backup if the Gist is empty.
8. If an existing Gist has valid CogniPace data and the local install has no
   user-created data beyond seed/default rows, initial sync can pull.
9. If an existing Gist has valid CogniPace data and the local install also has
   user-created data but no shared sync baseline, Settings asks the user to
   choose initial pull or initial push.

### Sync On Open

Popup, dashboard, and overlay can call `sync.checkOnOpen` during load or first
interaction.

If sync is not configured, the check is a no-op.

If remote is newer and local is clean:

1. Fetch remote Gist file.
2. Validate envelope and backup.
3. Restore through the backup restore service.
4. Flush DB snapshot.
5. Broadly invalidate settings, problems, practice, queue, tracks, and
   app-shell queries.
6. Record pull metadata and clear dirty state.

If local and remote both changed since the last successful sync:

1. Do not pull.
2. Do not push.
3. Mark conflict.
4. Surface the conflict in Settings.

If there is no remote change, record no-change metadata when useful and continue.

### Sync After Mutation

Local saves always win the immediate user workflow.

1. User performs a local mutation.
2. Existing runtime handler writes the DB.
3. Background flushes the DB snapshot.
4. Sync metadata marks local data dirty.
5. Background attempts an async push if sync is configured and no conflict is
   active.
6. On push success, metadata records the latest remote version and clears dirty
   state.
7. On push failure, local save remains successful; Settings records a retryable
   sync error.

All durable user mutations should mark dirty, including backup restore and local
reset, except a restore that is itself part of a sync pull. A sync pull updates
local data and then records clean sync metadata instead of immediately pushing
the pulled data back.

### Manual Sync Now

`sync.syncNow` performs the same comparison logic as sync-on-open, but it is
started from Settings and returns a user-facing result.

### Conflict Resolution

Conflict means local changed since the last successful sync and remote also
changed since the last successful sync.

Settings offers two choices:

- Pull remote and replace local data.
- Push local and overwrite the remote Gist file.

Both actions are explicit destructive choices. Both must refresh metadata after
success.

## Error Handling

Auth and permission errors:

- Stop automatic sync.
- Keep local data unchanged.
- Show token needs attention.

Missing or deleted Gist:

- Stop automatic sync.
- Let the user reconnect an existing Gist or create a new one.

Malformed remote file:

- Never auto-pull.
- Show a remote file invalid status.
- Offer to push local data over the remote file from Settings.

Unsupported newer schema:

- Never auto-pull.
- Tell the user to update CogniPace before syncing this Gist.

Network and rate-limit errors:

- Do not block local saves.
- Store retryable error status.
- Keep Sync now available.

Concurrent sync:

- Serialize sync work in background or return an already-syncing result.
- Avoid overlapping push/pull operations.

Logging:

- No token values.
- No authorization headers.
- No raw API-key query strings.
- No backup payload dumps in errors.

## UI Design

Add `GitHub Sync` under Settings/Data Management.

The panel is compact and operational, matching the existing Settings surfaces:

- status row
- token configured state
- Gist connected state
- last sync time and direction
- error/conflict state when present
- primary action based on state
- secondary actions for delete token, disable sync, connect existing Gist, or
  create Gist

Do not add a landing page, wizard, or dashboard-scale sync center.

Use existing UI primitives:

- `Surface`
- `Button`
- `InlineStatus`
- existing settings/data-management panel patterns
- lucide icons for actions when helpful

## Documentation Updates During Implementation

When implementation lands, update current docs, not only this spec:

- `docs/product.md`: GitHub Gist sync becomes approved v1 behavior, while
  accounts/backend/full realtime remain non-goals.
- `docs/architecture.md`: add `platform/http`, `platform/secrets`, and
  `features/sync` ownership rules.
- `docs/testing.md`: add sync setup and cross-browser/profile smoke flows.
- `design.md`: only if the Settings panel introduces new UI states not covered
  by existing Data Management rules.

## Testing Plan

Keep tests focused on durable contracts and boundaries.

### Platform Secrets

- stores, reads, deletes, and reports status by provider ID
- status never includes the full secret
- storage access restriction is called from background startup
- secrets are not included in backup/sync payload construction

### Platform HTTP

- JSON success and parse failure
- REST helper request shape
- GraphQL helper request shape
- normalized error mapping
- redaction of auth headers, API keys, and sensitive URLs
- injected fetch support
- caller-supplied `AbortSignal` pass-through

### GitHub API

- validate token request
- get Gist request
- create private Gist request
- update Gist file request
- response schema validation
- 401, 403, 404, 422, 429, and network error mapping
- token/header redaction in errors

### LeetCode API Migration

- existing metadata, content, submission list, and submission check tests still
  pass through the new `platform/http` transport path
- behavior does not change for DOM fallback
- `leetcode-capture` runtime authorization remains content-script only where
  required

### Sync Contracts And Service

- malformed runtime requests are rejected
- malformed remote envelopes are rejected
- unsupported future envelope or backup schema blocks pull
- create Gist pushes current backup
- connect existing Gist validates file identity and app
- clean local plus newer remote auto-pulls
- local dirty plus unchanged remote pushes
- local dirty plus changed remote marks conflict
- failed push leaves local mutation successful and records retryable error
- concurrent sync calls do not overlap
- conflict pull and conflict push both clear conflict on success

### Runtime Policy And Handlers

- dashboard-only management methods
- safe `sync.checkOnOpen` allowed from popup, dashboard, and content-script
- no runtime method returns raw PAT values
- successful pull flushes DB snapshot before invalidation
- mutation-triggered push does not block mutation response

### Manual Smoke

- configure token and create Gist
- save a review from overlay and confirm local save succeeds even if sync fails
- open another browser/profile with the same token and Gist and auto-pull clean
  data
- make independent changes in two profiles and confirm conflict appears in
  Settings
- resolve conflict by pulling remote
- resolve conflict by pushing local
- verify backup export does not include PAT or future provider secrets

## Future Hardening

### Passphrase Lock

Add local envelope encryption:

- random DEK encrypts stored secrets
- passphrase-derived KEK wraps the DEK
- user unlocks secrets after browser restart
- no cloud KMS account required

### Enterprise KMS Wrapping

Add optional AWS KMS or Azure Key Vault envelope encryption for advanced users:

- cloud KMS key wraps the DEK
- disabling/revoking the cloud key blocks future unwrap operations
- extension must authenticate to the cloud provider
- decrypted secret caching must be short-lived for revocation to matter

This is not v1 because it adds another cloud identity, more host permissions,
and another secret-management problem.

## Open Implementation Notes

- Prefer optional host permission for `https://api.github.com/*` if WXT support
  is clean; otherwise use narrow required host permission.
- Avoid adding Octokit unless native fetch request declarations become
  meaningfully noisier than a small GitHub client. The current app already has
  strict linting and Zod contracts, so a focused fetch client may be enough.
- Avoid storing sync metadata in SQLite because it should not travel in backups
  or Gist payloads.
- Use the existing backup restore transaction for sync pulls.
- Keep implementation docs honest about exact validation commands run.
