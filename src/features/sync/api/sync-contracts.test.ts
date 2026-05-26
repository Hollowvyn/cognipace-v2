import { describe, expect, it } from 'vitest'

import {
  syncActionResultSchema,
  syncPushLocalRequestSchema,
} from './sync-contracts'

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
})
