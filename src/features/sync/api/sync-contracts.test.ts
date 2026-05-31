import { describe, expect, it } from 'vitest'

import * as syncContracts from './sync-contracts'

const { syncActionResultSchema, syncPushLocalRequestSchema } = syncContracts

describe('sync contracts', () => {
  it('validates directional action instrumentation without secret fields', () => {
    const parsed = syncActionResultSchema.parse({
      action: 'pull-latest',
      direction: 'pull',
      outcome: 'blocked',
      reason: 'local-dirty',
      retryable: false,
      message: 'Pull blocked: local changes have not been pushed.',
      occurredAt: '2026-05-26T12:30:00.000Z',
      status: {
        enabled: true,
        configured: true,
        tokenConfigured: true,
        tokenStatus: {
          provider: 'github:gist',
          configured: true,
          updatedAt: '2026-05-26T12:00:00.000Z',
          fingerprint: 'abcdef123456',
        },
        gistId: 'gist_1',
        isSyncing: false,
        lastSyncAt: '2026-05-26T12:00:00.000Z',
        lastSyncDirection: 'push',
        lastPullAt: null,
        lastPushAt: '2026-05-26T12:00:00.000Z',
        needsPush: true,
        lastBlockingReason: 'local-dirty',
        lastError: null,
        conflict: null,
      },
    })

    expect(parsed).toMatchObject({
      action: 'pull-latest',
      direction: 'pull',
      outcome: 'blocked',
      reason: 'local-dirty',
      retryable: false,
    })
    expect(JSON.stringify(parsed)).not.toMatch(
      /ghp_|github_pat_|Bearer|secret|token-value/i,
    )
  })

  it('validates open remote check action results', () => {
    const result = syncActionResultSchema.parse({
      action: 'check-remote-on-open',
      direction: null,
      outcome: 'no-change',
      reason: 'remote-unchanged',
      retryable: false,
      message: 'Remote check found no changes.',
      occurredAt: '2026-05-26T12:30:00.000Z',
      status: {
        enabled: true,
        configured: true,
        tokenConfigured: true,
        tokenStatus: {
          provider: 'github:gist',
          configured: true,
          updatedAt: '2026-05-26T12:00:00.000Z',
          fingerprint: 'abcdef123456',
        },
        gistId: 'gist_1',
        isSyncing: false,
        lastSyncAt: '2026-05-26T12:30:00.000Z',
        lastSyncDirection: 'no-change',
        lastPullAt: null,
        lastPushAt: null,
        needsPush: false,
        lastBlockingReason: null,
        lastError: null,
        conflict: null,
      },
    })

    expect(result).toMatchObject({
      action: 'check-remote-on-open',
      direction: null,
      outcome: 'no-change',
      reason: 'remote-unchanged',
    })
  })

  it('requires explicit confirmation for overwrite pushes at the request boundary', () => {
    expect(
      syncPushLocalRequestSchema.parse({
        surface: 'dashboard',
      }),
    ).toEqual({
      surface: 'dashboard',
      confirmRemoteOverwrite: false,
    })
    expect(
      syncPushLocalRequestSchema.parse({
        surface: 'dashboard',
        confirmRemoteOverwrite: true,
      }),
    ).toEqual({
      surface: 'dashboard',
      confirmRemoteOverwrite: true,
    })
    expect(() =>
      syncPushLocalRequestSchema.parse({
        surface: 'popup',
        confirmRemoteOverwrite: true,
      }),
    ).toThrow()
  })

  it('requires explicit confirmation for overwrite pulls at the request boundary', () => {
    const pullRequestSchema = (
      syncContracts as unknown as {
        syncPullLatestRequestSchema: typeof syncPushLocalRequestSchema
      }
    ).syncPullLatestRequestSchema

    expect(
      pullRequestSchema.parse({
        surface: 'dashboard',
      }),
    ).toEqual({
      surface: 'dashboard',
      confirmLocalOverwrite: false,
    })
    expect(
      pullRequestSchema.parse({
        surface: 'dashboard',
        confirmLocalOverwrite: true,
      }),
    ).toEqual({
      surface: 'dashboard',
      confirmLocalOverwrite: true,
    })
    expect(() =>
      pullRequestSchema.parse({
        surface: 'popup',
        confirmLocalOverwrite: true,
      }),
    ).toThrow()
  })
})
