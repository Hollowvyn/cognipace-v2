import { afterEach, describe, expect, it } from 'vitest'

import { createDb, createSqliteWasmLocator } from '@/platform/db'
import { migrationEntries } from '@/platform/db/migration-sql'
import {
  assertDatabaseIntegrity,
  legacyTopicMigrationFingerprint,
  legacyTopicMigrationSql,
  selectUpgradeSql,
  validateSnapshotSchema,
} from '@/platform/db/snapshot-upgrade'
import {
  expectedLegacyMigrationFingerprint,
  frozenLegacyMigrationEntries,
} from '@/testing/fixtures/topics-legacy-migrations'
import { computeFingerprint, deserializeDb, serializeDb } from './snapshot'

const handles: Awaited<ReturnType<typeof createDb>>[] = []

async function makeDb(migrationSql?: string) {
  const handle = await createDb({
    ...(migrationSql ? { migrationSql } : {}),
    locateWasm: createSqliteWasmLocator(),
  })
  handles.push(handle)
  return handle
}

afterEach(() => {
  while (handles.length > 0) handles.pop()?.rawDb.close()
})

describe('supported topic snapshot upgrade', () => {
  it('freezes the eight historical SQL files and their baseline fingerprint', () => {
    expect(migrationEntries.slice(0, 8)).toEqual(frozenLegacyMigrationEntries)
    expect(computeFingerprint(legacyTopicMigrationSql)).toBe(
      expectedLegacyMigrationFingerprint,
    )
    expect(legacyTopicMigrationFingerprint).toBe(
      expectedLegacyMigrationFingerprint,
    )
  })

  it('accepts only the known baseline and selects only the appended suffix', () => {
    const suffix = 'CREATE TABLE appended_test (id TEXT PRIMARY KEY);'
    const entries = [
      ...frozenLegacyMigrationEntries,
      { path: './migrations/appended_test.sql', sql: suffix },
    ]

    expect(selectUpgradeSql(expectedLegacyMigrationFingerprint, entries)).toBe(
      suffix,
    )
    expect(() => selectUpgradeSql('deadbeef', entries)).toThrow(
      'This database version requires recovery; its original data was retained.',
    )
    expect(() =>
      selectUpgradeSql(expectedLegacyMigrationFingerprint, [
        { ...entries[0]!, sql: `${entries[0]!.sql}\n-- changed` },
        ...entries.slice(1),
      ]),
    ).toThrow('The supported migration prefix has changed.')
    expect(() =>
      selectUpgradeSql(expectedLegacyMigrationFingerprint, [
        entries[1]!,
        entries[0]!,
        ...entries.slice(2),
      ]),
    ).toThrow('The supported migration prefix has changed.')
  })

  it('validates schema and SQLite integrity on a real serialized snapshot', async () => {
    const old = await makeDb(legacyTopicMigrationSql)
    old.rawDb.exec(
      "INSERT INTO topics (id, label) VALUES ('topics-proof', 'Topics proof')",
    )
    assertDatabaseIntegrity(old)

    const restored = await makeDb()
    deserializeDb(restored, serializeDb(old))
    await validateSnapshotSchema(restored, legacyTopicMigrationSql)
    assertDatabaseIntegrity(restored)
    expect(
      restored.rawDb.exec({
        sql: "SELECT label FROM topics WHERE id = 'topics-proof'",
        returnValue: 'resultRows',
      }),
    ).toEqual([['Topics proof']])

    await expect(
      validateSnapshotSchema(
        restored,
        `${legacyTopicMigrationSql}\nCREATE TABLE unexpected (id TEXT)`,
      ),
    ).rejects.toThrow(
      'The stored database schema does not match its supported version.',
    )
  })

  it('rejects a stored foreign-key violation before an upgrade suffix can run', async () => {
    const corrupted = await makeDb(legacyTopicMigrationSql)
    corrupted.rawDb.exec('PRAGMA foreign_keys = OFF')
    corrupted.rawDb.exec(`
      INSERT INTO problems (slug, title, difficulty, is_premium, created_at, updated_at)
      VALUES ('orphan-child', 'Orphan child', 'easy', false, 1, 1);
      INSERT INTO track_groups (id, track_id, title, position, created_at, updated_at)
      VALUES ('orphan-group', 'missing-track', 'Orphan', 1, 1, 1);
    `)
    expect(() => assertDatabaseIntegrity(corrupted)).toThrow(
      'The stored database failed its foreign key check.',
    )
  })

  it('rejects a malformed stored schema from integrity_check', async () => {
    const corrupted = await makeDb(legacyTopicMigrationSql)
    corrupted.rawDb.exec(`
      PRAGMA writable_schema = ON;
      UPDATE sqlite_schema SET sql = 'CREATE TABLE problems (' WHERE name = 'problems';
      PRAGMA schema_version = 1000;
    `)

    expect(() => assertDatabaseIntegrity(corrupted)).toThrow(
      'The stored database failed its integrity check.',
    )
  })

  it('does not apply a failing selected suffix to the original snapshot bytes', async () => {
    const old = await makeDb(legacyTopicMigrationSql)
    old.rawDb.exec(
      "INSERT INTO topics (id, label) VALUES ('retained', 'Retained')",
    )
    const originalBytes = serializeDb(old)
    const suffix = 'CREATE TABLE broken (id TEXT); INVALID SQL;'
    const selected = selectUpgradeSql(expectedLegacyMigrationFingerprint, [
      ...frozenLegacyMigrationEntries,
      { path: './migrations/failing_test.sql', sql: suffix },
    ])
    const staged = await makeDb()
    deserializeDb(staged, originalBytes)

    expect(() => staged.rawDb.exec(selected)).toThrow()
    expect(serializeDb(old)).toEqual(originalBytes)
    expect(
      old.rawDb.exec({
        sql: "SELECT id FROM topics WHERE id = 'retained'",
        returnValue: 'resultRows',
      }),
    ).toEqual([['retained']])
  })
})
