import { describe, expect, it, vi } from 'vitest'

import {
  backupSchemaVersion,
  type BackupFile,
  type BackupSummary,
} from '@/features/backup/api/backup-contracts'
import type { GitHubGistSummary } from '@/lib/github/api/gist-contracts'
import type { SecretStatus } from '@/platform/secrets'

import { defaultSyncMetadata } from '../data/sync-metadata-store'
import type { SyncMetadata } from '../data/sync-metadata-store'
import { buildSyncEnvelope } from '../domain/sync-envelope'
import { syncActionResultSchema, syncStatusSchema } from '../api/sync-contracts'
import {
  createSyncOperationCoordinator,
  createSyncService,
  type SyncServiceDependencies,
} from './sync-service'

const currentTime = '2026-05-26T12:30:00.000Z'

const backup: BackupFile = {
  schemaVersion: backupSchemaVersion,
  app: 'cognipace',
  exportedAt: '2026-05-26T12:00:00.000Z',
  source: { appVersion: '0.0.0' },
  data: {
    problems: [],
    topics: [],
    companies: [],
    problemTopics: [],
    problemCompanies: [],
    practice: {
      problemPractice: [],
      fsrsCards: [],
      reviewAttempts: [],
    },
    tracks: {
      tracks: [],
      groups: [],
      memberships: [],
      progress: [],
      session: [],
    },
    settings: [],
  },
}

const backupSummary: BackupSummary = {
  schemaVersion: backup.schemaVersion,
  exportedAt: backup.exportedAt,
  source: backup.source,
  counts: {
    problems: 0,
    topics: 0,
    companies: 0,
    problemTopics: 0,
    problemCompanies: 0,
    problemPractice: 0,
    fsrsCards: 0,
    reviewAttempts: 0,
    tracks: 0,
    trackGroups: 0,
    trackMemberships: 0,
    trackProgress: 0,
    trackSession: 0,
    settings: 0,
  },
}

const tokenStatus: SecretStatus = {
  provider: 'github:gist',
  configured: true,
  updatedAt: '2026-05-26T12:00:00.000Z',
  fingerprint: 'abcdef123456',
}

describe('sync service', () => {
  it('returns status and action results that satisfy sync contracts', async () => {
    const harness = createHarness()
    harness.setMetadata({
      enabled: true,
      gistId: 'gist_1',
      lastSyncAt: '2026-05-26T12:00:00.000Z',
      lastSyncDirection: 'push',
      lastPushAt: '2026-05-26T12:00:00.000Z',
      dirtySinceLastSync: true,
      lastBlockingReason: 'local-dirty',
    })

    const status = await harness.service.getStatus()
    expect(syncStatusSchema.parse(status)).toEqual(status)

    const actionResult =
      await harness.service.validateGithubToken('github_pat_secret')
    expect(syncActionResultSchema.parse(actionResult)).toEqual(actionResult)
  })

  it('returns confirmation-required when connecting a remote Gist over dirty local data', async () => {
    const harness = createHarness()
    harness.setMetadata({
      dirtySinceLastSync: true,
      localDataUpdatedAt: '2026-05-26T12:15:00.000Z',
    })
    harness.githubClient.getGist.mockResolvedValue(
      createGistSummary({
        id: 'gist_1',
        updatedAt: '2026-05-26T12:20:00.000Z',
        remoteVersion: 'remote_2',
        content: JSON.stringify({ app: 'cognipace' }),
      }),
    )

    const result = await harness.service.connectGithubGist('gist_1')
    const parsed = syncActionResultSchema.parse(result)

    expect(parsed).toMatchObject({
      action: 'connect-gist',
      direction: null,
      outcome: 'confirmation-required',
      reason: 'remote-changed',
      retryable: false,
      message: 'Choose whether to pull remote data or push local data.',
      status: {
        lastBlockingReason: 'remote-changed',
      },
    })
  })

  it('maps legacy sync outputs to structured action results', async () => {
    const pullHarness = createHarness()
    pullHarness.setMetadata({
      enabled: true,
      gistId: 'gist_1',
      dirtySinceLastSync: false,
      lastRemoteVersion: 'remote_1',
    })
    pullHarness.githubClient.getGist.mockResolvedValue(
      createGistSummary({
        id: 'gist_1',
        updatedAt: '2026-05-26T12:10:00.000Z',
        remoteVersion: 'remote_2',
        content: JSON.stringify(
          buildSyncEnvelope({
            backup,
            dataUpdatedAt: '2026-05-26T12:10:00.000Z',
          }),
        ),
      }),
    )

    await expect(pullHarness.service.checkOnOpen()).resolves.toMatchObject({
      action: 'pull-latest',
      direction: 'pull',
      outcome: 'success',
      reason: null,
      message: 'Remote data pulled.',
    })

    const pushHarness = createHarness()
    pushHarness.setMetadata({
      enabled: true,
      gistId: 'gist_1',
      dirtySinceLastSync: true,
      localDataUpdatedAt: '2026-05-26T12:15:00.000Z',
      lastRemoteVersion: 'remote_1',
    })
    pushHarness.githubClient.getGist.mockResolvedValue(
      createGistSummary({
        id: 'gist_1',
        updatedAt: '2026-05-26T12:00:00.000Z',
        remoteVersion: 'remote_1',
      }),
    )
    pushHarness.githubClient.updateSyncGist.mockResolvedValue(
      createGistSummary({
        id: 'gist_1',
        updatedAt: currentTime,
        remoteVersion: 'remote_2',
      }),
    )

    await expect(pushHarness.service.syncNow()).resolves.toMatchObject({
      action: 'push-local',
      direction: 'push',
      outcome: 'success',
      reason: null,
      message: 'Local data pushed.',
    })

    const noChangeHarness = createHarness()
    noChangeHarness.setMetadata({
      enabled: true,
      gistId: 'gist_1',
      dirtySinceLastSync: false,
      lastRemoteVersion: 'remote_1',
    })
    noChangeHarness.githubClient.getGist.mockResolvedValue(
      createGistSummary({
        id: 'gist_1',
        updatedAt: '2026-05-26T12:00:00.000Z',
        remoteVersion: 'remote_1',
      }),
    )

    await expect(noChangeHarness.service.syncNow()).resolves.toMatchObject({
      action: 'pull-latest',
      direction: null,
      outcome: 'no-change',
      reason: 'remote-unchanged',
      message: 'Already in sync.',
    })

    const conflictHarness = createHarness()
    conflictHarness.setMetadata({
      enabled: true,
      gistId: 'gist_1',
      dirtySinceLastSync: true,
      localDataUpdatedAt: '2026-05-26T12:15:00.000Z',
      lastRemoteVersion: 'remote_1',
    })
    conflictHarness.githubClient.getGist.mockResolvedValue(
      createGistSummary({
        id: 'gist_1',
        updatedAt: '2026-05-26T12:20:00.000Z',
        remoteVersion: 'remote_2',
        content: JSON.stringify(
          buildSyncEnvelope({
            backup,
            dataUpdatedAt: '2026-05-26T12:20:00.000Z',
          }),
        ),
      }),
    )

    await expect(conflictHarness.service.checkOnOpen()).resolves.toMatchObject({
      action: 'pull-latest',
      direction: null,
      outcome: 'blocked',
      reason: 'remote-changed',
      message: 'Sync conflict detected.',
    })
  })

  it('creates a private Gist from current backup', async () => {
    const harness = createHarness()
    harness.githubClient.createSyncGist.mockResolvedValue(
      createGistSummary({
        id: 'gist_1',
        updatedAt: currentTime,
        remoteVersion: 'remote_1',
        content: '{}',
      }),
    )

    await expect(harness.service.createGithubGist()).resolves.toMatchObject({
      message: 'GitHub Gist created.',
      status: {
        configured: true,
        tokenStatus,
      },
    })

    const content = harness.githubClient.createSyncGist.mock.calls[0]?.[0]
    expect(JSON.parse(content ?? '{}')).toMatchObject({
      app: 'cognipace',
      dataUpdatedAt: currentTime,
      backup,
    })
    expect(harness.getMetadata()).toMatchObject({
      enabled: true,
      gistId: 'gist_1',
      dirtySinceLastSync: false,
      lastRemoteVersion: 'remote_1',
      lastSyncDirection: 'push',
    })
  })

  it('auto-pulls clean local data when remote changed', async () => {
    const harness = createHarness()
    harness.setMetadata({
      enabled: true,
      gistId: 'gist_1',
      dirtySinceLastSync: false,
      lastRemoteVersion: 'remote_1',
    })
    harness.githubClient.getGist.mockResolvedValue(
      createGistSummary({
        id: 'gist_1',
        updatedAt: '2026-05-26T12:10:00.000Z',
        remoteVersion: 'remote_2',
        content: JSON.stringify(
          buildSyncEnvelope({
            backup,
            dataUpdatedAt: '2026-05-26T12:10:00.000Z',
          }),
        ),
      }),
    )

    await harness.service.checkOnOpen()

    expect(harness.restoreBackup).toHaveBeenCalledWith(backup)
    expect(harness.flushDbSnapshot).toHaveBeenCalled()
    expect(harness.broadcastInvalidation).toHaveBeenCalled()
    expect(harness.getMetadata()).toMatchObject({
      dirtySinceLastSync: false,
      lastRemoteVersion: 'remote_2',
      lastRemoteUpdatedAt: '2026-05-26T12:10:00.000Z',
      lastSyncDirection: 'pull',
    })
  })

  it('marks conflict when local and remote both changed', async () => {
    const harness = createHarness()
    harness.setMetadata({
      enabled: true,
      gistId: 'gist_1',
      dirtySinceLastSync: true,
      localDataUpdatedAt: '2026-05-26T12:15:00.000Z',
      lastRemoteVersion: 'remote_1',
    })
    harness.githubClient.getGist.mockResolvedValue(
      createGistSummary({
        id: 'gist_1',
        updatedAt: '2026-05-26T12:20:00.000Z',
        remoteVersion: 'remote_2',
        content: JSON.stringify(
          buildSyncEnvelope({
            backup,
            dataUpdatedAt: '2026-05-26T12:20:00.000Z',
          }),
        ),
      }),
    )

    await harness.service.checkOnOpen()

    expect(harness.restoreBackup).not.toHaveBeenCalled()
    expect(harness.githubClient.updateSyncGist).not.toHaveBeenCalled()
    expect(harness.getMetadata().conflict).toMatchObject({
      localDataUpdatedAt: '2026-05-26T12:15:00.000Z',
      remoteUpdatedAt: '2026-05-26T12:20:00.000Z',
      remoteVersion: 'remote_2',
    })
  })

  it('records retryable push errors without throwing local mutation failures', async () => {
    const harness = createHarness()
    harness.setMetadata({
      enabled: true,
      gistId: 'gist_1',
      dirtySinceLastSync: true,
      lastRemoteVersion: 'remote_1',
    })
    harness.githubClient.getGist.mockResolvedValue(
      createGistSummary({
        id: 'gist_1',
        updatedAt: '2026-05-26T12:00:00.000Z',
        remoteVersion: 'remote_1',
        content: JSON.stringify(
          buildSyncEnvelope({
            backup,
            dataUpdatedAt: '2026-05-26T12:00:00.000Z',
          }),
        ),
      }),
    )
    harness.githubClient.updateSyncGist.mockRejectedValue(
      new Error('API rate limit exceeded'),
    )

    await expect(harness.service.syncAfterMutation()).resolves.toBeNull()
    expect(harness.getMetadata().lastError).toMatchObject({
      kind: 'rate-limit',
      retryable: true,
    })
    expect(harness.getMetadata().dirtySinceLastSync).toBe(true)
  })

  it('records non-retryable mutation sync errors without failing local mutations', async () => {
    const harness = createHarness()
    harness.setMetadata({
      enabled: true,
      gistId: 'gist_1',
      dirtySinceLastSync: true,
      lastRemoteVersion: 'remote_1',
    })
    harness.githubClient.getGist.mockResolvedValue(
      createGistSummary({
        id: 'gist_1',
        updatedAt: '2026-05-26T12:00:00.000Z',
        remoteVersion: 'remote_1',
        content: JSON.stringify(
          buildSyncEnvelope({
            backup,
            dataUpdatedAt: '2026-05-26T12:00:00.000Z',
          }),
        ),
      }),
    )
    harness.githubClient.updateSyncGist.mockRejectedValue(
      new Error('Bad credentials'),
    )

    await expect(harness.service.syncAfterMutation()).resolves.toBeNull()
    expect(harness.getMetadata().lastError).toMatchObject({
      kind: 'auth',
      retryable: false,
    })
    expect(harness.getMetadata().dirtySinceLastSync).toBe(true)
  })

  it('does not overwrite a truncated remote sync file when connecting a Gist', async () => {
    const harness = createHarness()
    harness.githubClient.getGist.mockResolvedValue(
      createGistSummary({
        id: 'gist_1',
        remoteVersion: 'remote_1',
        content: null,
        contentTruncated: true,
        rawUrl:
          'https://gist.githubusercontent.com/octocat/gist_1/raw/sync.json',
      }),
    )

    await expect(harness.service.connectGithubGist('gist_1')).rejects.toThrow(
      /truncated/i,
    )
    expect(harness.githubClient.updateSyncGist).not.toHaveBeenCalled()
    expect(harness.getMetadata().lastError).toMatchObject({
      kind: 'remote-invalid',
    })
  })

  it('does not overwrite an empty remote sync file when connecting a Gist', async () => {
    const harness = createHarness()
    harness.githubClient.getGist.mockResolvedValue(
      createGistSummary({
        id: 'gist_1',
        remoteVersion: 'remote_1',
        content: '',
      }),
    )

    await expect(harness.service.connectGithubGist('gist_1')).rejects.toThrow(
      /empty/i,
    )
    expect(harness.githubClient.updateSyncGist).not.toHaveBeenCalled()
    expect(harness.getMetadata().lastError).toMatchObject({
      kind: 'remote-invalid',
    })
  })

  it('auto-pulls when connecting a remote Gist and local data is clean', async () => {
    const harness = createHarness()
    harness.setMetadata({
      dirtySinceLastSync: false,
      localDataUpdatedAt: '2026-05-26T12:00:00.000Z',
    })
    harness.githubClient.getGist.mockResolvedValue(
      createGistSummary({
        id: 'gist_1',
        updatedAt: '2026-05-26T12:20:00.000Z',
        remoteVersion: 'remote_2',
        content: JSON.stringify(
          buildSyncEnvelope({
            backup,
            dataUpdatedAt: '2026-05-26T12:20:00.000Z',
          }),
        ),
      }),
    )

    await expect(harness.service.connectGithubGist('gist_1')).resolves.toEqual(
      expect.objectContaining({
        message: 'GitHub Gist connected and pulled.',
      }),
    )
    expect(harness.restoreBackup).toHaveBeenCalledWith(backup)
    expect(harness.getMetadata().conflict).toBeNull()
  })

  it('falls back to updatedAt when remote versions become available later', async () => {
    const harness = createHarness()
    harness.setMetadata({
      enabled: true,
      gistId: 'gist_1',
      dirtySinceLastSync: true,
      localDataUpdatedAt: '2026-05-26T12:05:00.000Z',
      lastRemoteVersion: null,
      lastRemoteUpdatedAt: '2026-05-26T12:00:00.000Z',
    })
    harness.githubClient.getGist.mockResolvedValue(
      createGistSummary({
        id: 'gist_1',
        updatedAt: '2026-05-26T12:00:00.000Z',
        remoteVersion: 'remote_1',
        content: JSON.stringify(
          buildSyncEnvelope({
            backup,
            dataUpdatedAt: '2026-05-26T12:00:00.000Z',
          }),
        ),
      }),
    )
    harness.githubClient.updateSyncGist.mockResolvedValue(
      createGistSummary({
        id: 'gist_1',
        updatedAt: currentTime,
        remoteVersion: 'remote_2',
      }),
    )

    await expect(harness.service.syncNow()).resolves.toMatchObject({
      message: 'Local data pushed.',
    })
    expect(harness.githubClient.updateSyncGist).toHaveBeenCalled()
    expect(harness.getMetadata().conflict).toBeNull()
  })

  it('serializes disable behind an in-flight push', async () => {
    const harness = createHarness()
    const push = createDeferred<GitHubGistSummary>()
    harness.setMetadata({
      enabled: true,
      gistId: 'gist_1',
      dirtySinceLastSync: true,
      localDataUpdatedAt: '2026-05-26T12:05:00.000Z',
      lastRemoteVersion: 'remote_1',
    })
    harness.githubClient.getGist.mockResolvedValue(
      createGistSummary({
        id: 'gist_1',
        updatedAt: '2026-05-26T12:00:00.000Z',
        remoteVersion: 'remote_1',
      }),
    )
    harness.githubClient.updateSyncGist.mockReturnValue(push.promise)

    const syncPromise = harness.service.syncNow()
    await waitUntil(() => {
      expect(harness.githubClient.updateSyncGist).toHaveBeenCalled()
    })
    const disablePromise = harness.service.setEnabled(false)

    push.resolve(
      createGistSummary({
        id: 'gist_1',
        updatedAt: currentTime,
        remoteVersion: 'remote_2',
      }),
    )

    await syncPromise
    await disablePromise
    expect(harness.getMetadata().enabled).toBe(false)
  })

  it('keeps data dirty when local data changes during an in-flight push', async () => {
    const harness = createHarness()
    const push = createDeferred<GitHubGistSummary>()
    harness.setMetadata({
      enabled: true,
      gistId: 'gist_1',
      dirtySinceLastSync: true,
      localDataUpdatedAt: '2026-05-26T12:05:00.000Z',
      lastRemoteVersion: 'remote_1',
    })
    harness.githubClient.getGist.mockResolvedValue(
      createGistSummary({
        id: 'gist_1',
        updatedAt: '2026-05-26T12:00:00.000Z',
        remoteVersion: 'remote_1',
      }),
    )
    harness.githubClient.updateSyncGist.mockReturnValue(push.promise)

    const syncPromise = harness.service.syncNow()
    await waitUntil(() => {
      expect(harness.githubClient.updateSyncGist).toHaveBeenCalled()
    })
    harness.setMetadata({
      dirtySinceLastSync: true,
      localDataUpdatedAt: '2026-05-26T12:06:00.000Z',
    })

    push.resolve(
      createGistSummary({
        id: 'gist_1',
        updatedAt: currentTime,
        remoteVersion: 'remote_2',
      }),
    )

    await syncPromise
    expect(harness.getMetadata()).toMatchObject({
      dirtySinceLastSync: true,
      localDataUpdatedAt: '2026-05-26T12:06:00.000Z',
      lastRemoteVersion: 'remote_2',
    })
  })

  it('runs remote pulls through the injected restore coordinator', async () => {
    const runRemoteRestoreCalls: Array<() => Promise<unknown>> = []
    let metadataCleanedBeforeRestoreCoordinatorSettled = false
    let readMetadata: () => SyncMetadata = () => {
      throw new Error('Harness metadata is not available.')
    }
    const runRemoteRestore: NonNullable<
      SyncServiceDependencies['runRemoteRestore']
    > = async (work) => {
      runRemoteRestoreCalls.push(work)
      const result = await work()
      metadataCleanedBeforeRestoreCoordinatorSettled =
        readMetadata().dirtySinceLastSync === false &&
        readMetadata().lastSyncDirection === 'pull'

      return result
    }
    const harness = createHarness({ runRemoteRestore })
    readMetadata = harness.getMetadata
    harness.setMetadata({
      enabled: true,
      gistId: 'gist_1',
      dirtySinceLastSync: false,
      lastRemoteVersion: 'remote_1',
    })
    harness.githubClient.getGist.mockResolvedValue(
      createGistSummary({
        id: 'gist_1',
        updatedAt: '2026-05-26T12:10:00.000Z',
        remoteVersion: 'remote_2',
        content: JSON.stringify(
          buildSyncEnvelope({
            backup,
            dataUpdatedAt: '2026-05-26T12:10:00.000Z',
          }),
        ),
      }),
    )

    await harness.service.checkOnOpen()

    expect(runRemoteRestoreCalls).toHaveLength(1)
    expect(metadataCleanedBeforeRestoreCoordinatorSettled).toBe(true)
    expect(harness.restoreBackup).toHaveBeenCalledWith(backup)
    expect(harness.flushDbSnapshot).toHaveBeenCalled()
    expect(harness.broadcastInvalidation).toHaveBeenCalled()
  })
})

function createHarness(
  overrides: Partial<
    Pick<SyncServiceDependencies, 'runRemoteRestore' | 'syncCoordinator'>
  > = {},
) {
  let metadata: SyncMetadata = { ...defaultSyncMetadata }
  const restoreBackup = vi.fn().mockResolvedValue(backupSummary)
  const exportFullBackup = vi.fn().mockResolvedValue(backup)
  const flushDbSnapshot = vi.fn().mockResolvedValue(undefined)
  const broadcastInvalidation = vi.fn().mockResolvedValue(undefined)
  const githubClient = {
    validateToken: vi
      .fn<() => Promise<{ ok: true; login: string }>>()
      .mockResolvedValue({ ok: true, login: 'octocat' }),
    getGist: vi.fn<(gistId: string) => Promise<GitHubGistSummary>>(),
    createSyncGist: vi.fn<(content: string) => Promise<GitHubGistSummary>>(),
    updateSyncGist:
      vi.fn<(gistId: string, content: string) => Promise<GitHubGistSummary>>(),
  }

  const service = createSyncService({
    readToken: vi.fn().mockResolvedValue('ghp_secret'),
    saveToken: vi.fn().mockResolvedValue(undefined),
    deleteToken: vi.fn().mockResolvedValue(undefined),
    getTokenStatus: vi.fn().mockResolvedValue(tokenStatus),
    createGitHubClient: () => githubClient,
    readMetadata: vi.fn(() => Promise.resolve(metadata)),
    writeMetadata: vi.fn((patch: Partial<SyncMetadata>) => {
      metadata = { ...metadata, ...patch }
      return Promise.resolve(metadata)
    }),
    exportFullBackup,
    restoreBackup,
    flushDbSnapshot,
    broadcastInvalidation,
    now: () => new Date(currentTime),
    syncCoordinator:
      overrides.syncCoordinator ?? createSyncOperationCoordinator(),
    ...(overrides.runRemoteRestore
      ? { runRemoteRestore: overrides.runRemoteRestore }
      : {}),
  })

  return {
    service,
    githubClient,
    getMetadata: () => metadata,
    setMetadata: (patch: Partial<SyncMetadata>) => {
      metadata = { ...metadata, ...patch }
    },
    restoreBackup,
    exportFullBackup,
    flushDbSnapshot,
    broadcastInvalidation,
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, reject, resolve }
}

async function waitUntil(assertion: () => void) {
  let lastError: unknown

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  throw lastError
}

function createGistSummary(
  input: Partial<GitHubGistSummary> & Pick<GitHubGistSummary, 'id'>,
): GitHubGistSummary {
  return {
    id: input.id,
    htmlUrl: input.htmlUrl ?? `https://gist.github.com/${input.id}`,
    updatedAt: input.updatedAt ?? currentTime,
    remoteVersion: input.remoteVersion ?? null,
    content: input.content ?? null,
    contentTruncated: input.contentTruncated ?? false,
    rawUrl: input.rawUrl ?? null,
  }
}
