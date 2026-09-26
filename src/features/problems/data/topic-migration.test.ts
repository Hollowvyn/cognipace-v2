import { afterEach, describe, expect, it } from 'vitest'

import { createDb, createSqliteWasmLocator } from '@/platform/db'
import { migrationEntries } from '@/platform/db/migration-sql'
import { legacyTopicMigrationSql } from '@/platform/db/snapshot-upgrade'

const handles: Awaited<ReturnType<typeof createDb>>[] = []

afterEach(() => {
  while (handles.length > 0) handles.pop()?.rawDb.close()
})

describe('typed topic relation migration', () => {
  it('converts the historical child-parent relation and preserves timestamps', async () => {
    const handle = await createDb({
      migrationSql: legacyTopicMigrationSql,
      locateWasm: createSqliteWasmLocator(),
    })
    handles.push(handle)
    handle.rawDb.exec(`
      INSERT INTO topics (id, label, created_at, updated_at)
      VALUES ('tree', 'Tree', 0, 0), ('binary-tree', 'Binary Tree', 0, 0);
      INSERT INTO topic_relations
        (parent_topic_id, child_topic_id, created_at, updated_at)
      VALUES ('tree', 'binary-tree', 1, 2);
    `)

    const migration = migrationEntries.find(({ path }) =>
      path.endsWith('/0008_topics_typed_relations.sql'),
    )
    expect(
      migration,
      '0008 typed topic relation migration exists',
    ).toBeDefined()
    handle.rawDb.exec(migration!.sql)

    const rows = handle.rawDb.exec({
      sql: 'SELECT source_topic_id, target_topic_id, kind, created_at, updated_at FROM topic_relations',
      returnValue: 'resultRows',
    })
    expect(rows).toEqual([['binary-tree', 'tree', 'broader', 1, 2]])

    handle.rawDb.exec(`
      INSERT INTO topic_relations
        (source_topic_id, target_topic_id, kind, created_at, updated_at)
      VALUES ('binary-tree', 'tree', 'applies-to', 3, 4);
    `)
    expect(() =>
      handle.rawDb.exec(`
      INSERT INTO topic_relations
        (source_topic_id, target_topic_id, kind, created_at, updated_at)
      VALUES ('binary-tree', 'tree', 'broader', 5, 6);
    `),
    ).toThrow()
    expect(() =>
      handle.rawDb.exec(`
      INSERT INTO topic_relations
        (source_topic_id, target_topic_id, kind, created_at, updated_at)
      VALUES ('tree', 'tree', 'broader', 5, 6);
    `),
    ).toThrow()
  })
})
