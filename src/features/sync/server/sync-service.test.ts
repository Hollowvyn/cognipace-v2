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
import { createSyncService } from './sync-service'

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
})

function createHarness() {
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
