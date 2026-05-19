import initialMigrationSql from './migrations/0000_initial.sql?raw'

import { createDb, createSqliteWasmLocator } from './client'
import { seedInitialCatalog } from './seed'

export interface CreateTestDbOptions {
  seed?: boolean
  now?: Date
}

export async function createTestDb(options: CreateTestDbOptions = {}) {
  const handle = await createDb({
    migrationSql: initialMigrationSql,
    locateWasm: createSqliteWasmLocator(),
  })

  if (options.seed ?? true) {
    await seedInitialCatalog(handle.db, options.now)
  }

  return handle
}
