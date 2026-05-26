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

  it('renders directional sync actions instead of the generic sync action', () => {
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
        status={configuredStatus}
      />,
    )

    expect(
      screen.getByRole('button', { name: /Pull latest/i }),
    ).toBeEnabled()
    expect(screen.getByRole('button', { name: /Push local/i })).toBeEnabled()
  })

  it('keeps directional actions visible while a conflict is present', () => {
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
    expect(
      screen.getByRole('button', { name: /Pull latest/i }),
    ).toBeEnabled()
    expect(screen.getByRole('button', { name: /Push local/i })).toBeEnabled()
  })

  it('calls pull latest and shows blocked pull feedback', async () => {
    const user = userEvent.setup()
    const onPullLatest = vi.fn().mockResolvedValue({
      ...syncActionResult,
      action: 'pull-latest',
      direction: 'pull',
      outcome: 'blocked',
      reason: 'local-dirty',
      message: 'Push local changes before pulling latest Gist data.',
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

    await user.click(
      screen.getByRole('button', { name: /Pull latest/i }),
    )

    expect(onPullLatest).toHaveBeenCalledTimes(1)
    const feedback = await screen.findByText(
      'Push local changes before pulling latest Gist data.',
    )
    expect(feedback.closest('[data-cp-tone]')).toHaveAttribute(
      'data-cp-tone',
      'warning',
    )
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

  it('asks for destructive overwrite confirmation only when push local requires it', async () => {
    const user = userEvent.setup()
    const onPushLocal = vi
      .fn()
      .mockResolvedValueOnce({
        ...syncActionResult,
        action: 'push-local',
        direction: 'push',
        outcome: 'confirmation-required',
        reason: 'remote-changed',
        message: 'Remote changed. Confirm overwrite before pushing.',
      })
      .mockResolvedValueOnce({
        ...syncActionResult,
        action: 'push-local',
        direction: 'push',
        outcome: 'success',
        message: 'Local data pushed to Gist.',
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
        status={configuredStatus}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Push local/i }))

    expect(onPushLocal).toHaveBeenCalledWith({
      confirmRemoteOverwrite: false,
    })

    const feedback = await screen.findByText(
      'Remote changed. Confirm overwrite before pushing.',
    )
    expect(feedback.closest('[data-cp-tone]')).toHaveAttribute(
      'data-cp-tone',
      'warning',
    )
    await user.click(screen.getByRole('button', { name: /Overwrite Gist/i }))

    expect(onPushLocal).toHaveBeenCalledWith({
      confirmRemoteOverwrite: true,
    })
  })

  it('clears stale overwrite confirmation when another action starts', async () => {
    const user = userEvent.setup()
    const onCreateGist = vi.fn().mockReturnValue(new Promise(() => {}))
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
          onCreateGist,
          onDeleteToken: vi.fn(),
          onPullLatest: vi.fn(),
          onPushLocal,
          onSaveToken: vi.fn(),
          onValidateToken: vi.fn(),
        }}
        status={configuredStatus}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Push local/i }))
    expect(
      await screen.findByRole('button', { name: /Overwrite Gist/i }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /Create private Gist/i }),
    )

    expect(onCreateGist).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole('button', { name: /Overwrite Gist/i }),
    ).not.toBeInTheDocument()
  })

  it('hides stale overwrite confirmation when the configured Gist changes', async () => {
    const user = userEvent.setup()
    const onPushLocal = vi.fn().mockResolvedValue({
      ...syncActionResult,
      action: 'push-local',
      direction: 'push',
      outcome: 'confirmation-required',
      reason: 'remote-changed',
      message: 'Remote changed. Confirm overwrite before pushing.',
    })

    const { rerender } = render(
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
        status={configuredStatus}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Push local/i }))
    expect(
      await screen.findByRole('button', { name: /Overwrite Gist/i }),
    ).toBeInTheDocument()

    rerender(
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
          gistId: 'gist_2',
        }}
      />,
    )

    expect(
      screen.queryByRole('button', { name: /Overwrite Gist/i }),
    ).not.toBeInTheDocument()
  })

  it('hides stale overwrite confirmation when same-Gist status identity changes', async () => {
    const user = userEvent.setup()
    const onPushLocal = vi.fn().mockResolvedValue({
      ...syncActionResult,
      action: 'push-local',
      direction: 'push',
      outcome: 'confirmation-required',
      reason: 'remote-changed',
      message: 'Remote changed. Confirm overwrite before pushing.',
    })

    const { rerender } = render(
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
        status={configuredStatus}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Push local/i }))
    expect(
      await screen.findByRole('button', { name: /Overwrite Gist/i }),
    ).toBeInTheDocument()

    rerender(
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
          lastPullAt: '2026-05-26T12:05:00.000Z',
        }}
      />,
    )

    expect(
      screen.queryByRole('button', { name: /Overwrite Gist/i }),
    ).not.toBeInTheDocument()
  })

  it('hides overwrite confirmation after confirmed push success', async () => {
    const user = userEvent.setup()
    const onPushLocal = vi
      .fn()
      .mockResolvedValueOnce({
        ...syncActionResult,
        action: 'push-local',
        direction: 'push',
        outcome: 'confirmation-required',
        reason: 'remote-changed',
        message: 'Remote changed. Confirm overwrite before pushing.',
      })
      .mockResolvedValueOnce({
        ...syncActionResult,
        action: 'push-local',
        direction: 'push',
        outcome: 'success',
        message: 'Local data pushed to Gist.',
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
        status={configuredStatus}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Push local/i }))
    await user.click(
      await screen.findByRole('button', { name: /Overwrite Gist/i }),
    )

    expect(onPushLocal).toHaveBeenLastCalledWith({
      confirmRemoteOverwrite: true,
    })
    expect(await screen.findByText('Local data pushed to Gist.')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Overwrite Gist/i }),
    ).not.toBeInTheDocument()
  })

  it('cancels overwrite confirmation without pushing', async () => {
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
        status={configuredStatus}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Push local/i }))
    await user.click(await screen.findByRole('button', { name: /Cancel/i }))

    expect(
      screen.queryByRole('button', { name: /Overwrite Gist/i }),
    ).not.toBeInTheDocument()
    expect(onPushLocal).toHaveBeenCalledTimes(1)
  })

  it('requests a normal local push without remote overwrite confirmation', async () => {
    const user = userEvent.setup()
    const onPushLocal = vi.fn().mockResolvedValue({
      ...syncActionResult,
      action: 'push-local',
      direction: 'push',
      outcome: 'success',
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
        status={configuredStatus}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Push local/i }))

    expect(onPushLocal).toHaveBeenCalledWith({
      confirmRemoteOverwrite: false,
    })
  })

  it('shows local-dirty blocking status and push-needed status before timestamps', () => {
    const { rerender } = render(
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
          lastBlockingReason: 'local-dirty',
        }}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      /Local changes need to be pushed before pulling latest/i,
    )

    rerender(
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
          lastBlockingReason: null,
          needsPush: true,
        }}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      /Local changes are waiting to be pushed/i,
    )
  })

  it('shows the latest push or pull timestamp before legacy sync timestamps', () => {
    const { rerender } = render(
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
          lastPushAt: '2026-05-26T13:00:00.000Z',
          lastPullAt: '2026-05-26T12:30:00.000Z',
          lastSyncAt: '2026-05-26T12:00:00.000Z',
        }}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/Last push:/i)

    rerender(
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
          lastPushAt: '2026-05-26T12:30:00.000Z',
          lastPullAt: '2026-05-26T13:00:00.000Z',
          lastSyncAt: '2026-05-26T12:00:00.000Z',
        }}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/Last pull:/i)

    rerender(
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
          lastPushAt: null,
          lastPullAt: null,
          lastSyncAt: '2026-05-26T12:00:00.000Z',
          lastSyncDirection: 'no-change',
        }}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/Last sync check:/i)
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
