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
          onPullLatest: vi.fn(),
          onPushLocal: vi.fn(),
          onSaveToken,
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
          onPullLatest: vi.fn(),
          onPushLocal: vi.fn(),
          onSaveToken: vi.fn(),
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
    const onPullLatest = vi.fn().mockResolvedValue(syncActionResult)

    render(
      <GitHubSyncPanel
        actions={{
          onConnectGist: vi.fn(),
          onCreateGist: vi.fn(),
          onDeleteToken: vi.fn(),
          onPullLatest,
          onPushLocal: vi.fn(),
          onSaveToken: vi.fn(),
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

    expect(onPullLatest).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', { name: /Confirm pull remote/i }),
    )

    expect(onPullLatest).toHaveBeenCalled()
  })

  it('shows warning feedback and skips token-save cleanup when a resolved action is blocked', async () => {
    const user = userEvent.setup()
    const onSaveToken = vi.fn().mockResolvedValue({
      ...syncActionResult,
      outcome: 'blocked',
      reason: 'not-configured',
      message: 'GitHub token was not saved.',
    })

    render(
      <GitHubSyncPanel
        actions={{
          onConnectGist: vi.fn(),
          onCreateGist: vi.fn(),
          onDeleteToken: vi.fn(),
          onPullLatest: vi.fn(),
          onPushLocal: vi.fn(),
          onSaveToken,
          onValidateToken: vi.fn(),
        }}
        status={notConfiguredStatus}
      />,
    )

    await user.type(screen.getByLabelText(/GitHub token/i), 'ghp_secret')
    await user.click(screen.getByRole('button', { name: /Save token/i }))

    const feedback = await screen.findByText('GitHub token was not saved.')
    expect(feedback.closest('[data-cp-tone]')).toHaveAttribute(
      'data-cp-tone',
      'warning',
    )
    expect(screen.getByLabelText(/GitHub token/i)).toHaveValue('ghp_secret')
    expect(
      screen.getByRole('button', { name: /Create private Gist/i }),
    ).toBeDisabled()
  })

  it('shows warning feedback and keeps conflict confirmation open when confirmation is still required', async () => {
    const user = userEvent.setup()
    const onPushLocal = vi.fn().mockResolvedValue({
      ...syncActionResult,
      action: 'push-local',
      direction: 'push',
      outcome: 'confirmation-required',
      reason: 'remote-changed',
      message: 'Remote changed. Confirm overwrite before pushing.',
    })

    render(
      <GitHubSyncPanel
        actions={{
          onConnectGist: vi.fn(),
          onCreateGist: vi.fn(),
          onDeleteToken: vi.fn(),
          onPullLatest: vi.fn(),
          onPushLocal,
          onSaveToken: vi.fn(),
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

    await user.click(screen.getByRole('button', { name: /Push local/i }))
    await user.click(
      screen.getByRole('button', { name: /Confirm push local/i }),
    )

    const feedback = await screen.findByText(
      'Remote changed. Confirm overwrite before pushing.',
    )
    expect(feedback.closest('[data-cp-tone]')).toHaveAttribute(
      'data-cp-tone',
      'warning',
    )
    expect(
      screen.getByRole('button', { name: /Confirm push local/i }),
    ).toBeEnabled()
  })

  it('shows danger feedback for resolved error outcomes', async () => {
    const user = userEvent.setup()
    const onPullLatest = vi.fn().mockResolvedValue({
      ...syncActionResult,
      action: 'pull-latest',
      direction: 'pull',
      outcome: 'error',
      reason: 'network',
      message: 'GitHub is unavailable.',
      retryable: true,
    })

    render(
      <GitHubSyncPanel
        actions={{
          onConnectGist: vi.fn(),
          onCreateGist: vi.fn(),
          onDeleteToken: vi.fn(),
          onPullLatest,
          onPushLocal: vi.fn(),
          onSaveToken: vi.fn(),
          onValidateToken: vi.fn(),
        }}
        status={configuredStatus}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Pull latest/i }))

    const feedback = await screen.findByText('GitHub is unavailable.')
    expect(feedback.closest('[data-cp-tone]')).toHaveAttribute(
      'data-cp-tone',
      'danger',
    )
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
  lastPullAt: null,
  lastPushAt: null,
  needsPush: false,
  lastBlockingReason: null,
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
  lastPullAt: null,
  lastPushAt: '2026-05-26T12:00:00.000Z',
  needsPush: false,
  lastBlockingReason: null,
  lastError: null,
  conflict: null,
} as const

const syncActionResult = {
  action: 'set-enabled',
  direction: null,
  outcome: 'success',
  reason: null,
  retryable: false,
  message: 'GitHub sync updated.',
  status: configuredStatus,
  occurredAt: '2026-05-26T12:00:00.000Z',
} as const
