import {
  exportFullBackup,
  restoreValidatedBackupData,
} from '@/features/backup/server/backup-service'
import type {
  BackupFile,
  BackupSummary,
} from '@/features/backup/api/backup-contracts'
import { createGitHubGistClient, type GitHubGistClient } from '@/lib/github'
import type { GitHubGistSummary } from '@/lib/github/api/gist-contracts'
import type { Db } from '@/platform/db'
import { flushDbSnapshot } from '@/platform/db'
import { HttpRequestError, isRetryableHttpStatus } from '@/platform/http'
import {
  deleteSecret,
  getSecretStatus,
  readSecret,
  saveSecret,
  type SecretStatus,
} from '@/platform/secrets'

import type {
  SerializedSyncStatus,
  SyncActionResult,
} from '../api/sync-contracts'
import {
  markLocalDataChanged,
  readSyncMetadata,
  writeSyncMetadata,
  type SyncMetadata,
} from '../data/sync-metadata-store'
import { createSyncConflict } from '../domain/sync-conflict'
import {
  buildSyncEnvelope,
  parseSyncEnvelopeForCurrentApp,
} from '../domain/sync-envelope'
import type { SyncErrorKind, SyncErrorSummary } from '../domain/sync-status'

type SyncReason = 'manual' | 'mutation' | 'open'
type SyncConflictResolution = 'pull-remote' | 'push-local'
type MaybePromise<T> = T | Promise<T>

export type SyncOperationCoordinator = {
  isRunning: () => boolean
  run: <T>(work: () => Promise<T>) => Promise<T>
}

type SyncOperationState = {
  queue: Promise<void>
  running: boolean
}

export type SyncServiceDependencies = {
  readToken: () => Promise<string | null>
  saveToken: (token: string) => Promise<unknown>
  deleteToken: () => Promise<unknown>
  getTokenStatus: () => Promise<SecretStatus>
  createGitHubClient: (token: string) => GitHubGistClient
  readMetadata: () => Promise<SyncMetadata>
  writeMetadata: (patch: Partial<SyncMetadata>) => Promise<SyncMetadata>
  exportFullBackup: () => Promise<BackupFile>
  restoreBackup: (backup: BackupFile) => Promise<BackupSummary>
  flushDbSnapshot: () => Promise<unknown>
  broadcastInvalidation: () => MaybePromise<void>
  runRemoteRestore?: (<T>(work: () => Promise<T>) => Promise<T>) | undefined
  syncCoordinator?: SyncOperationCoordinator | undefined
  now: () => Date
}

const sharedSyncOperationCoordinator = createSyncOperationCoordinator({
  queue: Promise.resolve(),
  running: false,
})

export function createSyncOperationCoordinator(
  state: SyncOperationState = {
    queue: Promise.resolve(),
    running: false,
  },
): SyncOperationCoordinator {
  return {
    isRunning: () => state.running,
    run: (work) => {
      const queued = state.queue.then(async () => {
        state.running = true

        try {
          return await work()
        } finally {
          state.running = false
        }
      })

      state.queue = queued.then(
        () => undefined,
        () => undefined,
      )

      return queued
    },
  }
}

export function createSyncService(deps: SyncServiceDependencies) {
  const syncCoordinator = deps.syncCoordinator ?? sharedSyncOperationCoordinator

  async function getStatus(): Promise<SerializedSyncStatus> {
    const [metadata, tokenStatus] = await Promise.all([
      deps.readMetadata(),
      deps.getTokenStatus(),
    ])

    return createStatus(metadata, tokenStatus, syncCoordinator.isRunning())
  }

  async function validateGithubToken(token: string): Promise<SyncActionResult> {
    try {
      const client = deps.createGitHubClient(token)
      await client.validateToken()

      return createActionResult('GitHub token validated.')
    } catch (error) {
      await recordError(error, false)
      throw error
    }
  }

  async function saveGithubToken(token: string): Promise<SyncActionResult> {
    try {
      const client = deps.createGitHubClient(token)
      await client.validateToken()
      await deps.saveToken(token)
      await deps.writeMetadata({ lastError: null })

      return createActionResult('GitHub token saved.')
    } catch (error) {
      await recordError(error, false)
      throw error
    }
  }

  async function deleteGithubToken(): Promise<SyncActionResult> {
    const message = await runExclusive(async () => {
      await deps.deleteToken()
      await deps.writeMetadata({
        enabled: false,
        lastError: null,
        conflict: null,
      })

      return 'GitHub token deleted.'
    })

    return createActionResult(message)
  }

  async function createGithubGist(): Promise<SyncActionResult> {
    const message = await runExclusive(async () => {
      const client = await readConfiguredClient()
      const local = await createLocalEnvelopeContent()
      const gist = await client.createSyncGist(local.content)
      await recordPush(gist, local.dataUpdatedAt)

      return 'GitHub Gist created.'
    })

    return createActionResult(message)
  }

  async function connectGithubGist(gistId: string): Promise<SyncActionResult> {
    const message = await runExclusive(async () => {
      const client = await readConfiguredClient()
      const metadata = await deps.readMetadata()
      const gist = await client.getGist(gistId)

      assertReadableRemoteSyncContent(gist)

      if (!gist.content) {
        const local = await createLocalEnvelopeContent()
        const updated = await client.updateSyncGist(gistId, local.content)
        await recordPush(updated, local.dataUpdatedAt)

        return 'GitHub Gist connected and initialized.'
      }

      if (!metadata.dirtySinceLastSync) {
        await pullRemote(gist)

        return 'GitHub Gist connected and pulled.'
      }

      await deps.writeMetadata({
        enabled: true,
        gistId,
        lastRemoteVersion: gist.remoteVersion,
        lastRemoteUpdatedAt: gist.updatedAt,
        conflict: createSyncConflict({
          detectedAt: deps.now(),
          localDataUpdatedAt: metadata.localDataUpdatedAt,
          remoteUpdatedAt: gist.updatedAt,
          remoteVersion: getRemoteIdentity(gist),
        }),
        lastError: null,
      })

      return 'Choose whether to pull remote data or push local data.'
    })

    return createActionResult(message)
  }

  async function setEnabled(enabled: boolean): Promise<SyncActionResult> {
    const message = await runExclusive(async () => {
      await deps.writeMetadata({ enabled })

      return enabled ? 'GitHub sync enabled.' : 'GitHub sync disabled.'
    })

    return createActionResult(message)
  }

  async function checkOnOpen(): Promise<SyncActionResult | null> {
    const message = await runExclusive(async () => syncCore('open'))

    return message === null ? null : createActionResult(message)
  }

  async function syncNow(): Promise<SyncActionResult | null> {
    const message = await runExclusive(async () => syncCore('manual'))

    return message === null ? null : createActionResult(message)
  }

  async function syncAfterMutation(): Promise<null> {
    try {
      await runExclusive(async () => syncCore('mutation'), {
        recordErrors: false,
      })
    } catch (error) {
      await recordError(error, isRetryableSyncError(error))
    }

    return null
  }

  async function resolveConflict(
    resolution: SyncConflictResolution,
  ): Promise<SyncActionResult> {
    const message = await runExclusive(async () => {
      const metadata = await deps.readMetadata()

      if (!metadata.gistId) {
        throw new Error('GitHub Gist is not configured.')
      }

      const client = await readConfiguredClient()

      if (resolution === 'pull-remote') {
        const gist = await client.getGist(metadata.gistId)
        await pullRemote(gist)

        return 'Remote data pulled.'
      }

      const local = await createLocalEnvelopeContent()
      const gist = await client.updateSyncGist(metadata.gistId, local.content)
      await recordPush(gist, local.dataUpdatedAt)

      return 'Local data pushed.'
    })

    return createActionResult(message)
  }

  async function syncCore(reason: SyncReason): Promise<string | null> {
    const metadata = await deps.readMetadata()

    if (!metadata.enabled || !metadata.gistId || metadata.conflict) {
      return null
    }

    const client = await readConfiguredClient()
    const remote = await client.getGist(metadata.gistId)

    if (hasRemoteChanged(remote, metadata)) {
      if (metadata.dirtySinceLastSync) {
        await deps.writeMetadata({
          conflict: createSyncConflict({
            detectedAt: deps.now(),
            localDataUpdatedAt: metadata.localDataUpdatedAt,
            remoteUpdatedAt: remote.updatedAt,
            remoteVersion: getRemoteIdentity(remote),
          }),
          lastError: null,
        })

        return 'Sync conflict detected.'
      }

      await pullRemote(remote)

      return 'Remote data pulled.'
    }

    if (metadata.dirtySinceLastSync) {
      const local = await createLocalEnvelopeContent()
      const updated = await client.updateSyncGist(
        metadata.gistId,
        local.content,
      )
      await recordPush(updated, local.dataUpdatedAt)

      return 'Local data pushed.'
    }

    await deps.writeMetadata({
      lastSyncAt: deps.now().toISOString(),
      lastSyncDirection: 'no-change',
      lastError: null,
    })

    return reason === 'manual' ? 'Already in sync.' : null
  }

  async function pullRemote(gist: GitHubGistSummary) {
    assertReadableRemoteSyncContent(gist)

    if (!gist.content) {
      throw new Error('GitHub Gist does not contain CogniPace sync data.')
    }

    let remotePayload: unknown
    try {
      remotePayload = JSON.parse(gist.content)
    } catch (error) {
      throw new Error('GitHub Gist sync file contains invalid JSON.', {
        cause: error,
      })
    }

    const envelope = parseSyncEnvelopeForCurrentApp(remotePayload)
    await runRemoteRestore(async () => {
      await deps.restoreBackup(envelope.backup)
      await deps.flushDbSnapshot()
      await Promise.resolve(deps.broadcastInvalidation())
    })
    await deps.writeMetadata({
      enabled: true,
      gistId: gist.id,
      lastSyncAt: deps.now().toISOString(),
      lastSyncDirection: 'pull',
      lastRemoteVersion: gist.remoteVersion,
      lastRemoteUpdatedAt: gist.updatedAt,
      localDataUpdatedAt: envelope.dataUpdatedAt,
      dirtySinceLastSync: false,
      conflict: null,
      lastError: null,
    })
  }

  async function recordPush(gist: GitHubGistSummary, dataUpdatedAt: string) {
    await deps.writeMetadata({
      enabled: true,
      gistId: gist.id,
      lastSyncAt: deps.now().toISOString(),
      lastSyncDirection: 'push',
      lastRemoteVersion: gist.remoteVersion,
      lastRemoteUpdatedAt: gist.updatedAt,
      localDataUpdatedAt: dataUpdatedAt,
      dirtySinceLastSync: false,
      conflict: null,
      lastError: null,
    })
  }

  async function createLocalEnvelopeContent() {
    const metadata = await deps.readMetadata()
    const dataUpdatedAt =
      metadata.localDataUpdatedAt ?? deps.now().toISOString()
    const backup = await deps.exportFullBackup()

    return {
      content: JSON.stringify(
        buildSyncEnvelope({
          backup,
          dataUpdatedAt,
          exportedAt: deps.now(),
        }),
        null,
        2,
      ),
      dataUpdatedAt,
    }
  }

  async function readConfiguredClient() {
    const token = await deps.readToken()

    if (!token) {
      throw new Error('GitHub token is not configured.')
    }

    return deps.createGitHubClient(token)
  }

  async function createActionResult(
    message: string,
  ): Promise<SyncActionResult> {
    return {
      status: await getStatus(),
      message,
    }
  }

  async function recordError(error: unknown, retryable: boolean) {
    const summary: SyncErrorSummary = {
      kind: classifySyncError(error),
      message: createSafeSyncErrorMessage(error),
      occurredAt: deps.now().toISOString(),
      retryable,
    }

    await deps.writeMetadata({ lastError: summary })
  }

  async function runExclusive<T>(
    work: () => Promise<T>,
    options: { recordErrors?: boolean } = {},
  ): Promise<T> {
    return syncCoordinator.run(async () => {
      try {
        return await work()
      } catch (error) {
        if (options.recordErrors !== false) {
          await recordError(error, isRetryableSyncError(error))
        }

        throw error
      }
    })
  }

  function runRemoteRestore<T>(work: () => Promise<T>) {
    return deps.runRemoteRestore ? deps.runRemoteRestore(work) : work()
  }

  return {
    checkOnOpen,
    connectGithubGist,
    createGithubGist,
    deleteGithubToken,
    getStatus,
    resolveConflict,
    saveGithubToken,
    setEnabled,
    syncAfterMutation,
    syncNow,
    validateGithubToken,
  }
}

export function createBackgroundSyncService(
  db: Db,
  broadcastInvalidation: () => MaybePromise<void>,
  options: {
    runRemoteRestore?: SyncServiceDependencies['runRemoteRestore']
    syncCoordinator?: SyncOperationCoordinator
  } = {},
) {
  return createSyncService({
    readToken: () => readSecret('github:gist'),
    saveToken: (token) => saveSecret('github:gist', token),
    deleteToken: () => deleteSecret('github:gist'),
    getTokenStatus: () => getSecretStatus('github:gist'),
    createGitHubClient: (token) => createGitHubGistClient({ token }),
    readMetadata: readSyncMetadata,
    writeMetadata: writeSyncMetadata,
    exportFullBackup: () => exportFullBackup(db),
    restoreBackup: (backup) => restoreValidatedBackupData(db, backup),
    flushDbSnapshot,
    broadcastInvalidation,
    syncCoordinator: options.syncCoordinator ?? sharedSyncOperationCoordinator,
    ...(options.runRemoteRestore
      ? { runRemoteRestore: options.runRemoteRestore }
      : {}),
    now: () => new Date(),
  })
}

export function markSyncLocalDataChanged(now = new Date()) {
  return markLocalDataChanged(now)
}

function createStatus(
  metadata: SyncMetadata,
  tokenStatus: SecretStatus,
  isSyncing: boolean,
): SerializedSyncStatus {
  return {
    enabled: metadata.enabled,
    configured: tokenStatus.configured && Boolean(metadata.gistId),
    tokenConfigured: tokenStatus.configured,
    tokenStatus,
    gistId: metadata.gistId,
    isSyncing,
    lastSyncAt: metadata.lastSyncAt,
    lastSyncDirection: metadata.lastSyncDirection,
    lastError: metadata.lastError,
    conflict: metadata.conflict,
  }
}

function hasRemoteChanged(remote: GitHubGistSummary, metadata: SyncMetadata) {
  if (remote.remoteVersion && metadata.lastRemoteVersion) {
    return remote.remoteVersion !== metadata.lastRemoteVersion
  }

  if (metadata.lastRemoteUpdatedAt) {
    return remote.updatedAt !== metadata.lastRemoteUpdatedAt
  }

  return metadata.lastRemoteVersion === null
    ? true
    : remote.remoteVersion !== metadata.lastRemoteVersion
}

function getRemoteIdentity(remote: GitHubGistSummary) {
  return remote.remoteVersion ?? remote.updatedAt
}

function assertReadableRemoteSyncContent(gist: GitHubGistSummary) {
  if (gist.contentTruncated) {
    throw new Error(
      'GitHub Gist sync file is truncated and cannot be read through the GitHub API.',
    )
  }

  if (gist.content !== null && gist.content.trim().length === 0) {
    throw new Error('GitHub Gist sync file is empty.')
  }
}

function classifySyncError(error: unknown): SyncErrorKind {
  const status = error instanceof HttpRequestError ? error.status : undefined
  const message = createSafeSyncErrorMessage(error).toLowerCase()

  if (
    status === 429 ||
    message.includes('rate limit') ||
    message.includes('rate-limit')
  ) {
    return 'rate-limit'
  }

  if (
    status === 404 ||
    message.includes('not found') ||
    message.includes('404')
  ) {
    return 'gist-missing'
  }

  if (
    status === 401 ||
    status === 403 ||
    message.includes('credential') ||
    message.includes('bad credentials') ||
    message.includes('token') ||
    message.includes('auth') ||
    message.includes('unauthorized')
  ) {
    return 'auth'
  }

  if (message.includes('unsupported')) {
    return 'schema-unsupported'
  }

  if (
    error instanceof SyntaxError ||
    getErrorName(error) === 'ZodError' ||
    message.includes('invalid json') ||
    message.includes('invalid backup') ||
    message.includes('sync file') ||
    message.includes('sync data') ||
    message.includes('not a cognipace')
  ) {
    return 'remote-invalid'
  }

  if (
    status === undefined &&
    (message.includes('failed to fetch') ||
      message.includes('network') ||
      message.includes('offline') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('load failed'))
  ) {
    return 'network'
  }

  return 'unknown'
}

function isRetryableSyncError(error: unknown) {
  const status = error instanceof HttpRequestError ? error.status : undefined

  if (isRetryableHttpStatus(status)) {
    return true
  }

  const kind = classifySyncError(error)

  return kind === 'network' || kind === 'rate-limit' || kind === 'unknown'
}

function createSafeSyncErrorMessage(error: unknown) {
  const message = getUnknownErrorMessage(error)
  const cleaned = message
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]+\b/g, '[redacted]')
    .replace(/\bgithub_pat_[A-Za-z0-9_]+\b/g, '[redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]+\b/g, '[redacted]')
    .trim()

  return (cleaned || 'Sync failed.').slice(0, 300)
}

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : null
}

function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Sync failed.'
}
