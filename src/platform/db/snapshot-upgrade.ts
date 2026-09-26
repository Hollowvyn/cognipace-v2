import { createDb, createSqliteWasmLocator, type DbHandle } from './client'
import { migrationEntries } from './migration-sql'
import { execProxy } from './proxy'
import { computeFingerprint } from './snapshot'

export const legacyTopicMigrationPaths = [
  './migrations/0000_initial.sql',
  './migrations/0001_lively_namor.sql',
  './migrations/0002_add_track_due_at.sql',
  './migrations/0003_problem_slugs_and_constraints.sql',
  './migrations/0004_tracks_phase_3.sql',
  './migrations/0005_concerned_jubilee.sql',
  './migrations/0006_polite_vindicator.sql',
  './migrations/0007_track_simple_recall.sql',
] as const

const legacyEntries = legacyTopicMigrationPaths.map((path) => {
  const entry = migrationEntries.find((candidate) => candidate.path === path)
  if (!entry) throw new Error(`Missing supported legacy migration: ${path}`)
  return entry
})

export const legacyTopicMigrationSql = legacyEntries
  .map((entry) => entry.sql)
  .join('\n')
export const legacyTopicMigrationFingerprint = computeFingerprint(
  legacyTopicMigrationSql,
)

const schemaQuery = `SELECT type, name, tbl_name, sql FROM sqlite_schema
  WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`

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

export async function validateSnapshotSchema(
  handle: DbHandle,
  expectedSql: string,
) {
  const reference = await createDb({
    migrationSql: expectedSql,
    locateWasm: createSqliteWasmLocator(),
  })

  try {
    const actual = execProxy(handle.rawDb, schemaQuery, [], 'all')
    const expected = execProxy(reference.rawDb, schemaQuery, [], 'all')
    if (JSON.stringify(actual.rows) !== JSON.stringify(expected.rows)) {
      throw new Error(
        'The stored database schema does not match its supported version.',
      )
    }
  } finally {
    reference.rawDb.close()
  }
}

export function assertDatabaseIntegrity(handle: DbHandle) {
  const integrity = execProxy(handle.rawDb, 'PRAGMA integrity_check', [], 'all')
  const integrityRows = integrity.rows as unknown as unknown[][]
  if (integrityRows.length !== 1 || integrityRows[0]?.[0] !== 'ok') {
    throw new Error('The stored database failed its integrity check.')
  }

  const foreignKeys = execProxy(
    handle.rawDb,
    'PRAGMA foreign_key_check',
    [],
    'all',
  )
  if ((foreignKeys.rows as unknown as unknown[][]).length > 0) {
    throw new Error('The stored database failed its foreign key check.')
  }
}
