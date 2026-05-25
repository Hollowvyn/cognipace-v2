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

    await user.click(screen.getByRole('button', { name: 'Export backup' }))

    expect(sendMessage).toHaveBeenCalledWith('backup.exportFullBackup', {
      surface: 'dashboard',
    })
    expect(await screen.findByText('Backup exported.')).toBeVisible()
  })

  it('validates an imported backup and shows summary counts', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockResolvedValue(validSummary)
    const { wrapper } = createQueryTestHarness()

    render(<DataManagementScreen />, { wrapper })

    await user.upload(
      screen.getByLabelText('Import full backup'),
      createBackupFile(validBackup),
    )

    expect(sendMessage).toHaveBeenCalledWith('backup.validateFullBackup', {
      surface: 'dashboard',
      backup: validBackup,
    })
    expect(await screen.findByText('Backup ready to restore')).toBeVisible()
    expect(screen.getByText('Schema version: 1')).toBeVisible()
    expect(screen.getByText('Exported: 2026-05-25T12:00:00.000Z')).toBeVisible()
    expect(screen.getByText('App version: 0.0.0')).toBeVisible()
    expect(screen.getByText('Problems: 1')).toBeVisible()
    expect(screen.getByText('Tracks: 1')).toBeVisible()
  })

  it('shows an alert for invalid JSON without calling runtime validation', async () => {
    const user = userEvent.setup()
    const { wrapper } = createQueryTestHarness()

    render(<DataManagementScreen />, { wrapper })

    await user.upload(
      screen.getByLabelText('Import full backup'),
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
      screen.getByLabelText('Import full backup'),
      createBackupFile(validBackup),
    )
    await screen.findByText('Backup ready to restore')
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
    expect(await screen.findByText('Backup restored.')).toBeVisible()
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
    expect(await within(dialog).findByText('Backup exported.')).toBeVisible()
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
    problems: [
      {
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'easy',
        isPremium: false,
        createdAt: '2026-05-25T12:00:00.000Z',
        updatedAt: '2026-05-25T12:00:00.000Z',
      },
    ],
    topics: [{ id: 'array', label: 'Array' }],
    companies: [{ id: 'meta', label: 'Meta' }],
    problemTopics: [{ problemSlug: 'two-sum', topicId: 'array' }],
    problemCompanies: [{ problemSlug: 'two-sum', companyId: 'meta' }],
    practice: {
      problemPractice: [
        {
          problemSlug: 'two-sum',
          status: 'review',
          firstSeenAt: '2026-05-25T12:00:00.000Z',
          lastSeenAt: '2026-05-25T12:00:00.000Z',
          lastReviewedAt: '2026-05-25T12:00:00.000Z',
          lastRating: 'good',
          lastElapsedSeconds: 600,
          bestElapsedSeconds: 600,
          interviewPattern: 'hash-map',
          timeComplexity: 'O(n)',
          spaceComplexity: 'O(n)',
          languages: 'TypeScript',
          notes: 'review note',
          solvedCount: 1,
          attemptCount: 1,
          isSuspended: false,
          createdAt: '2026-05-25T12:00:00.000Z',
          updatedAt: '2026-05-25T12:00:00.000Z',
        },
      ],
      fsrsCards: [
        {
          id: 'card-1',
          problemSlug: 'two-sum',
          cardKind: 'default',
          dueAt: '2026-05-26T12:00:00.000Z',
          stability: 2.5,
          difficulty: 4.5,
          elapsedDays: 0,
          scheduledDays: 1,
          learningSteps: 0,
          reps: 1,
          lapses: 0,
          state: 'review',
          lastReviewAt: '2026-05-25T12:00:00.000Z',
          createdAt: '2026-05-25T12:00:00.000Z',
          updatedAt: '2026-05-25T12:00:00.000Z',
        },
      ],
      reviewAttempts: [
        {
          id: 'attempt-1',
          problemSlug: 'two-sum',
          cardId: 'card-1',
          rating: 'good',
          reviewMode: 'manual',
          reviewedAt: '2026-05-25T12:00:00.000Z',
          elapsedSeconds: 600,
          isCorrect: true,
          interviewPattern: 'hash-map',
          timeComplexity: 'O(n)',
          spaceComplexity: 'O(n)',
          languages: 'TypeScript',
          notes: 'review note',
          fsrsReviewLog: null,
          createdAt: '2026-05-25T12:00:00.000Z',
          updatedAt: '2026-05-25T12:00:00.000Z',
        },
      ],
    },
    tracks: {
      tracks: [
        {
          id: 'custom-track',
          slug: 'custom-track',
          title: 'Custom Track',
          description: 'A local track',
          dueAt: null,
          createdAt: '2026-05-25T12:00:00.000Z',
          updatedAt: '2026-05-25T12:00:00.000Z',
        },
      ],
      groups: [
        {
          id: 'custom-track:arrays',
          trackId: 'custom-track',
          title: 'Arrays',
          position: 1,
          createdAt: '2026-05-25T12:00:00.000Z',
          updatedAt: '2026-05-25T12:00:00.000Z',
        },
      ],
      memberships: [
        {
          trackGroupId: 'custom-track:arrays',
          problemSlug: 'two-sum',
          position: 1,
        },
      ],
      progress: [
        {
          trackGroupId: 'custom-track:arrays',
          problemSlug: 'two-sum',
          completedAt: '2026-05-25T12:00:00.000Z',
          completedRating: 'good',
          createdAt: '2026-05-25T12:00:00.000Z',
          updatedAt: '2026-05-25T12:00:00.000Z',
        },
      ],
      session: [
        {
          id: 'default',
          activeTrackId: 'custom-track',
          activeGroupId: 'custom-track:arrays',
          startedAt: '2026-05-25T12:00:00.000Z',
          updatedAt: '2026-05-25T12:00:00.000Z',
        },
      ],
    },
    settings: [
      {
        key: 'user-settings',
        value:
          '{"practice":{"dailyGoal":3,"mode":"guided","problemFilters":{"skipPremium":false}},"assessment":{"requireSolveTime":true,"strictTiming":false,"timeTargetsMinutes":{"easy":20,"medium":35,"hard":50}},"overlay":{"defaultMode":"expanded","autoStartTimer":false}}',
        updatedAt: '2026-05-25T12:00:00.000Z',
      },
    ],
  },
} satisfies BackupFile
