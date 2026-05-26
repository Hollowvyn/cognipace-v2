import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { GitHubSyncPanel } from './github-sync-panel'

describe('GitHubSyncPanel', () => {
  it('saves a token and creates a Gist from the not configured state', async () => {
    const user = userEvent.setup()
    const onSaveToken = vi.fn().mockResolvedValue(syncActionResult)
    const onCreateGist = vi.fn().mockResolvedValue(syncActionResult)

    render(
      <GitHubSyncPanel
        actions={{
          onConnectGist: vi.fn(),
          onCreateGist,
          onDeleteToken: vi.fn(),
          onResolveConflict: vi.fn(),
          onSaveToken,
          onSyncNow: vi.fn(),
          onValidateToken: vi.fn(),
        }}
        status={notConfiguredStatus}
      />,
    )

    await user.type(screen.getByLabelText(/GitHub token/i), 'ghp_secret')
    await user.click(screen.getByRole('button', { name: /Save token/i }))
    await user.click(
      screen.getByRole('button', { name: /Create private Gist/i }),
    )

    expect(onSaveToken).toHaveBeenCalledWith('ghp_secret')
    expect(onCreateGist).toHaveBeenCalled()
  })

  it('shows conflict resolution actions without auto choosing a destructive action', () => {
    render(
      <GitHubSyncPanel
        actions={{
          onConnectGist: vi.fn(),
          onCreateGist: vi.fn(),
          onDeleteToken: vi.fn(),
          onResolveConflict: vi.fn(),
          onSaveToken: vi.fn(),
          onSyncNow: vi.fn(),
          onValidateToken: vi.fn(),
        }}
        status={{
          ...configuredStatus,
          conflict: {
            detectedAt: '2026-05-26T12:10:00.000Z',
            localDataUpdatedAt: '2026-05-26T12:08:00.000Z',
            remoteUpdatedAt: '2026-05-26T12:09:00.000Z',
            remoteVersion: 'remote_2',
          },
        }}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/conflict/i)
    expect(screen.getByRole('button', { name: /Pull remote/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Push local/i })).toBeEnabled()
  })

  it('requires confirmation before resolving a conflict', async () => {
    const user = userEvent.setup()
    const onResolveConflict = vi.fn().mockResolvedValue(syncActionResult)

    render(
      <GitHubSyncPanel
        actions={{
          onConnectGist: vi.fn(),
          onCreateGist: vi.fn(),
          onDeleteToken: vi.fn(),
          onResolveConflict,
          onSaveToken: vi.fn(),
          onSyncNow: vi.fn(),
          onValidateToken: vi.fn(),
        }}
        status={{
          ...configuredStatus,
          conflict: {
            detectedAt: '2026-05-26T12:10:00.000Z',
            localDataUpdatedAt: '2026-05-26T12:08:00.000Z',
            remoteUpdatedAt: '2026-05-26T12:09:00.000Z',
            remoteVersion: 'remote_2',
          },
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Pull remote/i }))

    expect(onResolveConflict).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', { name: /Confirm pull remote/i }),
    )

    expect(onResolveConflict).toHaveBeenCalledWith('pull-remote')
  })
})

const notConfiguredStatus = {
  enabled: false,
  configured: false,
  tokenConfigured: false,
  tokenStatus: {
    provider: 'github:gist',
    configured: false,
    updatedAt: null,
    fingerprint: null,
  },
  gistId: null,
  isSyncing: false,
  lastSyncAt: null,
  lastSyncDirection: null,
  lastError: null,
  conflict: null,
} as const

const configuredStatus = {
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
  lastError: null,
  conflict: null,
} as const

const syncActionResult = {
  message: 'GitHub sync updated.',
  status: configuredStatus,
} as const
