# Backup, Restore, And Reset Design

## Status

Approved for implementation planning.

## Context

CogniPace v2 is a local-first WXT, React, TypeScript, Chrome MV3 extension. The
current source of truth is the local SQLite WASM database, restored from a
Chrome storage snapshot at boot. Backup, restore, and reset are future dashboard
work in the current product docs and should live in Settings, not Analytics.

This design follows the current project boundaries:

- `entrypoints -> app -> features -> platform/lib/components`
- background service worker owns trusted database work
- runtime payloads are validated with Zod
- UI calls feature APIs and hooks, not repositories or database modules
- no backend, auth, accounts, sync, teams, or Chrome permission expansion

The old CogniPace implementation exposed backup through
`features/backup/server`, exported a loose object with `version`, `problems`,
`studyStatesBySlug`, settings, topics, companies, and tracks, and imported by
sanitizing then progressively upserting data. That captured useful product
intent, but the v2 implementation should not copy its shape or merge behavior.
The key old failure points were a weak public format, partial progressive writes,
silent dropping of malformed data, and ambiguous merge semantics.

## Goals

- Export all durable local CogniPace state to a versioned JSON backup.
- Validate a backup before any restore write.
- Restore a full backup safely with all-or-nothing replacement behavior.
- Clear local data as a separate destructive action.
- Keep the UI plain, careful, and trust-building.
- Reserve a future home for selective imports without implementing them now.

## Non-Goals

- Cloud sync or account-backed backup.
- Importing old CogniPace v1 backup files directly.
- Selective import conflict handling in the first implementation.
- Debug panels or developer-only data inspection UI.
- Backing up transient browser state such as dashboard session drafts.

## Product UX

Backup, restore, and clear local data live in Settings as a Data Management
area with three separate parts.

### Backup / Restore

`Export backup` downloads the latest versioned JSON backup file. The export
uses a Blob download from the dashboard page and does not require the Chrome
`downloads` permission.

`Import full backup` uses a compact `Choose backup file` control instead of the
browser's native wide file input. The selected filename remains visible after
selection. After file selection, the app parses JSON, sends the parsed payload
to the background for validation, and shows a summary before any write. Success
feedback uses a toast instead of inline status blocks. The summary includes:

- backup schema version
- exported date
- source app or extension version when present
- counts for problems, topics, companies, tracks, track groups, memberships,
  progress rows, practice aggregate rows, FSRS cards, review attempts, and
  settings rows

The `Restore full backup` action appears only after validation succeeds and uses
a calm outline treatment until the confirmation dialog. The user must then
confirm restore. The confirmation states that restore replaces local CogniPace
data. After a successful restore, the import card returns to its empty state.
The Data Management page keeps a primary `Export backup` action available before
destructive restore.

### Selective Import

The Settings area includes a visible planned Selective Import section because
the product has not been released yet. It lists future supported sections:

- topics
- companies
- tracks
- problems

It has no active import controls. Before activation, selective import must
define conflict behavior for each section: skip existing, replace existing,
merge by stable identity, or reject conflicts.

### Clear Local Data

Clear local data lives in a separate danger zone. It is not presented as a
casual settings button.

`Clear local data` opens a confirmation dialog. The dialog asks whether the user
is sure, offers `Export backup first`, then requires explicit confirmation.
Clear performs a fresh-install reset:

- clear persisted CogniPace data
- reseed current built-in defaults
- reset settings to defaults

## Backup Format

Backups use a public JSON contract versioned independently from Drizzle
migrations.

```ts
type CogniPaceBackupFile = {
  schemaVersion: number
  app: 'cognipace'
  exportedAt: string
  source: {
    appVersion?: string
    extensionVersion?: string
  }
  data: {
    problems: ProblemBackupRow[]
    topics: TopicBackupRow[]
    companies: CompanyBackupRow[]
    problemTopics: ProblemTopicBackupRow[]
    problemCompanies: ProblemCompanyBackupRow[]
    practice: {
      problemPractice: ProblemPracticeBackupRow[]
      fsrsCards: FsrsCardBackupRow[]
      reviewAttempts: ReviewAttemptBackupRow[]
    }
    tracks: {
      tracks: TrackBackupRow[]
      groups: TrackGroupBackupRow[]
      memberships: TrackGroupProblemBackupRow[]
      progress: TrackProblemProgressBackupRow[]
      session: TrackSessionBackupRow[]
    }
    settings: SettingsKvBackupRow[]
  }
}
```

The v1 format is row-set based for completeness, but grouped into product
sections so it is not an opaque database snapshot. It includes durable DB-backed
state only:

- `problems`
- `topics`
- `companies`
- `problem_topics`
- `problem_companies`
- `problem_practice`
- `fsrs_cards`
- `review_attempts`
- `tracks`
- `track_groups`
- `track_group_problems`
- `track_problem_progress`
- `track_session`
- `settings_kv`

Dates are serialized as ISO strings in the backup contract and converted at the
service boundary. Runtime contracts and backup section schemas use Zod.

## Version Policy

Export always writes the latest backup schema version.

Import supports the current backup schema version plus one previous backup schema
version. Older versions and future versions are rejected before any write. Each
supported previous version must have:

- a Zod parser
- a deterministic migration into the current internal restore shape
- focused import tests

Database schema changes do not automatically break the public backup contract.
If the DB changes but the backup format remains semantically compatible, the
restore service maps the supported backup shape into the current DB shape. If the
backup shape must change, a new `schemaVersion` is introduced.

Full restore does not ignore invalid data. Invalid data is rejected with a clear
error before writing.

## Restore Semantics

Full restore is an exact replacement of persisted CogniPace state from the
backup, followed by the current required seed/default pass so the app remains
bootable with current built-in defaults.

Restore validates the whole file before writing:

- invalid JSON is rejected in the UI when possible
- malformed runtime payloads are rejected in background
- wrong `app` is rejected
- unsupported `schemaVersion` is rejected
- invalid section data is rejected
- broken references are rejected
- unknown top-level or section fields are rejected in v1 unless intentionally
  allowed in a future schema

The restore service writes in one transaction. It clears and rewrites tables in
dependency-safe order. If validation or insertion fails, the transaction rolls
back and existing local data remains unchanged.

On successful restore, the background handler flushes the DB snapshot before
broadcasting cache invalidation.

## Reset Semantics

Reset is a separate destructive operation from restore. It performs a
fresh-install reset in one transaction:

- clear dependent rows
- clear persisted product rows
- run `seedInitialCatalog`
- leave no custom settings row, so settings resolve to defaults

After success, the background handler flushes the DB snapshot before broad cache
invalidation.

## Architecture

Create a new owning feature:

```txt
src/features/backup/
  api/
    backup-api.ts
    backup-contracts.ts
  components/
    data-management-screen.tsx
    backup-restore-panel.tsx
    selective-import-panel.tsx
    reset-local-data-panel.tsx
  data/
    backup-repository.ts
  server/
    backup-service.ts
```

The feature name is `backup` because the user-facing language is Backup /
Restore, and reset belongs to the same sensitive local data management workflow.

Runtime methods are dashboard-only:

- `backup.exportFullBackup`
- `backup.validateFullBackup`
- `backup.restoreFullBackup`
- `backup.resetLocalData`

The normal flow is:

```txt
Settings UI
-> backup API hook
-> extension runtime message
-> Zod request parse
-> sender authorization
-> backup service
-> backup repository / DB transaction
-> Zod response parse
-> snapshot flush on writes
-> cache invalidation broadcast
-> query refetch
```

The broad invalidation tags after restore and reset are:

- `settings`
- `problems`
- `practice`
- `queue`
- `tracks`
- `app-shell`

## Service Responsibilities

`backup-service.ts` owns use cases:

- read all backup sections from the current DB
- create the backup envelope
- validate and summarize a backup
- migrate supported previous backup versions to the current restore shape
- restore a validated backup transactionally
- clear/reset local data transactionally

`backup-repository.ts` owns table-level reads and writes for the backup feature.
It may read and write rows across owned feature tables because backup/restore is
a cross-feature data-management operation, but those writes remain behind the
backup service and happen only from the background.

The repository should avoid application-level merge behavior for full restore.
It inserts validated row sets and relies on foreign keys plus explicit
cross-section validation to reject broken backups.

## UI Components

Settings should compose a feature-owned Data Management screen or section after
the existing settings form. The UI should use existing primitives:

- `Surface`
- `Button`
- `InlineStatus`
- existing modal/dialog pattern from feature components
- lucide icons where useful

The UI states are:

- loading or pending export
- export success and failure
- selected file
- validation pending
- validation success summary
- validation failure
- restore pending
- restore success and failure
- reset confirmation open
- reset pending
- reset cancel
- reset success and failure

The UI should avoid generic SaaS admin language. Primary labels are:

- `Export backup`
- `Import full backup`
- `Restore full backup`
- `Clear local data`

## Testing

Focused tests should cover:

- backup Zod schema accepts valid v1
- backup Zod schema rejects invalid app, unsupported version, future version,
  malformed sections, unknown fields, and broken references
- export includes all key DB categories
- validation returns counts without writing
- full restore replaces existing data with backup data
- restore rejects invalid data without changing existing rows
- reset clears local data, reseeds defaults, and resets settings
- runtime policy keeps backup methods dashboard-only
- background handlers parse, authorize, flush snapshot, and invalidate broad
  cache tags
- UI export action
- UI import validation success and summary
- UI import validation failure
- UI restore confirmation
- UI reset confirmation
- UI reset cancel
- UI export-current-backup action inside destructive dialogs

Validation sequence after implementation:

1. Focused backup domain, repository, and service tests.
2. Focused runtime, API, and component tests.
3. `npm run check`.
4. `npm run db:check` only if schema changes are added.

The current design should not require DB schema changes.

## Open Follow-Up Before Selective Import

Selective import must not be activated until conflict policy is designed and
tested for each section:

- topics
- companies
- tracks
- problems

The default full-restore policy is reject invalid data, replace all local data,
and avoid silent merges.
