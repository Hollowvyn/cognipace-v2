import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import type { BackupFile, BackupSummary } from '../api/backup-contracts'
import { DataManagementScreen } from './data-management-screen'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('DataManagementScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    )
  })

  it('exports a full backup and shows completion feedback', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockResolvedValue(validBackup)
    const { wrapper } = createQueryTestHarness()

    render(<DataManagementScreen />, { wrapper })
    const backupPanel = screen.getByRole('region', { name: 'Export backup' })

    await user.click(screen.getByRole('button', { name: 'Export backup' }))

    expect(sendMessage).toHaveBeenCalledWith('backup.exportFullBackup', {
      surface: 'dashboard',
    })
    expect(
      await screen.findByRole('status', { name: 'Data management feedback' }),
    ).toHaveTextContent('Backup exported.')
    expect(within(backupPanel).queryByText('Backup exported.')).toBeNull()
  })

  it('validates an imported backup, shows the selected file, and keeps restore calm', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockResolvedValue(validSummary)
    const { wrapper } = createQueryTestHarness()

    render(<DataManagementScreen />, { wrapper })

    expect(screen.queryByText('No file chosen')).not.toBeInTheDocument()
    expect(screen.getByText('No backup file selected')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Restore full backup' }),
    ).not.toBeInTheDocument()

    await user.upload(
      screen.getByLabelText('Backup file'),
      createBackupFile(validBackup),
    )

    expect(sendMessage).toHaveBeenCalledWith('backup.validateFullBackup', {
      surface: 'dashboard',
      backup: validBackup,
    })
    expect(
      await screen.findByRole('status', { name: 'Data management feedback' }),
    ).toHaveTextContent('Backup ready to restore.')
    expect(screen.getByText('backup.json')).toBeVisible()
    expect(screen.getByText('Schema version: 1')).toBeVisible()
    expect(
      screen.getByText(
        `Exported: ${formatExpectedDateTime(validSummary.exportedAt)}`,
      ),
    ).toBeVisible()
    expect(screen.getByText('App version: 0.0.0')).toBeVisible()
    expect(screen.getByText('Problems: 1')).toBeVisible()
    expect(screen.getByText('Tracks: 1')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Restore full backup' }),
    ).not.toHaveClass('bg-destructive')
  })

  it('shows an alert for invalid JSON without calling runtime validation', async () => {
    const user = userEvent.setup()
    const { wrapper } = createQueryTestHarness()

    render(<DataManagementScreen />, { wrapper })

    await user.upload(
      screen.getByLabelText('Backup file'),
      new File(['not json'], 'backup.json', { type: 'application/json' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid JSON backup file.',
    )
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('requires confirmation before restoring a full backup', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'backup.validateFullBackup') {
        return Promise.resolve(validSummary)
      }

      if (method === 'backup.restoreFullBackup') {
        return Promise.resolve(validSummary)
      }

      return Promise.reject(new Error(`Unexpected method ${method}`))
    })
    const { wrapper } = createQueryTestHarness()

    render(<DataManagementScreen />, { wrapper })

    await user.upload(
      screen.getByLabelText('Backup file'),
      createBackupFile(validBackup),
    )
    await screen.findByRole('status', { name: 'Data management feedback' })
    await user.click(
      screen.getByRole('button', { name: 'Restore full backup' }),
    )

    expect(
      screen.getByRole('dialog', { name: 'Restore full backup?' }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Confirm restore' }))

    expect(sendMessage).toHaveBeenCalledWith('backup.restoreFullBackup', {
      surface: 'dashboard',
      backup: validBackup,
    })
    expect(
      await screen.findByRole('status', { name: 'Data management feedback' }),
    ).toHaveTextContent('Backup restored.')
    expect(screen.getByText('No backup file selected')).toBeVisible()
    expect(screen.queryByText('Schema version: 1')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Restore full backup' }),
    ).not.toBeInTheDocument()
  })

  it('offers a backup export inside the clear confirmation dialog', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'backup.exportFullBackup') {
        return Promise.resolve(validBackup)
      }

      return Promise.reject(new Error(`Unexpected method ${method}`))
    })
    const { wrapper } = createQueryTestHarness()

    render(<DataManagementScreen />, { wrapper })

    expect(
      screen.queryByRole('button', { name: 'Export current backup' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear local data' }))

    const dialog = screen.getByRole('dialog', { name: 'Clear local data?' })
    expect(dialog).toHaveTextContent('Are you sure?')

    await user.click(
      within(dialog).getByRole('button', { name: 'Export backup first' }),
    )

    expect(sendMessage).toHaveBeenCalledWith('backup.exportFullBackup', {
      surface: 'dashboard',
    })
    const exportedButton = await within(dialog).findByRole('button', {
      name: 'Backup exported',
    })
    expect(exportedButton).toHaveAttribute('data-cp-tone', 'success')
    expect(
      within(dialog).queryByText('Backup exported.'),
    ).not.toBeInTheDocument()
  })

  it('cancels and confirms clearing local data through a confirmation dialog', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockResolvedValue(null)
    const { wrapper } = createQueryTestHarness()

    render(<DataManagementScreen />, { wrapper })

    await user.click(screen.getByRole('button', { name: 'Clear local data' }))

    expect(
      screen.getByRole('dialog', { name: 'Clear local data?' }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Clear local data?' }),
      ).not.toBeInTheDocument()
    })
    expect(sendMessage).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Clear local data' }))
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Clear local data?' }),
      ).getByRole('button', { name: 'Clear local data' }),
    )

    expect(sendMessage).toHaveBeenCalledWith('backup.resetLocalData', {
      surface: 'dashboard',
    })
  })
})

function createBackupFile(backup: BackupFile) {
  return new File([JSON.stringify(backup)], 'backup.json', {
    type: 'application/json',
  })
}

function formatExpectedDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

const validSummary = {
  schemaVersion: 1,
  exportedAt: '2026-05-25T12:00:00.000Z',
  source: {
    appVersion: '0.0.0',
  },
  counts: {
    problems: 1,
    topics: 1,
    companies: 1,
    problemTopics: 1,
    problemCompanies: 1,
    problemPractice: 1,
    fsrsCards: 1,
    reviewAttempts: 1,
    tracks: 1,
    trackGroups: 1,
    trackMemberships: 1,
    trackProgress: 1,
    trackSession: 1,
    settings: 1,
  },
} satisfies BackupSummary

const validBackup = {
  schemaVersion: 1,
  app: 'cognipace',
  exportedAt: '2026-05-25T12:00:00.000Z',
  source: {},
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
} satisfies BackupFile
