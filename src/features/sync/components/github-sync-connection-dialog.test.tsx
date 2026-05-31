import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type {
  SerializedSyncStatus,
  SyncActionResult,
} from '../api/sync-contracts'
import type { GitHubSyncPanelActions } from './github-sync-panel'
import { GitHubSyncConnectionDialog } from './github-sync-connection-dialog'

const createActions = (
  overrides: Partial<GitHubSyncPanelActions> = {},
): GitHubSyncPanelActions => ({
  onConnectGist: vi.fn(),
  onCreateGist: vi.fn(),
  onDeleteToken: vi.fn(),
  onPullLatest: vi.fn(),
  onPushLocal: vi.fn(),
  onSaveToken: vi.fn(),
  onSetAutoSyncEnabled: vi.fn(),
  onValidateStoredToken: vi.fn(),
  onValidateToken: vi.fn(),
  ...overrides,
})

describe('GitHubSyncConnectionDialog', () => {
  it('groups token and Gist entry controls into single rows', () => {
    renderDialog({ status: notConfiguredStatus })

    const tokenGroup = screen.getByRole('group', { name: /GitHub token/i })
    expect(within(tokenGroup).getByLabelText(/Access token/i)).toHaveAttribute(
      'type',
      'password',
    )
    expect(
      within(tokenGroup).getByRole('button', { name: /Test token/i }),
    ).toBeInTheDocument()
    expect(
      within(tokenGroup).getByRole('button', { name: /Save token/i }),
    ).toBeInTheDocument()

    const gistGroup = screen.getByRole('group', { name: /Private Gist/i })
    expect(within(gistGroup).getByLabelText(/Gist ID/i)).toBeInTheDocument()
    expect(
      within(gistGroup).getByRole('button', { name: /^Connect$/i }),
    ).toBeInTheDocument()
    expect(
      within(gistGroup).getByRole('button', { name: /Create private Gist/i }),
    ).toBeInTheDocument()
  })

  it('keeps a saved token masked until the user chooses to replace it', async () => {
    const user = userEvent.setup()

    renderDialog({ status: configuredStatus })

    expect(screen.getByLabelText(/Access token/i)).toHaveValue(
      '................',
    )
    expect(screen.getByLabelText(/Access token/i)).toHaveAttribute('readOnly')
    expect(screen.queryByDisplayValue(/ghp_/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Replace token/i }))

    expect(screen.getByLabelText(/Access token/i)).toHaveValue('')
    expect(screen.getByLabelText(/Access token/i)).toHaveAttribute(
      'type',
      'password',
    )
  })

  it('tests a typed token without saving it', async () => {
    const user = userEvent.setup()
    const onSaveToken = vi.fn()
    const onValidateToken = vi
      .fn()
      .mockResolvedValue(createResult('validate-token', 'GitHub token works.'))

    renderDialog({
      actions: createActions({ onSaveToken, onValidateToken }),
      status: notConfiguredStatus,
    })

    await user.type(screen.getByLabelText(/Access token/i), 'ghp_secret')
    await user.click(screen.getByRole('button', { name: /Test token/i }))

    expect(onValidateToken).toHaveBeenCalledWith('ghp_secret')
    expect(onSaveToken).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent(
      /GitHub token works/i,
    )
  })

  it('validates the stored token through the stored-token action', async () => {
    const user = userEvent.setup()
    const onValidateStoredToken = vi
      .fn()
      .mockResolvedValue(createResult('validate-token', 'Saved token works.'))
    const onValidateToken = vi.fn()

    renderDialog({
      actions: createActions({ onValidateStoredToken, onValidateToken }),
      status: configuredStatus,
    })

    await user.click(screen.getByRole('button', { name: /Test token/i }))

    expect(onValidateStoredToken).toHaveBeenCalled()
    expect(onValidateToken).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent(
      /Saved token works/i,
    )
  })

  it('deletes a saved token from the manage dialog', async () => {
    const user = userEvent.setup()
    const onDeleteToken = vi
      .fn()
      .mockResolvedValue(createResult('delete-token', 'GitHub token deleted.'))

    renderDialog({
      actions: createActions({ onDeleteToken }),
      status: configuredStatus,
    })

    await user.click(screen.getByRole('button', { name: /Delete token/i }))

    expect(onDeleteToken).toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent(
      /GitHub token deleted/i,
    )
    expect(screen.getByLabelText(/Access token/i)).toHaveValue('')
  })

  it('enables Gist connection actions after a token is saved in the dialog', async () => {
    const user = userEvent.setup()
    const onSaveToken = vi
      .fn()
      .mockResolvedValue(createResult('save-token', 'GitHub token saved.'))
    const onConnectGist = vi
      .fn()
      .mockResolvedValue(createResult('connect-gist', 'GitHub Gist connected.'))

    renderDialog({
      actions: createActions({ onConnectGist, onSaveToken }),
      status: notConfiguredStatus,
    })

    await user.type(screen.getByLabelText(/Access token/i), 'ghp_secret')
    await user.click(screen.getByRole('button', { name: /Save token/i }))
    await user.type(screen.getByLabelText(/Gist ID/i), 'gist_2')
    await user.click(screen.getByRole('button', { name: /^Connect$/i }))

    expect(onSaveToken).toHaveBeenCalledWith('ghp_secret')
    expect(onConnectGist).toHaveBeenCalledWith('gist_2')
  })

  it('offers pull and push decisions when connecting a Gist needs conflict resolution', async () => {
    const user = userEvent.setup()
    const onActionResult = vi.fn()
    const blockedResult = {
      ...createResult('connect-gist', 'Remote and local data both changed.'),
      outcome: 'confirmation-required',
      reason: 'remote-changed',
    } satisfies SyncActionResult
    const onConnectGist = vi.fn().mockResolvedValue(blockedResult)
    const onPullLatest = vi
      .fn()
      .mockResolvedValue(
        createResult('pull-latest', 'Latest Gist data pulled.'),
      )

    renderDialog({
      actions: createActions({ onConnectGist, onPullLatest }),
      onActionResult,
      status: configuredStatus,
    })

    await user.clear(screen.getByLabelText(/Gist ID/i))
    await user.type(screen.getByLabelText(/Gist ID/i), 'gist_2')
    await user.click(screen.getByRole('button', { name: /^Connect$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Remote and local data both changed/i,
    )

    await user.click(screen.getByRole('button', { name: /Pull latest/i }))

    expect(onPullLatest).toHaveBeenCalledWith({
      confirmLocalOverwrite: false,
    })
    expect(onActionResult).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'pull-latest' }),
      'Latest Gist data pulled.',
    )
  })
})

function renderDialog({
  actions = createActions(),
  onActionResult = vi.fn(),
  status,
}: {
  actions?: GitHubSyncPanelActions
  onActionResult?: (
    result: SyncActionResult | null | undefined | void,
    fallbackMessage: string,
  ) => void
  status: SerializedSyncStatus
}) {
  return render(
    <GitHubSyncConnectionDialog
      actions={actions}
      isPending={false}
      onActionResult={onActionResult}
      onClose={vi.fn()}
      status={status}
    />,
  )
}

function createResult(
  action: SyncActionResult['action'],
  message: string,
): SyncActionResult {
  return {
    action,
    direction:
      action === 'pull-latest'
        ? 'pull'
        : action === 'push-local'
          ? 'push'
          : null,
    outcome: 'success',
    reason: null,
    retryable: false,
    message,
    status: configuredStatus,
    occurredAt: '2026-05-26T12:00:00.000Z',
  }
}

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
} satisfies SerializedSyncStatus

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
} satisfies SerializedSyncStatus
