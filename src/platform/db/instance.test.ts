import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// This platform integration test uses feature repositories to seed valid owned-row graphs.
// eslint-disable-next-line no-restricted-imports
import { saveReviewResult } from '@/features/practice/server/practice-service'
// eslint-disable-next-line no-restricted-imports
import { createSettingsRepository } from '@/features/settings/data/settings-repository'
import { getAppDb, flushDbSnapshot, resetAppDbForTesting } from './instance'
import { migrationSql } from './migration-sql'
import { RECOVERY_KEY } from './snapshot-state'
import { FINGERPRINT_KEY, SNAPSHOT_KEY, computeFingerprint } from './snapshot'

const now = new Date('2026-09-26T12:00:00.000Z')
const openedHandles: Awaited<ReturnType<typeof getAppDb>>[] = []

class FakeStorage {
  readonly values: Record<string, unknown> = {}
  rejectActiveSnapshotWrite = false

  get = vi.fn((keys: string[]) =>
    Promise.resolve(
      Object.fromEntries(
        keys
          .filter((key) => key in this.values)
          .map((key) => [key, this.values[key]]),
      ),
    ),
  )

  set = vi.fn((values: Record<string, unknown>) => {
    if (
      this.rejectActiveSnapshotWrite &&
      SNAPSHOT_KEY in values &&
      FINGERPRINT_KEY in values
    ) {
      return Promise.reject(new Error('storage unavailable'))
    }
    Object.assign(this.values, values)
    return Promise.resolve()
  })

  remove = vi.fn((keys: string[]) => {
    for (const key of keys) delete this.values[key]
    return Promise.resolve()
  })
}

beforeEach(() => {
  resetAppDbForTesting()
})

afterEach(() => {
  resetAppDbForTesting()
  while (openedHandles.length > 0) openedHandles.pop()?.rawDb.close()
  vi.unstubAllGlobals()
})

async function openTestDb() {
  const handle = await getAppDb()
  openedHandles.push(handle)
  return handle
}

function installStorage() {
  const storage = new FakeStorage()
  vi.stubGlobal('chrome', { storage: { local: storage } })
  return storage
}

function readRows(db: Awaited<ReturnType<typeof getAppDb>>, table: string) {
  return db.rawDb.exec({
    sql: `SELECT * FROM "${table}" ORDER BY rowid`,
    returnValue: 'resultRows',
  })
}

function readOwnedRows(db: Awaited<ReturnType<typeof getAppDb>>) {
  return Object.fromEntries(
    [
      'problems',
      'problem_practice',
      'fsrs_cards',
      'review_attempts',
      'tracks',
      'track_groups',
      'track_group_problems',
      'track_session',
      'settings_kv',
    ].map((table) => [table, readRows(db, table)]),
  )
}

describe('app database startup', () => {
  it('round-trips seeded problem, review, FSRS, track, and settings data', async () => {
    installStorage()
    const handle = await openTestDb()
    await saveReviewResult(handle.db, {
      problemSlug: 'two-sum',
      rating: 'good',
      reviewedAt: now,
      isCorrect: true,
      targetRetention: 0.9,
    })
    await createSettingsRepository(handle.db).updateSettings(
      { appearance: { themeMode: 'dark' } },
      now,
    )
    await flushDbSnapshot()
    const expected = readOwnedRows(handle)
    expect(expected.problems).not.toHaveLength(0)
    expect(expected.review_attempts).not.toHaveLength(0)
    expect(expected.fsrs_cards).not.toHaveLength(0)
    expect(expected.tracks).not.toHaveLength(0)
    expect(expected.settings_kv).not.toHaveLength(0)

    resetAppDbForTesting()
    const reopened = await openTestDb()

    expect(readOwnedRows(reopened)).toEqual(expected)
  })

  it('returns one in-flight open promise to concurrent callers', async () => {
    installStorage()
    const first = getAppDb()
    const second = getAppDb()

    expect(second).toBe(first)
    const handle = await first
    openedHandles.push(handle)
  })

  it('boots and validates a fresh database without Chrome storage', async () => {
    vi.stubGlobal('chrome', undefined)

    const handle = await openTestDb()
    expect(
      handle.rawDb.exec({
        sql: 'PRAGMA integrity_check',
        returnValue: 'resultRows',
      }),
    ).toEqual([['ok']])
    expect(
      handle.rawDb.exec({
        sql: 'SELECT COUNT(*) FROM problems',
        returnValue: 'resultRows',
      }),
    ).toEqual([[101]])
    await expect(flushDbSnapshot()).resolves.toBeUndefined()
  })

  it('keeps the database unavailable until preparation and active publication resolve', async () => {
    const fakeStorage = installStorage()
    let releasePreparation!: () => void
    let enteredPreparation!: () => void
    const preparationEntered = new Promise<void>((resolve) => {
      enteredPreparation = resolve
    })
    const preparationGate = new Promise<void>((resolve) => {
      releasePreparation = resolve
    })
    let releasePublication!: () => void
    let enteredPublication!: () => void
    const publicationEntered = new Promise<void>((resolve) => {
      enteredPublication = resolve
    })
    const publicationGate = new Promise<void>((resolve) => {
      releasePublication = resolve
    })
    const originalSet = fakeStorage.set
    fakeStorage.set = vi.fn(async (values) => {
      if (SNAPSHOT_KEY in values && FINGERPRINT_KEY in values) {
        enteredPublication()
        await publicationGate
      }
      await originalSet(values)
    })

    let resolved = false
    const opening = getAppDb({
      beforePublish: async () => {
        enteredPreparation()
        await preparationGate
      },
    }).then((handle) => {
      openedHandles.push(handle)
      resolved = true
      return handle
    })

    await preparationEntered
    expect(resolved).toBe(false)
    releasePreparation()
    await publicationEntered
    expect(resolved).toBe(false)
    releasePublication()
    await expect(opening).resolves.toBeDefined()
  })

  it('clears a failed fresh open so callers can retry without a stale hook', async () => {
    const fakeStorage = installStorage()
    fakeStorage.values['unrelated-local-setting'] = 'keep me'
    fakeStorage.rejectActiveSnapshotWrite = true
    const opening = getAppDb()

    await expect(opening).rejects.toThrow('storage unavailable')
    expect(fakeStorage.values[SNAPSHOT_KEY]).toBeUndefined()
    expect(fakeStorage.values[FINGERPRINT_KEY]).toBeUndefined()
    expect(fakeStorage.values['unrelated-local-setting']).toBe('keep me')

    fakeStorage.rejectActiveSnapshotWrite = false
    const retried = openTestDb()
    await expect(retried).resolves.toBeDefined()
    expect(fakeStorage.values[SNAPSHOT_KEY]).toEqual(expect.any(String))
    expect(fakeStorage.values[FINGERPRINT_KEY]).toEqual(
      computeFingerprint(migrationSql),
    )
  })

  it('discards an open made stale by reset without replacing the new handle or snapshot', async () => {
    const fakeStorage = installStorage()
    let releaseOldPreparation!: () => void
    let enterOldPreparation!: () => void
    const oldPreparationEntered = new Promise<void>((resolve) => {
      enterOldPreparation = resolve
    })
    const oldPreparationGate = new Promise<void>((resolve) => {
      releaseOldPreparation = resolve
    })
    let staleHandle: Awaited<ReturnType<typeof getAppDb>> | undefined
    const staleOpen = getAppDb({
      beforePublish: async (handle) => {
        staleHandle = handle
        enterOldPreparation()
        await oldPreparationGate
      },
    })

    await oldPreparationEntered
    resetAppDbForTesting()
    const currentHandle = await openTestDb()
    await createSettingsRepository(currentHandle.db).updateSettings(
      { appearance: { themeMode: 'dark' } },
      now,
    )
    await flushDbSnapshot()
    const currentSnapshot = fakeStorage.values[SNAPSHOT_KEY]
    const currentFingerprint = fakeStorage.values[FINGERPRINT_KEY]

    releaseOldPreparation()
    await expect(staleOpen).rejects.toThrow('reset')
    expect(staleHandle).toBeDefined()
    expect(() => staleHandle?.rawDb.exec('SELECT 1')).toThrow()
    expect(await getAppDb()).toBe(currentHandle)
    expect(fakeStorage.values[SNAPSHOT_KEY]).toBe(currentSnapshot)
    expect(fakeStorage.values[FINGERPRINT_KEY]).toBe(currentFingerprint)

    resetAppDbForTesting()
    const reloaded = await openTestDb()
    await expect(
      createSettingsRepository(reloaded.db).getSettings(),
    ).resolves.toMatchObject({
      appearance: { themeMode: 'dark' },
    })
  })

  it('serializes startup snapshot writes across reset so stale publication cannot win', async () => {
    const fakeStorage = installStorage()
    let releaseFirstPairWrite!: () => void
    let enterFirstPairWrite!: () => void
    const firstPairWriteEntered = new Promise<void>((resolve) => {
      enterFirstPairWrite = resolve
    })
    const firstPairWriteGate = new Promise<void>((resolve) => {
      releaseFirstPairWrite = resolve
    })
    let enterLaterPairWrite!: () => void
    const laterPairWriteStarted = new Promise<void>((resolve) => {
      enterLaterPairWrite = resolve
    })
    const writeEvents: string[] = []
    const originalSet = fakeStorage.set
    let pairWriteCount = 0
    fakeStorage.set = vi.fn(async (values) => {
      let pairWriteNumber: number | undefined
      if (SNAPSHOT_KEY in values && FINGERPRINT_KEY in values) {
        pairWriteCount += 1
        pairWriteNumber = pairWriteCount
        if (pairWriteNumber === 1) {
          writeEvents.push('old-write-start')
          enterFirstPairWrite()
          await firstPairWriteGate
        } else {
          writeEvents.push('new-write-start')
          enterLaterPairWrite()
        }
      }
      await originalSet(values)
      if (pairWriteNumber !== undefined) {
        writeEvents.push(
          pairWriteNumber === 1 ? 'old-write-end' : 'new-write-end',
        )
      }
    })

    const staleOpen = getAppDb()
    await firstPairWriteEntered
    resetAppDbForTesting()

    let newPreparationFinished!: () => void
    const newPreparation = new Promise<void>((resolve) => {
      newPreparationFinished = resolve
    })
    const currentOpen = getAppDb({
      beforePublish: async (handle) => {
        await createSettingsRepository(handle.db).updateSettings(
          { appearance: { themeMode: 'dark' } },
          now,
        )
        newPreparationFinished()
      },
    })
    await newPreparation
    releaseFirstPairWrite()
    const [staleResult, currentResult] = await Promise.allSettled([
      staleOpen,
      currentOpen,
    ])
    await laterPairWriteStarted
    expect(writeEvents).toEqual([
      'old-write-start',
      'old-write-end',
      'new-write-start',
      'new-write-end',
    ])
    expect(staleResult.status).toBe('rejected')
    expect(currentResult.status).toBe('fulfilled')
    if (currentResult.status !== 'fulfilled') return
    openedHandles.push(currentResult.value)

    const currentSnapshot = fakeStorage.values[SNAPSHOT_KEY]
    const currentFingerprint = fakeStorage.values[FINGERPRINT_KEY]
    expect(currentFingerprint).toBe(computeFingerprint(migrationSql))

    resetAppDbForTesting()
    const reloaded = await openTestDb()
    await expect(
      createSettingsRepository(reloaded.db).getSettings(),
    ).resolves.toMatchObject({
      appearance: { themeMode: 'dark' },
    })
    expect(fakeStorage.values[SNAPSHOT_KEY]).toBe(currentSnapshot)
    expect(fakeStorage.values[FINGERPRINT_KEY]).toBe(currentFingerprint)
  })

  it('retains a recovery copy after restarting from partial snapshot state', async () => {
    const fakeStorage = installStorage()
    fakeStorage.values[SNAPSHOT_KEY] = 'partial-snapshot'

    await expect(getAppDb()).rejects.toThrow('Database recovery required')
    const recoveryCopy = fakeStorage.values[RECOVERY_KEY]
    expect(recoveryCopy).toMatchObject({
      version: 1,
      raw: { [SNAPSHOT_KEY]: 'partial-snapshot' },
    })

    resetAppDbForTesting()
    await expect(getAppDb()).rejects.toThrow('Database recovery required')
    expect(fakeStorage.values[RECOVERY_KEY]).toEqual(recoveryCopy)
    expect(fakeStorage.values[SNAPSHOT_KEY]).toBe('partial-snapshot')
    expect(fakeStorage.values[FINGERPRINT_KEY]).toBeUndefined()
  })

  it('preserves a valid stored snapshot when a mutation flush write fails', async () => {
    const fakeStorage = installStorage()
    const firstHandle = await openTestDb()
    const settings = createSettingsRepository(firstHandle.db)
    await settings.updateSettings({ appearance: { themeMode: 'dark' } }, now)
    await flushDbSnapshot()
    const originalSnapshot = fakeStorage.values[SNAPSHOT_KEY]
    const originalFingerprint = fakeStorage.values[FINGERPRINT_KEY]

    fakeStorage.rejectActiveSnapshotWrite = true
    await settings.updateSettings(
      { appearance: { themeMode: 'light' } },
      new Date(now.getTime() + 1_000),
    )
    await expect(flushDbSnapshot()).rejects.toThrow('storage unavailable')
    expect(fakeStorage.values[SNAPSHOT_KEY]).toBe(originalSnapshot)
    expect(fakeStorage.values[FINGERPRINT_KEY]).toBe(originalFingerprint)

    fakeStorage.rejectActiveSnapshotWrite = false
    await flushDbSnapshot()
    const retriedSnapshot = fakeStorage.values[SNAPSHOT_KEY]
    expect(retriedSnapshot).not.toBe(originalSnapshot)
    expect(fakeStorage.values[FINGERPRINT_KEY]).toBe(originalFingerprint)

    resetAppDbForTesting()
    const reopened = await openTestDb()
    await expect(
      createSettingsRepository(reopened.db).getSettings(),
    ).resolves.toMatchObject({
      appearance: { themeMode: 'light' },
    })
    expect(fakeStorage.values[SNAPSHOT_KEY]).toBe(retriedSnapshot)
    expect(fakeStorage.values[FINGERPRINT_KEY]).toBe(originalFingerprint)
  })
})
