import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SyncActionResult } from '@/features/sync/api/sync-contracts'
import {
  defaultSyncMetadata,
  type SyncMetadata,
} from '@/features/sync/data/sync-metadata-store'

import type { AlarmScheduler } from './scheduler/alarm-scheduler'
import {
  createSyncAutoSync,
  syncAutoPushAlarmName,
  syncAutoPushDelayMinutes,
  syncOpenCheckAlarmName,
  syncOpenCheckDelayMs,
  syncOpenCheckFallbackDelayMinutes,
  syncPollAlarmName,
  syncPollPeriodMinutes,
  syncRetryAlarmName,
  type SyncAutoSyncDependencies,
} from './sync-auto-sync'

describe('sync auto-sync orchestrator', () => {
  let deps: SyncAutoSyncDependencies
  let metadata: SyncMetadata

  beforeEach(() => {
    metadata = createMetadata()
    deps = createDeps({
      readMetadata: vi.fn(() => Promise.resolve(metadata)),
      writeMetadata: vi.fn((patch: Partial<SyncMetadata>) => {
        metadata = { ...metadata, ...patch }

        return Promise.resolve(metadata)
      }),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('schedules auto-push after a local mutation when sync is configured', async () => {
    const syncAutoSync = createSyncAutoSync(deps)

    await syncAutoSync.scheduleAutoPushAfterMutation()

    expect(deps.scheduler.schedule).toHaveBeenCalledWith(
      syncAutoPushAlarmName,
      {
        delayInMinutes: syncAutoPushDelayMinutes,
      },
    )
  })

  it('does not schedule auto-push when sync is disabled or missing a gist', async () => {
    const syncAutoSync = createSyncAutoSync(deps)
    metadata = createMetadata({ enabled: false })

    await syncAutoSync.scheduleAutoPushAfterMutation()

    metadata = createMetadata({ gistId: null })
    await syncAutoSync.scheduleAutoPushAfterMutation()

    expect(deps.scheduler.schedule).not.toHaveBeenCalled()
  })

  it('runs safe auto-push for dirty configured metadata and resets retry state after success', async () => {
    const syncAutoSync = createSyncAutoSync(deps)
    metadata = createMetadata({
      autoSyncRetryAttempt: 2,
      dirtySinceLastSync: true,
    })

    await syncAutoSync.runAutoPush()

    expect(deps.runSafePush).toHaveBeenCalledWith({
      confirmRemoteOverwrite: false,
    })
    expect(deps.writeMetadata).toHaveBeenCalledWith({
      autoSyncRetryAttempt: 0,
      lastAutoSyncAt: '2026-05-31T12:00:00.000Z',
    })
    expect(deps.scheduler.clear).toHaveBeenCalledWith(syncRetryAlarmName)
  })

  it('skips auto-push when sync is not configured or local data is clean', async () => {
    const syncAutoSync = createSyncAutoSync(deps)

    await syncAutoSync.runAutoPush()

    metadata = createMetadata({ dirtySinceLastSync: true, gistId: null })
    await syncAutoSync.runAutoPush()

    expect(deps.runSafePush).not.toHaveBeenCalled()
  })

  it('runs auto-push for clean metadata when dirty metadata has a pending retry', async () => {
    const syncAutoSync = createSyncAutoSync({
      ...deps,
      hasPendingDirtyMarkRetry: () => true,
    })

    await syncAutoSync.runAutoPush()

    expect(deps.runSafePush).toHaveBeenCalledWith({
      confirmRemoteOverwrite: false,
    })
  })

  it('stops automatic push retries when the remote changed or confirmation is required', async () => {
    const syncAutoSync = createSyncAutoSync(deps)
    metadata = createMetadata({ dirtySinceLastSync: true })
    vi.mocked(deps.runSafePush).mockResolvedValueOnce(
      createActionResult({
        outcome: 'confirmation-required',
        reason: 'remote-changed',
      }),
    )

    await syncAutoSync.runAutoPush()

    expect(deps.scheduler.clear).toHaveBeenCalledWith(syncAutoPushAlarmName)
    expect(deps.scheduler.clear).toHaveBeenCalledWith(syncRetryAlarmName)
    expect(deps.writeMetadata).not.toHaveBeenCalled()
  })

  it('increments retry attempt and schedules backoff after retryable auto-push errors', async () => {
    const syncAutoSync = createSyncAutoSync(deps)
    metadata = createMetadata({
      autoSyncRetryAttempt: 1,
      dirtySinceLastSync: true,
    })
    vi.mocked(deps.runSafePush).mockResolvedValueOnce(
      createActionResult({
        outcome: 'error',
        reason: 'network',
        retryable: true,
      }),
    )

    await syncAutoSync.runAutoPush()

    expect(deps.writeMetadata).toHaveBeenCalledWith({
      autoSyncRetryAttempt: 2,
      lastAutoSyncAt: '2026-05-31T12:00:00.000Z',
    })
    expect(deps.scheduler.schedule).toHaveBeenCalledWith(syncRetryAlarmName, {
      delayInMinutes: 5,
    })
  })

  it('schedules retry when safe auto-push throws before returning an action result', async () => {
    const syncAutoSync = createSyncAutoSync(deps)
    metadata = createMetadata({
      autoSyncRetryAttempt: 0,
      dirtySinceLastSync: true,
    })
    vi.mocked(deps.runSafePush).mockRejectedValueOnce(
      new Error('Local data changed but sync metadata could not be saved.'),
    )

    await syncAutoSync.runAutoPush()

    expect(deps.writeMetadata).toHaveBeenCalledWith({
      autoSyncRetryAttempt: 1,
      lastAutoSyncAt: '2026-05-31T12:00:00.000Z',
    })
    expect(deps.scheduler.schedule).toHaveBeenCalledWith(syncRetryAlarmName, {
      delayInMinutes: 1,
    })
  })

  it('clears retry alarm after nonretryable auto-push errors', async () => {
    const syncAutoSync = createSyncAutoSync(deps)
    metadata = createMetadata({ dirtySinceLastSync: true })
    vi.mocked(deps.runSafePush).mockResolvedValueOnce(
      createActionResult({
        outcome: 'error',
        reason: 'auth',
        retryable: false,
      }),
    )

    await syncAutoSync.runAutoPush()

    expect(deps.scheduler.clear).toHaveBeenCalledWith(syncRetryAlarmName)
    expect(deps.scheduler.schedule).not.toHaveBeenCalled()
  })

  it('runs clean pull checks only when sync is configured and local data is clean', async () => {
    const syncAutoSync = createSyncAutoSync(deps)

    await syncAutoSync.runCleanPullCheck()

    metadata = createMetadata({ dirtySinceLastSync: true })
    await syncAutoSync.runCleanPullCheck()

    expect(deps.runCleanPullCheck).toHaveBeenCalledTimes(1)
  })

  it('resets retry state after a successful automatic pull', async () => {
    const syncAutoSync = createSyncAutoSync(deps)
    metadata = createMetadata({ autoSyncRetryAttempt: 3 })
    vi.mocked(deps.runCleanPullCheck).mockResolvedValueOnce(
      createActionResult({
        direction: 'pull',
        outcome: 'success',
      }),
    )

    await syncAutoSync.runCleanPullCheck()

    expect(deps.writeMetadata).toHaveBeenCalledWith({
      autoSyncRetryAttempt: 0,
      lastAutoSyncAt: '2026-05-31T12:00:00.000Z',
    })
    expect(deps.scheduler.clear).toHaveBeenCalledWith(syncRetryAlarmName)
  })

  it('registers the requested open-check fallback job', () => {
    const syncAutoSync = createSyncAutoSync(deps)

    syncAutoSync.registerJobs()

    expect(deps.scheduler.register).toHaveBeenCalledWith({
      name: syncOpenCheckAlarmName,
      run: syncAutoSync.runRequestedOpenCheck,
    })
  })

  it('coalesces repeated surface-open check requests behind one timer and fallback alarm', async () => {
    vi.useFakeTimers()
    const syncAutoSync = createSyncAutoSync(deps)

    await syncAutoSync.requestOpenCheckAfterSurfaceOpen()
    await syncAutoSync.requestOpenCheckAfterSurfaceOpen()

    expect(deps.scheduler.schedule).toHaveBeenCalledTimes(1)
    expect(deps.scheduler.schedule).toHaveBeenCalledWith(
      syncOpenCheckAlarmName,
      {
        delayInMinutes: syncOpenCheckFallbackDelayMinutes,
      },
    )

    await vi.advanceTimersByTimeAsync(syncOpenCheckDelayMs)

    expect(deps.runCleanPullCheck).toHaveBeenCalledTimes(1)
  })

  it('does not wedge requested open checks when fallback scheduling fails', async () => {
    vi.useFakeTimers()
    const scheduleError = new Error('Alarms unavailable.')
    vi.mocked(deps.scheduler.schedule).mockRejectedValueOnce(scheduleError)
    const syncAutoSync = createSyncAutoSync(deps)

    await expect(
      syncAutoSync.requestOpenCheckAfterSurfaceOpen(),
    ).rejects.toThrow(scheduleError)

    expect(deps.scheduler.schedule).toHaveBeenCalledTimes(1)

    vi.mocked(deps.scheduler.schedule).mockResolvedValueOnce(undefined)

    await syncAutoSync.requestOpenCheckAfterSurfaceOpen()

    expect(deps.scheduler.schedule).toHaveBeenCalledTimes(2)
    expect(deps.scheduler.schedule).toHaveBeenLastCalledWith(
      syncOpenCheckAlarmName,
      {
        delayInMinutes: syncOpenCheckFallbackDelayMinutes,
      },
    )

    await vi.advanceTimersByTimeAsync(syncOpenCheckDelayMs)

    expect(deps.runCleanPullCheck).toHaveBeenCalledTimes(1)
  })

  it('runs requested open checks through the existing clean pull path and clears the fallback alarm', async () => {
    const syncAutoSync = createSyncAutoSync(deps)

    await syncAutoSync.requestOpenCheckAfterSurfaceOpen()
    await syncAutoSync.runRequestedOpenCheck()

    expect(deps.runCleanPullCheck).toHaveBeenCalledTimes(1)
    expect(deps.scheduler.clear).toHaveBeenCalledWith(syncOpenCheckAlarmName)
  })

  it('keeps requested open checks coalesced while a clean pull is in flight', async () => {
    vi.useFakeTimers()
    const pullCheck = createDeferred<SyncActionResult>()
    vi.mocked(deps.runCleanPullCheck).mockReturnValueOnce(pullCheck.promise)
    const syncAutoSync = createSyncAutoSync(deps)

    await syncAutoSync.requestOpenCheckAfterSurfaceOpen()
    const runningOpenCheck = syncAutoSync.runRequestedOpenCheck()
    await flushMicrotasks()

    expect(deps.runCleanPullCheck).toHaveBeenCalledTimes(1)

    await syncAutoSync.requestOpenCheckAfterSurfaceOpen()

    expect(deps.scheduler.schedule).toHaveBeenCalledTimes(1)
    expect(deps.runCleanPullCheck).toHaveBeenCalledTimes(1)

    pullCheck.resolve(
      createActionResult({
        direction: 'pull',
        outcome: 'success',
      }),
    )
    await runningOpenCheck

    expect(deps.scheduler.clear).toHaveBeenCalledWith(syncOpenCheckAlarmName)
  })

  it('registers push, retry, poll, and open-check jobs with startup poll repair settings', () => {
    const syncAutoSync = createSyncAutoSync(deps)

    syncAutoSync.registerJobs()

    expect(deps.scheduler.register).toHaveBeenCalledWith({
      name: syncAutoPushAlarmName,
      run: syncAutoSync.runAutoPush,
    })
    expect(deps.scheduler.register).toHaveBeenCalledWith({
      name: syncRetryAlarmName,
      run: syncAutoSync.runAutoPush,
    })
    expect(deps.scheduler.register).toHaveBeenCalledWith({
      name: syncPollAlarmName,
      run: syncAutoSync.runCleanPullCheck,
      startup: {
        delayInMinutes: syncPollPeriodMinutes,
        periodInMinutes: syncPollPeriodMinutes,
      },
    })
  })

  it('repairs startup alarms and clears pending automatic sync alarms through the scheduler', async () => {
    const syncAutoSync = createSyncAutoSync(deps)

    await syncAutoSync.repairStartupAlarms()
    await syncAutoSync.clearPendingAutomaticSync()

    expect(deps.scheduler.repairStartupAlarms).toHaveBeenCalledTimes(1)
    expect(deps.writeMetadata).toHaveBeenCalledWith({
      autoSyncRetryAttempt: 0,
      lastAutoSyncAt: '2026-05-31T12:00:00.000Z',
    })
    expect(deps.scheduler.clear).toHaveBeenCalledWith(syncAutoPushAlarmName)
    expect(deps.scheduler.clear).toHaveBeenCalledWith(syncRetryAlarmName)
  })
})

type SchedulerDependency = Pick<
  AlarmScheduler,
  'clear' | 'register' | 'repairStartupAlarms' | 'schedule'
>

function createDeps(
  overrides: Partial<SyncAutoSyncDependencies> = {},
): SyncAutoSyncDependencies {
  return {
    now: () => new Date('2026-05-31T12:00:00.000Z'),
    readMetadata: vi.fn(() => Promise.resolve(createMetadata())),
    writeMetadata: vi.fn((patch: Partial<SyncMetadata>) =>
      Promise.resolve(createMetadata(patch)),
    ),
    runCleanPullCheck: vi.fn(() => Promise.resolve(createActionResult())),
    runSafePush: vi.fn(() => Promise.resolve(createActionResult())),
    scheduler: createScheduler(),
    ...overrides,
  }
}

function createScheduler(): SchedulerDependency {
  return {
    clear: vi.fn(() => Promise.resolve(undefined)),
    register: vi.fn(),
    repairStartupAlarms: vi.fn(() => Promise.resolve(undefined)),
    schedule: vi.fn(() => Promise.resolve(undefined)),
  }
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })

  return { promise, resolve }
}

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

function createMetadata(patch: Partial<SyncMetadata> = {}): SyncMetadata {
  return {
    ...defaultSyncMetadata,
    enabled: true,
    gistId: 'gist_1',
    dirtySinceLastSync: false,
    ...patch,
  }
}

function createActionResult(
  patch: Partial<SyncActionResult> = {},
): SyncActionResult {
  return {
    action: 'push-local',
    direction: 'push',
    outcome: 'success',
    reason: null,
    retryable: false,
    message: 'Sync complete.',
    status: {
      enabled: true,
      configured: true,
      tokenConfigured: true,
      tokenStatus: {
        provider: 'github:gist',
        configured: true,
        updatedAt: '2026-05-31T12:00:00.000Z',
        fingerprint: '12345678',
      },
      gistId: 'gist_1',
      isSyncing: false,
      lastSyncAt: '2026-05-31T12:00:00.000Z',
      lastSyncDirection: 'push',
      lastPullAt: null,
      lastPushAt: '2026-05-31T12:00:00.000Z',
      needsPush: false,
      lastBlockingReason: null,
      lastError: null,
      conflict: null,
    },
    occurredAt: '2026-05-31T12:00:00.000Z',
    ...patch,
  }
}
