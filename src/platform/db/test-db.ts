import { createDb, createSqliteWasmLocator } from './client'
import { migrationSql } from './migration-sql'
import { seedInitialCatalog } from './seed'

export interface CreateTestDbOptions {
  seed?: boolean
  now?: Date
}

export async function createTestDb(options: CreateTestDbOptions = {}) {
  const handle = await createDb({
    migrationSql,
    locateWasm: createSqliteWasmLocator(),
  })

  if (options.seed ?? true) {
    await seedInitialCatalog(handle.db, options.now)
  }

  return handle
}
