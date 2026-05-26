import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { SerializedSyncStatus, SyncActionResult } from '../api/sync-contracts'

import { DashboardSyncActionsView } from './dashboard-sync-actions'

describe('DashboardSyncActionsView', () => {
  it('hides actions when Gist sync is not configured', () => {
    render(
      <DashboardSyncActionsView
        isPending={false}
        onPullLatest={vi.fn()}
        onPushLocal={vi.fn()}
        status={notConfiguredStatus}
      />,
    )

    expect(
      screen.queryByRole('button', { name: 'Pull latest from Gist' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Push local to Gist' }),
    ).not.toBeInTheDocument()
  })

  it('renders configured cloud icon buttons and calls handlers', async () => {
    const user = userEvent.setup()
    const onPullLatest = vi.fn()
    const onPushLocal = vi.fn()

    render(
      <DashboardSyncActionsView
        isPending={false}
        onPullLatest={onPullLatest}
        onPushLocal={onPushLocal}
        status={configuredStatus}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Pull latest from Gist' }),
    )
    await user.click(screen.getByRole('button', { name: 'Push local to Gist' }))

    expect(onPullLatest).toHaveBeenCalledTimes(1)
    expect(onPushLocal).toHaveBeenCalledWith({
      confirmRemoteOverwrite: false,
    })
  })

  it('asks users to open Settings when header push requires overwrite confirmation', async () => {
    const user = userEvent.setup()
    const onPushLocal = vi.fn().mockResolvedValue(confirmationRequiredResult)

    render(
      <DashboardSyncActionsView
        isPending={false}
        onPullLatest={vi.fn()}
        onPushLocal={onPushLocal}
        status={configuredStatus}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Push local to Gist' }))

    expect(onPushLocal).toHaveBeenCalledTimes(1)
    expect(onPushLocal).toHaveBeenCalledWith({
      confirmRemoteOverwrite: false,
    })
    expect(onPushLocal).not.toHaveBeenCalledWith({
      confirmRemoteOverwrite: true,
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Remote changed. Open Settings to overwrite the Gist.',
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
} satisfies SerializedSyncStatus

const configuredStatus = {
  ...notConfiguredStatus,
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
  lastSyncAt: '2026-05-26T12:00:00.000Z',
  lastSyncDirection: 'push',
  lastPushAt: '2026-05-26T12:00:00.000Z',
} satisfies SerializedSyncStatus

const confirmationRequiredResult = {
  action: 'push-local',
  direction: 'push',
  outcome: 'confirmation-required',
  reason: 'remote-changed',
  retryable: false,
  message: 'Remote changed.',
  status: configuredStatus,
  occurredAt: '2026-05-26T12:00:00.000Z',
} satisfies SyncActionResult
