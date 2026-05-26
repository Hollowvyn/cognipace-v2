import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearSyncMetadata,
  markLocalDataChanged,
  readSyncMetadata,
  writeSyncMetadata,
} from './sync-metadata-store'

const storage = new Map<string, unknown>()

beforeEach(() => {
  storage.clear()
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get(keys: string[] | string) {
          const output: Record<string, unknown> = {}
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            output[key] = storage.get(key)
          }
          return Promise.resolve(output)
        },
        set(values: Record<string, unknown>) {
          for (const [key, value] of Object.entries(values)) {
            storage.set(key, value)
          }
          return Promise.resolve()
        },
        remove(keys: string[] | string) {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            storage.delete(key)
          }
          return Promise.resolve()
        },
      },
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sync metadata store', () => {
  it('defaults to disabled clean metadata', async () => {
    await expect(readSyncMetadata()).resolves.toMatchObject({
      enabled: false,
      gistId: null,
      dirtySinceLastSync: false,
      conflict: null,
    })
  })

  it('falls back to fresh default metadata when stored metadata is invalid', async () => {
    storage.set('cognipace_sync_metadata_v1', { enabled: true })

    const firstRead = await readSyncMetadata()
    firstRead.enabled = true

    await expect(readSyncMetadata()).resolves.toMatchObject({
      enabled: false,
      gistId: null,
      dirtySinceLastSync: false,
    })
  })

  it('persists metadata patches', async () => {
    await writeSyncMetadata({
      enabled: true,
      gistId: 'gist_1',
      lastRemoteVersion: 'remote_1',
    })

    await expect(readSyncMetadata()).resolves.toMatchObject({
      enabled: true,
      gistId: 'gist_1',
      lastRemoteVersion: 'remote_1',
    })
  })

  it('marks local durable data dirty with timestamp', async () => {
    await markLocalDataChanged(new Date('2026-05-26T12:00:00.000Z'))

    await expect(readSyncMetadata()).resolves.toMatchObject({
      dirtySinceLastSync: true,
      localDataUpdatedAt: '2026-05-26T12:00:00.000Z',
    })
  })

  it('clears metadata', async () => {
    await writeSyncMetadata({ enabled: true, gistId: 'gist_1' })
    await clearSyncMetadata()

    await expect(readSyncMetadata()).resolves.toMatchObject({
      enabled: false,
      gistId: null,
    })
  })
})
