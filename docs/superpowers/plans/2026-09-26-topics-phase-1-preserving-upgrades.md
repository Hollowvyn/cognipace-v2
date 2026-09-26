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

- [ ] Add a classifier to `snapshot-state.ts` that returns `empty` only when
      neither key exists, `stored` with `{raw, fingerprint, bytes}` when both
      values are valid, and `invalid` with `{raw, reason}` for partial or
      malformed data. Every invalid result must preserve all available raw
      values for recovery and reject before database creation or publication;
      do not treat partial state as empty or overwrite active snapshot fields.
      In particular, a present snapshot without a fingerprint is invalid. Reuse
      `SNAPSHOT_KEY`, `FINGERPRINT_KEY`, and `base64ToBytes` from `snapshot.ts`.
      Write its test first, run red, then add the implementation.

Add an initial loss-case test in `snapshot-state.test.ts`, using Vitest and the
`./snapshot-state` and `./snapshot` modules.

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

Use Zod to validate the two known storage fields in a stable order.
The narrow recovery envelope retains unknown raw values so corrupt originals
can be exported. Duplicate recovery writes cannot
race because `getAppDb` coalesces opening. Do not automatically delete recovery
data after a successful upgrade.

- [ ] Add tests for recovery write rejection, retry retaining the first copy,
      and refusal to overwrite a different copy. Run the same focused command.
- [ ] Commit only these modules/tests with
      `fix(db): distinguish missing snapshots from damaged storage`.

Implemented in `src/platform/db/snapshot-state.ts`, `src/platform/db/snapshot.ts`; covered by `src/platform/db/snapshot-state.test.ts`.

## Task 2: Define The Only Supported Legacy Upgrade

- [ ] Export deterministically sorted named migration entries from
      `migration-sql.ts`; derive `migrationSql` by joining each entry's `sql`
      with `\n`, preserving the exact baseline string.

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

Implemented in `src/platform/db/snapshot-upgrade.ts`, `src/platform/db/migration-sql.ts`; covered by `src/platform/db/snapshot-upgrade.test.ts`.

## Task 3: Make Publication Ordering Explicit

- [ ] Create `open-snapshot.ts` and its test. Inject `read`, `preserve`,
      `fresh`, `restore`, `validate`, `upgrade`, `prepare`, and `publish`; keep
      storage and database adapters in Task 4. For an empty state, run
      `fresh → prepare → validate current → publish`. For a stored state,
      preserve raw storage before restoring when its fingerprint differs, then
      run `restore → validate stored`; return a matching handle without upgrade
      or publication. For an upgrade, continue with
      `upgrade → prepare → validate current → publish`. Return a fresh or
      upgraded handle only after publication succeeds.

Matching-version corrupt data remains in its active storage fields even if no
additional recovery record was needed. `restore` must close a partially created
handle itself if deserialization throws before returning it.

- [ ] Use local spy dependencies rather than Chrome or a real database in this
      unit test; real SQLite is covered in Tasks 2 and 4. If a staging operation
      fails, reject with that operation error, skip later steps and publication,
      and best-effort close any handle already returned. A close failure must not
      replace the operation error. `restore` closes a partially created handle
      itself if deserialization throws before returning it.

- [ ] Run `rtk npx vitest run src/platform/db/open-snapshot.test.ts` red then
      green. Add an ordered event log asserting `preserve → restore → validate old
→ upgrade → prepare → validate new → publish`. Inject failure at each step;
      later steps must not run. A matching snapshot calls neither upgrade, prepare,
      nor publish. A fresh install must be persisted even before the first mutation.
- [ ] Commit `fix(db): publish upgraded snapshots only after preparation succeeds`.

Implemented in `src/platform/db/open-snapshot.ts`; covered by `src/platform/db/open-snapshot.test.ts`.

## Task 4: Integrate The App Singleton And Failure Recovery

- [ ] Add the optional callback to `instance.ts` and keep it platform-owned.

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

In the integration fixture, `storageValues` is the in-memory Chrome map, and
originals are captured before invoking startup. The mock rejects the combined
active-snapshot storage write before modifying either key. Also test interruption
after the recovery copy and after successful active publication to show the next
startup selects the correct state.

- [ ] Export `AppDbOptions` from `src/platform/db/index.ts`. Remove permissive
      `readSnapshotFromStorage` from startup use; either tighten that function to
      throw on invalid state or remove it and its export if no remaining callers.
- [ ] Run `rtk npx vitest run src/platform/db/instance.test.ts
src/platform/db/open-snapshot.test.ts src/platform/db/snapshot-state.test.ts
src/platform/db/snapshot-upgrade.test.ts src/testing/db-foundation.test.ts`.
- [ ] Commit `fix(db): preserve stored data across supported startup upgrades`.

Implemented in `src/platform/db/instance.ts`, `src/extension/background/app-db.ts`; covered by `src/platform/db/instance.test.ts`, `src/extension/background/app-db.test.ts`.

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
