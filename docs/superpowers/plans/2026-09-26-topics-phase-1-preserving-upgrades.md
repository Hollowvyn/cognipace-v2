# Topics Phase 1: Preserving Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace destructive fingerprint-mismatch startup with a staged, recoverable upgrade boundary.

**Architecture:** A small storage classifier distinguishes absence from damage. A platform-owned opening function stages deserialization and incremental SQL, invokes a background-supplied preparation callback, validates, and publishes only after success. Existing snapshot scheduling remains attached only to the active handle.

**Tech Stack:** TypeScript, Chrome local storage, SQLite WASM, Vitest, existing database proxy.

---

Read the [master plan](./2026-09-26-topics-implementation.md) and approved design
before starting. This phase changes no SQL schema and is independently shippable:
same-version snapshots still open, while unsupported snapshots stop safely.
Phase 2 supplies the first real new incremental migration.

## File Map

| File                                              | Responsibility                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Create `src/platform/db/snapshot-state.ts`        | Read raw storage and classify missing, valid, or damaged snapshots; retain recovery record. |
| Create `src/platform/db/snapshot-state.test.ts`   | Partial fields, encoding, recovery idempotence/failure.                                     |
| Modify `src/platform/db/migration-sql.ts`         | Export sorted named migration entries while preserving the exact existing SQL join.         |
| Create `src/platform/db/snapshot-upgrade.ts`      | Select the supported legacy prefix; check actual schema; run incremental SQL.               |
| Create `src/platform/db/snapshot-upgrade.test.ts` | Real SQLite legacy recognition, schema mismatch, and incremental failure.                   |
| Create `src/platform/db/open-snapshot.ts`         | Testable orchestration with explicit publication ordering.                                  |
| Create `src/platform/db/open-snapshot.test.ts`    | Failure injection and no-publish assertions.                                                |
| Modify `src/platform/db/instance.ts`              | Use safe opening and expose the pre-publication callback.                                   |
| Modify `src/platform/db/index.ts`                 | Export the callback type without exposing application rules.                                |
| Create `src/platform/db/instance.test.ts`         | Startup, coalescing, retry, hooks, and persistence.                                         |
| Modify `src/platform/db/snapshot.ts`              | Retain serialization helpers; remove the permissive reader from startup use.                |
| Modify `docs/architecture.md`, `docs/testing.md`  | Record preserving behavior and actionable recovery/export steps.                            |

## Task 1: Classify Storage Without Discarding Evidence

- [ ] Add the following storage contract and classifier to `snapshot-state.ts`.
      Write its test first, run red, then add the implementation. Reuse
      `SNAPSHOT_KEY`, `FINGERPRINT_KEY`, and `base64ToBytes` from `snapshot.ts`.

```ts
export interface SnapshotStorage {
  get(keys: string[]): Promise<Record<string, unknown>>
  set(values: Record<string, unknown>): Promise<void>
}

export type SnapshotState =
  | { kind: 'empty' }
  | { kind: 'invalid'; raw: Record<string, unknown>; reason: string }
  | {
      kind: 'stored'
      raw: Record<string, unknown>
      fingerprint: string
      bytes: Uint8Array
    }

export async function readSnapshotState(
  storage: SnapshotStorage,
): Promise<SnapshotState> {
  const values = await storage.get([SNAPSHOT_KEY, FINGERPRINT_KEY])
  const raw = Object.fromEntries(
    [SNAPSHOT_KEY, FINGERPRINT_KEY]
      .filter((key) => Object.hasOwn(values, key))
      .map((key) => [key, values[key]]),
  )
  if (Object.keys(raw).length === 0) return { kind: 'empty' }
  const fingerprint = raw[FINGERPRINT_KEY]
  const encoded = raw[SNAPSHOT_KEY]
  if (
    typeof fingerprint !== 'string' ||
    !/^[a-f0-9]{8}$/.test(fingerprint) ||
    typeof encoded !== 'string' ||
    encoded.length === 0
  ) {
    return {
      kind: 'invalid',
      raw,
      reason: 'Incomplete or invalid snapshot fields.',
    }
  }
  try {
    const bytes = base64ToBytes(encoded)
    if (bytes.length === 0) throw new Error('Empty snapshot.')
    return { kind: 'stored', raw, fingerprint, bytes }
  } catch {
    return { kind: 'invalid', raw, reason: 'Snapshot bytes cannot be decoded.' }
  }
}
```

Use this complete initial test in `snapshot-state.test.ts` with imports from
Vitest, `./snapshot-state`, and `./snapshot`. It asserts an observable loss case.

```ts
it('does not classify a missing fingerprint as a fresh install', async () => {
  const raw = { [SNAPSHOT_KEY]: 'AAAA' }
  const storage = { get: vi.fn().mockResolvedValue(raw), set: vi.fn() }
  expect(await readSnapshotState(storage)).toEqual({
    kind: 'invalid',
    raw,
    reason: 'Incomplete or invalid snapshot fields.',
  })
  expect(storage.set).not.toHaveBeenCalled()
})
```

- [ ] Run `rtk npx vitest run src/platform/db/snapshot-state.test.ts`; initially
      expect missing-export failure, then pass. Extend the test table with both
      fields absent, only fingerprint, invalid types, empty bytes, invalid Base64,
      and valid encoded SQLite bytes. A storage-read rejection must propagate and
      must not return `empty`.
- [ ] Add recovery storage under `cognipace_db_recovery_topics_v1` in the same
      module. Save `{version:1, raw, savedAt:<ISO date>}` before any upgrade. If an
      existing record has identical raw values, retain its original timestamp; if
      it differs, fail without overwriting it. Use deterministic equality over
      the two known storage fields and their presence, not a timestamp comparison.

```ts
export const RECOVERY_KEY = 'cognipace_db_recovery_topics_v1'

const recoveryRecordSchema = z.strictObject({
  version: z.literal(1),
  raw: z.record(z.string(), z.unknown()),
  savedAt: z.iso.datetime(),
})

export async function preserveRecovery(
  storage: SnapshotStorage,
  raw: Record<string, unknown>,
  now: Date,
) {
  const existing = (await storage.get([RECOVERY_KEY]))[RECOVERY_KEY]
  if (existing !== undefined) {
    const candidate = recoveryRecordSchema.safeParse(existing)
    if (
      candidate.success &&
      JSON.stringify(candidate.data.raw) === JSON.stringify(raw)
    )
      return
    throw new Error(
      'An earlier database recovery record must be exported before another upgrade.',
    )
  }
  await storage.set({
    [RECOVERY_KEY]: { version: 1, raw, savedAt: now.toISOString() },
  })
}
```

Import `z` from `zod`. The reader above always orders the two fields consistently.
The narrow recovery envelope retains unknown raw values so corrupt originals
can be exported. Duplicate recovery writes cannot
race because `getAppDb` coalesces opening. Do not automatically delete recovery
data after a successful upgrade.

- [ ] Add tests for recovery write rejection, retry retaining the first copy,
      and refusal to overwrite a different copy. Run the same focused command.
- [ ] Commit only these modules/tests with
      `fix(db): distinguish missing snapshots from damaged storage`.

## Task 2: Define The Only Supported Legacy Upgrade

- [ ] Refactor `migration-sql.ts` without changing its resulting string:

```ts
export const migrationEntries = Object.entries(migrationModules)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([path, sql]) => ({ path, sql: String(sql) }))

export const migrationSql = migrationEntries
  .map((entry) => entry.sql)
  .join('\n')
```

- [ ] In `snapshot-upgrade.ts`, define `legacyTopicMigrationPaths` as the exact
      eight existing paths `./migrations/0000_initial.sql`,
      `./migrations/0001_lively_namor.sql`, `./migrations/0002_add_track_due_at.sql`,
      `./migrations/0003_problem_slugs_and_constraints.sql`,
      `./migrations/0004_tracks_phase_3.sql`, `./migrations/0005_concerned_jubilee.sql`,
      `./migrations/0006_polite_vindicator.sql`, and
      `./migrations/0007_track_simple_recall.sql`. Export `legacyTopicMigrationSql`
      as these immutable entries joined by `\n` and its `computeFingerprint` value.
      Reject any missing, reordered, or unexpected prefix before selecting an
      upgrade. Do not automatically support every arbitrary prefix.

```ts
export function selectUpgradeSql(
  fromFingerprint: string,
  entries: readonly { path: string; sql: string }[] = migrationEntries,
): string {
  if (fromFingerprint !== computeFingerprint(legacyTopicMigrationSql)) {
    throw new Error(
      'This database version requires recovery; its original data was retained.',
    )
  }
  const prefix = entries.slice(0, legacyTopicMigrationPaths.length)
  if (
    prefix.length !== legacyTopicMigrationPaths.length ||
    prefix.some(
      (entry, index) => entry.path !== legacyTopicMigrationPaths[index],
    ) ||
    computeFingerprint(prefix.map((entry) => entry.sql).join('\n')) !==
      computeFingerprint(legacyTopicMigrationSql)
  ) {
    throw new Error('The supported migration prefix has changed.')
  }
  return entries
    .slice(prefix.length)
    .map((entry) => entry.sql)
    .join('\n')
}
```

Pin the literal legacy fingerprint in a regression test after computing it from
the baseline checkout with `computeFingerprint`; never update that fixture just
to accept edited historical SQL. Freeze the eight original SQL strings in
`src/testing/fixtures/topics-legacy-migrations.ts` as raw imports plus a literal
expected fingerprint assertion. No binary user snapshot belongs in the repo.

- [ ] Test fingerprint selection using the exact baseline and an unknown value.
      Pass a synthetic appended migration through the optional `entries` parameter
      to test suffix selection and a failing SQL statement before Phase 2 exists;
      do not add a test migration to production migrations.
      Create a real old-schema handle using `createDb({migrationSql:
legacyTopicMigrationSql, locateWasm:createSqliteWasmLocator()})`; serialize and
      deserialize it into a second handle to exercise the real path.
- [ ] Implement `validateSnapshotSchema(handle, expectedSql)` by creating an
      empty reference handle from `expectedSql`, comparing ordered non-internal
      `sqlite_schema` entries (`type`, `name`, `tbl_name`, `sql`), and closing the
      reference in `finally`. Exclude names beginning `sqlite_`. Use the existing
      `execProxy(rawDb, sql, params, 'all')` row-returning adapter; do not interpolate
      user-controlled table identifiers. Compare values, not JSON object key order.

```ts
const schemaQuery = `SELECT type, name, tbl_name, sql FROM sqlite_schema
  WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`
const actual = await execProxy(handle.rawDb, schemaQuery, [], 'all')
const expected = await execProxy(reference.rawDb, schemaQuery, [], 'all')
if (JSON.stringify(actual.rows) !== JSON.stringify(expected.rows)) {
  throw new Error(
    'The stored database schema does not match its supported version.',
  )
}
```

- [ ] Add `assertDatabaseIntegrity(handle)` using `PRAGMA integrity_check`
      (exactly one `ok` row) and `PRAGMA foreign_key_check` (no rows). Check source
      integrity before SQL and target integrity after callback. Apply only the
      selected suffix on the isolated handle; a failure closes that handle without
      touching the old snapshot. Generated SQL may manage foreign-key pragmas, so
      do not blindly wrap it in another transaction. Domain reconciliation owns its
      transaction; publication makes the entire staged operation all-or-nothing for
      persistent storage.
- [ ] Run `rtk npx vitest run src/platform/db/snapshot-upgrade.test.ts
src/testing/db-foundation.test.ts`; expect pass for baseline, tampered schema,
      corrupt SQLite, and failed suffix cases. Assert historical SQL has not changed.
- [ ] Commit `fix(db): recognize and validate supported snapshot upgrades`.

## Task 3: Make Publication Ordering Explicit

- [ ] Create `open-snapshot.ts` and its test. Use these complete interfaces and
      orchestration; storage adapters are connected in Task 4.

```ts
import type { DbHandle } from './client'
import type { SnapshotState } from './snapshot-state'

export interface PublishContext {
  kind: 'fresh' | 'upgrade'
  fromFingerprint: string | null
}

export interface OpenSnapshotDependencies {
  currentFingerprint: string
  read(): Promise<SnapshotState>
  preserve(raw: Record<string, unknown>): Promise<void>
  fresh(): Promise<DbHandle>
  restore(bytes: Uint8Array): Promise<DbHandle>
  validate(handle: DbHandle, fingerprint: string): Promise<void>
  upgrade(handle: DbHandle, fingerprint: string): Promise<void>
  prepare(handle: DbHandle, context: PublishContext): Promise<void>
  publish(handle: DbHandle): Promise<void>
}

export async function openSnapshot(deps: OpenSnapshotDependencies) {
  const state = await deps.read()
  if (state.kind === 'invalid') {
    await deps.preserve(state.raw)
    throw new Error(`Database recovery required: ${state.reason}`)
  }
  let handle: DbHandle | undefined
  try {
    if (state.kind === 'empty') {
      handle = await deps.fresh()
      await deps.prepare(handle, { kind: 'fresh', fromFingerprint: null })
      await deps.validate(handle, deps.currentFingerprint)
      await deps.publish(handle)
      return handle
    }
    if (state.fingerprint !== deps.currentFingerprint)
      await deps.preserve(state.raw)
    handle = await deps.restore(state.bytes)
    await deps.validate(handle, state.fingerprint)
    if (state.fingerprint === deps.currentFingerprint) return handle
    await deps.upgrade(handle, state.fingerprint)
    await deps.prepare(handle, {
      kind: 'upgrade',
      fromFingerprint: state.fingerprint,
    })
    await deps.validate(handle, deps.currentFingerprint)
    await deps.publish(handle)
    return handle
  } catch (error) {
    handle?.rawDb.close()
    throw error
  }
}
```

Matching-version corrupt data remains in its active storage fields even if no
additional recovery record was needed. `restore` must close a partially created
handle itself if deserialization throws before returning it.

- [ ] Start with the failure assertion below. Provide all dependency functions
      locally as spies rather than involving Chrome or a real database in this unit
      test; real SQLite is covered in Tasks 2 and 4.

```ts
it('does not publish or return a handle when preparation fails', async () => {
  const close = vi.fn()
  const handle = { rawDb: { close } } as unknown as DbHandle
  const deps: OpenSnapshotDependencies = {
    currentFingerprint: '22222222',
    read: vi.fn().mockResolvedValue({
      kind: 'stored',
      raw: {},
      fingerprint: '11111111',
      bytes: new Uint8Array([1]),
    }),
    preserve: vi.fn().mockResolvedValue(undefined),
    fresh: vi.fn().mockResolvedValue(handle),
    restore: vi.fn().mockResolvedValue(handle),
    validate: vi.fn().mockResolvedValue(undefined),
    upgrade: vi.fn().mockResolvedValue(undefined),
    prepare: vi.fn().mockRejectedValue(new Error('alias conflict')),
    publish: vi.fn().mockResolvedValue(undefined),
  }
  await expect(openSnapshot(deps)).rejects.toThrow('alias conflict')
  expect(deps.publish).not.toHaveBeenCalled()
  expect(close).toHaveBeenCalledOnce()
})
```

- [ ] Run `rtk npx vitest run src/platform/db/open-snapshot.test.ts` red then
      green. Add an ordered event log asserting `preserve → restore → validate old
→ upgrade → prepare → validate new → publish`. Inject failure at each step;
      later steps must not run. A matching snapshot calls neither upgrade, prepare,
      nor publish. A fresh install must be persisted even before the first mutation.
- [ ] Commit `fix(db): publish upgraded snapshots only after preparation succeeds`.

## Task 4: Integrate The App Singleton And Failure Recovery

- [ ] Add the optional callback to `instance.ts`; keep it platform-owned:

```ts
export interface AppDbOptions {
  beforePublish?: (handle: DbHandle, context: PublishContext) => Promise<void>
}

export function getAppDb(options: AppDbOptions = {}) {
  if (!handlePromise) {
    handlePromise = openAppDb(options).catch((error: unknown) => {
      handlePromise = null
      throw error
    })
  }
  return handlePromise
}
```

`openAppDb(options)` constructs the dependencies from Tasks 1–3. Use Chrome
storage through a `SnapshotStorage` adapter. With no Chrome storage, use an
empty reader and no-op persistence while retaining validation. `fresh` uses
`createDb` with current SQL and `seedInitialCatalog`; `restore` creates a blank
handle and calls `deserializeDb`; `prepare` invokes the optional callback;
`publish` calls the existing `writeSnapshotToStorage` once with bytes and current
fingerprint. `validate` selects current versus recognized legacy SQL, then
checks schema and integrity. `upgrade` executes the selected SQL suffix.

- [ ] Set `activeHandle` and `setOnMutationHook(() => scheduleSnapshot())` only
      after `openSnapshot` returns. Do not call `clearSnapshot` on any startup error.
      Retain `flushDbSnapshot` serialization for later mutations. Ensure no hook
      installed by a previous test writes staged data; reset it in test setup.
- [ ] Create `instance.test.ts` using a fake Chrome storage object and real
      SQLite. Seed distinct problem/review/FSRS/track/settings rows, serialize, open,
      flush, reopen, and compare owned tables. Use existing repository fixtures
      rather than hand-constructing invalid foreign-key graphs. Add concurrent
      `getAppDb()` calls, rejected storage writes, and successful retry after
      `resetAppDbForTesting`/a reload. Assert the database is unavailable until the
      callback and publication promises resolve.

```ts
const first = getAppDb({ beforePublish })
const second = getAppDb({ beforePublish })
expect(second).toBe(first)
await expect(first).rejects.toThrow('storage unavailable')
expect(storageValues[SNAPSHOT_KEY]).toBe(originalEncodedBytes)
expect(storageValues[FINGERPRINT_KEY]).toBe(originalFingerprint)
```

The variables above belong to the integration fixture: `storageValues` is its
in-memory Chrome map, and originals are captured before invoking startup. The
mock rejects the combined active-snapshot storage write before modifying either
key. Also test interruption after the recovery copy and after successful active
publication to show the next startup selects the correct state.

- [ ] Export `AppDbOptions` from `src/platform/db/index.ts`. Remove permissive
      `readSnapshotFromStorage` from startup use; either tighten that function to
      throw on invalid state or remove it and its export if no remaining callers.
- [ ] Run `rtk npx vitest run src/platform/db/instance.test.ts
src/platform/db/open-snapshot.test.ts src/platform/db/snapshot-state.test.ts
src/platform/db/snapshot-upgrade.test.ts src/testing/db-foundation.test.ts`.
- [ ] Commit `fix(db): preserve stored data across supported startup upgrades`.

## Task 5: Recovery Instructions And Phase Gate

- [ ] Replace the reset caveat in `docs/architecture.md` with the bounded
      fingerprint compatibility and failure behavior. Document retained recovery
      keys and that automatic downgrade is unsupported. Add to `docs/testing.md`
      a developer-tool export procedure: open the extension service-worker console,
      read only `cognipace_db_snapshot_v1`, `cognipace_db_snapshot_fingerprint_v1`,
      and `cognipace_db_recovery_topics_v1`, and use DevTools `copy(JSON.stringify(...))`
      to save them locally. Do not export all Chrome storage, which includes secrets.
      The recovery data is private local data and must not be pasted into issues.
- [ ] Update existing surface error text only as needed to give the recovery
      instruction when startup rejects. Verify `ProblemLibraryScreen` still offers
      Retry; avoid claiming retry can fix a corrupt database. A startup diagnostic
      must never print raw bytes, topics, tokens, or settings.
- [ ] Run `rtk npm run db:check`, `rtk npm run lint`, `rtk npm run check`, and
      `rtk npm run build`; expect exit 0. Skip `rtk npm run db:generate` with reason
      “Phase 1 changes no schema.” Format the touched Markdown explicitly.
- [ ] Human smoke: open with valid data; verify persistence after reload;
      simulate an unsupported fingerprint and a partial storage pair in an isolated
      test profile; confirm no reseed, retained originals, export instructions, and
      successful return after restoring the original pair. Attach screenshot or
      recording proof before PR review/merge.
- [ ] Commit `docs(db): describe preserving upgrades and local recovery`.

Done when current data remains byte-recoverable on every failure and phase 2
has a tested callback point before publication. This phase alone does not add
topic relationships or advertise new Library behavior.
