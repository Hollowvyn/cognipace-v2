import { createDb, createSqliteWasmLocator, type DbHandle } from './client'
import { migrationSql } from './migration-sql'
import { setOnMutationHook } from './proxy'
import { seedInitialCatalog } from './seed'
import {
  clearSnapshot,
  computeFingerprint,
  deserializeDb,
  readSnapshotFromStorage,
  serializeDb,
  writeSnapshotToStorage,
} from './snapshot'

const snapshotDebounceMs = 250

let handlePromise: Promise<DbHandle> | null = null
let activeHandle: DbHandle | null = null
let snapshotTimer: ReturnType<typeof setTimeout> | null = null
let snapshotWritePromise: Promise<void> | null = null

export function getAppDb() {
  handlePromise ??= openAppDb()
  return handlePromise
}

export async function flushDbSnapshot() {
  if (snapshotTimer) {
    clearTimeout(snapshotTimer)
    snapshotTimer = null
  }

  await writeSnapshotAfterPending()
}

export function resetAppDbForTesting() {
  setOnMutationHook(null)
  handlePromise = null
  activeHandle = null

  if (snapshotTimer) {
    clearTimeout(snapshotTimer)
    snapshotTimer = null
  }

  snapshotWritePromise = null
}

async function openAppDb() {
  const fingerprint = computeFingerprint(migrationSql)
  const storedSnapshot = canUseChromeStorage()
    ? await readSnapshotFromStorage()
    : null

  if (storedSnapshot && storedSnapshot.fingerprint === fingerprint) {
    const restoredHandle = await createDb({
      locateWasm: createSqliteWasmLocator(),
    })
    deserializeDb(restoredHandle, storedSnapshot.bytes)
    activeHandle = restoredHandle
    setOnMutationHook(() => scheduleSnapshot())
    return restoredHandle
  }

  if (storedSnapshot && storedSnapshot.fingerprint !== fingerprint) {
    await clearSnapshot()
  }

  const freshHandle = await createDb({
    migrationSql,
    locateWasm: createSqliteWasmLocator(),
  })
  await seedInitialCatalog(freshHandle.db)
  activeHandle = freshHandle
  setOnMutationHook(() => scheduleSnapshot())
  return freshHandle
}

function scheduleSnapshot() {
  if (!canUseChromeStorage()) {
    return
  }

  if (snapshotTimer) {
    clearTimeout(snapshotTimer)
  }

  snapshotTimer = setTimeout(() => {
    snapshotTimer = null
    void writeSnapshotAfterPending()
  }, snapshotDebounceMs)
}

async function writeSnapshotAfterPending() {
  if (snapshotWritePromise) {
    await snapshotWritePromise
  }

  const writePromise = persistSnapshot()
  snapshotWritePromise = writePromise

  try {
    await writePromise
  } finally {
    if (snapshotWritePromise === writePromise) {
      snapshotWritePromise = null
    }
  }
}

async function persistSnapshot() {
  if (!activeHandle || !canUseChromeStorage()) {
    return
  }

  await writeSnapshotToStorage({
    fingerprint: computeFingerprint(migrationSql),
    bytes: serializeDb(activeHandle),
  })
}

function canUseChromeStorage() {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.storage !== 'undefined' &&
    typeof chrome.storage.local !== 'undefined'
  )
}
