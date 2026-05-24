import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Plus } from 'lucide-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/button'
import { sendMessage } from '@/extension/messaging'
import type { SerializedProblem } from '@/features/problems'
import {
  createSerializedTrack,
  createSerializedTrackGroup,
  createTrackProblemRow,
  createTrackWorkspaceResponse,
} from '@/testing/track-fixtures'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { TracksScreen } from './tracks-screen'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('TracksScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the loading state', () => {
    vi.mocked(sendMessage).mockReturnValueOnce(new Promise(() => undefined))
    renderTracksScreen()

    expect(screen.getByText('Loading tracks…')).toBeVisible()
  })

  it('renders the error state with Retry', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(createTrackWorkspaceResponse())

    renderTracksScreen()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load tracks.',
    )

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(sendMessage).toHaveBeenCalledTimes(2)
  })

  it('renders the no tracks empty state', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      createTrackWorkspaceResponse({
        activeTrack: null,
        activeTrackGroups: [],
        activeTrackRows: [],
        tracks: [],
      }),
    )

    renderTracksScreen()

    expect(await screen.findByText('No tracks yet.')).toBeVisible()
    expect(screen.getByRole('link', { name: 'New Track' })).toHaveAttribute(
      'href',
      '#/tracks/new',
    )
  })

  it('renders a no active track selected state when other tracks exist', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      createTrackWorkspaceResponse({
        activeTrack: null,
        activeTrackGroups: [],
        activeTrackRows: [],
        tracks: [
          {
            track: createSerializedTrack({
              id: 'grind-75',
              slug: 'grind-75',
              title: 'Grind 75',
            }),
            progress: {
              completedCount: 10,
              totalCount: 75,
              percent: 13,
            },
          },
        ],
      }),
    )

    renderTracksScreen()

    expect(await screen.findByText('No active track selected.')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Show other tracks' }),
    ).toBeVisible()
  })

  it('renders the active workspace title, metrics, groups, and active rows', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(twoGroupWorkspace)
    renderTracksScreen()

    expect(
      await screen.findByRole('heading', { name: 'LeetCode 75' }),
    ).toBeVisible()
    expect(screen.getByText('Core interview practice.')).toBeVisible()
    expect(screen.getByText('Progress')).toBeVisible()
    expect(screen.getByText('1 of 3')).toBeVisible()
    expect(screen.getByText('33%')).toBeVisible()
    const dueMetric = screen.getByLabelText('Due metric')
    expect(within(dueMetric).getByText('Due')).toBeVisible()
    expect(dueMetric).toHaveTextContent('2')
    expect(screen.getByText('Next')).toBeVisible()
    expect(screen.getAllByRole('link', { name: 'Two Sum' })[0]).toHaveAttribute(
      'href',
      'https://leetcode.com/problems/two-sum/',
    )
    expect(
      screen.queryByRole('link', { name: 'Open Next' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Arrays and Hashing' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Dynamic Programming' }),
    ).toBeVisible()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(getTrackProblemRow('Two Sum')).toBeVisible()
    expect(getTrackProblemRow('Binary Search')).toBeVisible()
    expect(queryTrackProblemRow('Maximum Subarray')).not.toBeInTheDocument()
  })

  it('lets long active track copy wrap before it can crowd header actions', async () => {
    const longTitle = `Track ${'A'.repeat(80)}`
    const longDescription = `Description ${'B'.repeat(100)}`
    const activeTrack = twoGroupWorkspace.activeTrack

    if (!activeTrack) {
      throw new Error('Expected active track fixture.')
    }

    vi.mocked(sendMessage).mockResolvedValueOnce({
      ...twoGroupWorkspace,
      activeTrack: {
        ...activeTrack,
        track: {
          ...activeTrack.track,
          description: longDescription,
          title: longTitle,
        },
      },
    })
    renderTracksScreen()

    expect(
      await screen.findByRole('heading', { name: longTitle }),
    ).toHaveClass('break-words')
    expect(screen.getByText(longDescription)).toHaveClass('break-words')
  })

  it('constrains long active group labels inside their buttons', async () => {
    const longGroupTitle = `Group ${'D'.repeat(90)}`
    const activeTrack = twoGroupWorkspace.activeTrack
    const activeGroup = activeTrack?.activeGroup

    if (!activeTrack || !activeGroup) {
      throw new Error('Expected active group fixture.')
    }

    vi.mocked(sendMessage).mockResolvedValueOnce({
      ...twoGroupWorkspace,
      activeTrack: {
        ...activeTrack,
        activeGroup: {
          ...activeGroup,
          title: longGroupTitle,
        },
      },
      activeTrackGroups: twoGroupWorkspace.activeTrackGroups.map((group) =>
        group.id === activeGroup.id ? { ...group, title: longGroupTitle } : group,
      ),
    })
    renderTracksScreen()

    const activeGroupButton = await screen.findByRole('button', {
      name: longGroupTitle,
    })

    expect(activeGroupButton).toHaveAttribute('aria-pressed', 'true')
    expect(within(activeGroupButton).getByText(longGroupTitle)).toHaveClass(
      'min-w-0',
      'max-w-full',
      'truncate',
    )
  })

  it('hides group tabs for a single-group track', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(createTrackWorkspaceResponse())
    renderTracksScreen()

    expect(await getTrackProblemRowAsync('Two Sum')).toBeVisible()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  it('sets the active group from the group buttons', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'tracks.getWorkspace') {
        return Promise.resolve(twoGroupWorkspace)
      }

      return Promise.resolve(null)
    })

    renderTracksScreen()

    await user.click(
      await screen.findByRole('button', { name: 'Dynamic Programming' }),
    )

    expect(sendMessage).toHaveBeenCalledWith('tracks.setActiveGroup', {
      surface: 'dashboard',
      trackId: 'leetcode-75',
      groupId: 'leetcode-75:dynamic-programming',
    })
  })

  it('keeps other tracks collapsed by default and summary-only when expanded', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockResolvedValueOnce(twoGroupWorkspace)
    renderTracksScreen()

    const otherTracksButton = await screen.findByRole('button', {
      name: 'Show other tracks',
    })
    expect(screen.queryByText('Grind 75')).not.toBeInTheDocument()

    await user.click(otherTracksButton)

    expect(
      screen.getByRole('button', { name: 'Hide other tracks' }),
    ).toBeVisible()
    expect(screen.getByText('Grind 75')).toBeVisible()
    expect(screen.getByText('10 of 75')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Set Grind 75 active' }),
    ).toBeVisible()
    expect(
      queryTrackProblemRow('Container With Most Water'),
    ).not.toBeInTheDocument()
  })

  it('sets another track active without rendering inactive track tables', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'tracks.getWorkspace') {
        return Promise.resolve(twoGroupWorkspace)
      }

      return Promise.resolve(null)
    })

    renderTracksScreen()

    await user.click(
      await screen.findByRole('button', { name: 'Show other tracks' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Set Grind 75 active' }),
    )

    expect(sendMessage).toHaveBeenCalledWith('tracks.setActiveTrack', {
      surface: 'dashboard',
      trackId: 'grind-75',
    })
    expect(
      queryTrackProblemRow('Container With Most Water'),
    ).not.toBeInTheDocument()
  })

  it('uses local confirmation dialogs for Delete and Reset Progress', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'tracks.getWorkspace') {
        return Promise.resolve(twoGroupWorkspace)
      }

      return Promise.resolve(null)
    })

    renderTracksScreen()

    await screen.findByRole('heading', { name: 'LeetCode 75' })

    await user.click(screen.getByRole('button', { name: 'Reset Progress' }))
    const resetDialog = screen.getByRole('dialog', {
      name: 'Reset track progress?',
    })
    expect(resetDialog).toBeVisible()
    await user.click(
      within(resetDialog).getByRole('button', { name: 'Reset Progress' }),
    )
    expect(sendMessage).toHaveBeenCalledWith('tracks.resetTrackProgress', {
      surface: 'dashboard',
      trackId: 'leetcode-75',
    })

    await user.click(screen.getByRole('button', { name: 'Delete Track' }))
    const deleteDialog = screen.getByRole('dialog', { name: 'Delete track?' })
    expect(deleteDialog).toBeVisible()
    await user.click(
      within(deleteDialog).getByRole('button', { name: 'Delete Track' }),
    )
    expect(sendMessage).toHaveBeenCalledWith('tracks.deleteTrack', {
      surface: 'dashboard',
      trackId: 'leetcode-75',
    })
  })

  it('shows delete and reset rejection errors inside the confirmation dialog', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'tracks.getWorkspace') {
        return Promise.resolve(twoGroupWorkspace)
      }

      if (method === 'tracks.resetTrackProgress') {
        return Promise.reject(new Error('Reset failed'))
      }

      if (method === 'tracks.deleteTrack') {
        return Promise.reject(new Error('Delete failed'))
      }

      return Promise.resolve(null)
    })

    renderTracksScreen()

    await screen.findByRole('heading', { name: 'LeetCode 75' })

    await user.click(screen.getByRole('button', { name: 'Reset Progress' }))
    const resetDialog = screen.getByRole('dialog', {
      name: 'Reset track progress?',
    })
    await user.click(
      within(resetDialog).getByRole('button', { name: 'Reset Progress' }),
    )
    expect(await within(resetDialog).findByRole('alert')).toHaveTextContent(
      'Reset failed',
    )
    await user.click(
      within(resetDialog).getByRole('button', { name: 'Cancel' }),
    )

    await user.click(screen.getByRole('button', { name: 'Delete Track' }))
    const deleteDialog = screen.getByRole('dialog', { name: 'Delete track?' })
    await user.click(
      within(deleteDialog).getByRole('button', { name: 'Delete Track' }),
    )
    expect(await within(deleteDialog).findByRole('alert')).toHaveTextContent(
      'Delete failed',
    )
  })

  it('traps confirmation focus, closes with Escape, and restores focus', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'tracks.getWorkspace') {
        return Promise.resolve(twoGroupWorkspace)
      }

      return Promise.resolve(null)
    })

    renderTracksScreen()

    await screen.findByRole('heading', { name: 'LeetCode 75' })
    const resetButton = screen.getByRole('button', { name: 'Reset Progress' })

    await user.click(resetButton)
    const resetDialog = screen.getByRole('dialog', {
      name: 'Reset track progress?',
    })
    const cancelButton = within(resetDialog).getByRole('button', {
      name: 'Cancel',
    })
    const confirmButton = within(resetDialog).getByRole('button', {
      name: 'Reset Progress',
    })

    expect(cancelButton).toHaveFocus()

    await user.tab()
    expect(confirmButton).toHaveFocus()

    await user.tab()
    expect(cancelButton).toHaveFocus()

    await user.tab({ shift: true })
    expect(confirmButton).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('dialog', { name: 'Reset track progress?' }),
    ).not.toBeInTheDocument()
    expect(resetButton).toHaveFocus()
  })

  it('keeps confirmation focus stable while an action is pending', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'tracks.getWorkspace') {
        return Promise.resolve(twoGroupWorkspace)
      }

      if (method === 'tracks.resetTrackProgress') {
        return new Promise(() => undefined)
      }

      return Promise.resolve(null)
    })

    renderTracksScreen()

    await screen.findByRole('heading', { name: 'LeetCode 75' })
    await user.click(screen.getByRole('button', { name: 'Reset Progress' }))

    const resetDialog = screen.getByRole('dialog', {
      name: 'Reset track progress?',
    })
    await user.click(
      within(resetDialog).getByRole('button', { name: 'Reset Progress' }),
    )

    await waitFor(() => {
      expect(resetDialog).toHaveAttribute('aria-busy', 'true')
    })
    expect(resetDialog).toHaveFocus()
    expect(
      within(resetDialog).getByRole('button', { name: 'Reset Progress' }),
    ).toBeDisabled()
  })

  it('expands problem rows with reusable practice actions and no global Delete', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'tracks.getWorkspace') {
        return Promise.resolve(twoGroupWorkspace)
      }

      return Promise.resolve(null)
    })

    renderTracksScreen()

    await user.click(
      await screen.findByRole('button', { name: 'Expand Two Sum' }),
    )

    expect(screen.getByRole('heading', { name: 'Details' })).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Analytics and history' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '#/library/problems/two-sum/edit',
    )
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Reset Schedule' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })
})

function renderTracksScreen() {
  const { wrapper } = createQueryTestHarness()

  return render(
    <TracksScreen
      newTrackAction={
        <Button asChild size="sm">
          <a href="#/tracks/new">
            <Plus aria-hidden="true" />
            New Track
          </a>
        </Button>
      }
      renderEditProblemAction={(problem: SerializedProblem) => (
        <Button asChild size="sm" variant="ghost">
          <a href={`#/library/problems/${problem.slug}/edit`}>Edit</a>
        </Button>
      )}
      renderEditTrackAction={(track) => (
        <Button asChild size="sm" variant="ghost">
          <a href={`#/tracks/${track.id}/edit`}>Edit Track</a>
        </Button>
      )}
    />,
    { wrapper },
  )
}

function getTrackProblemRow(title: string) {
  return screen.getByRole('row', { name: new RegExp(title, 'i') })
}

function queryTrackProblemRow(title: string) {
  return screen.queryByRole('row', { name: new RegExp(title, 'i') })
}

async function getTrackProblemRowAsync(title: string) {
  await waitFor(() => {
    expect(getTrackProblemRow(title)).toBeVisible()
  })

  return getTrackProblemRow(title)
}

const twoGroupWorkspace = createTrackWorkspaceResponse({
  activeTrack: {
    track: createSerializedTrack({
      description: 'Core interview practice.',
      id: 'leetcode-75',
      slug: 'leetcode-75',
      title: 'LeetCode 75',
    }),
    activeGroup: createSerializedTrackGroup({
      id: 'leetcode-75:arrays-hashing',
      title: 'Arrays and Hashing',
    }),
    progress: {
      completedCount: 1,
      totalCount: 3,
      percent: 33,
    },
    nextProblem: {
      slug: 'two-sum',
      title: 'Two Sum',
      difficulty: 'easy',
      isPremium: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  },
  activeTrackGroups: [
    createSerializedTrackGroup({
      id: 'leetcode-75:arrays-hashing',
      title: 'Arrays and Hashing',
      position: 1,
    }),
    createSerializedTrackGroup({
      id: 'leetcode-75:dynamic-programming',
      title: 'Dynamic Programming',
      position: 2,
    }),
  ],
  activeTrackRows: [
    createTrackProblemRow({
      problem: {
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'easy',
        isPremium: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      status: 'due',
      nextReviewAt: '2026-01-02T00:00:00.000Z',
      lastReviewedAt: '2026-01-01T00:00:00.000Z',
      membership: {
        trackId: 'leetcode-75',
        groupId: 'leetcode-75:arrays-hashing',
        groupTitle: 'Arrays and Hashing',
        groupPosition: 1,
        problemPosition: 1,
        completedAt: null,
        completedRating: null,
      },
      trackMemberships: [
        {
          trackId: 'leetcode-75',
          trackSlug: 'leetcode-75',
          trackTitle: 'LeetCode 75',
          groupId: 'leetcode-75:arrays-hashing',
          groupTitle: 'Arrays and Hashing',
          groupPosition: 1,
          problemPosition: 1,
        },
      ],
    }),
    createTrackProblemRow({
      problem: {
        slug: 'binary-search',
        title: 'Binary Search',
        difficulty: 'easy',
        isPremium: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      status: 'scheduled',
      membership: {
        trackId: 'leetcode-75',
        groupId: 'leetcode-75:arrays-hashing',
        groupTitle: 'Arrays and Hashing',
        groupPosition: 1,
        problemPosition: 2,
        completedAt: '2026-01-01T00:00:00.000Z',
        completedRating: 'good',
      },
    }),
    createTrackProblemRow({
      problem: {
        slug: 'maximum-subarray',
        title: 'Maximum Subarray',
        difficulty: 'medium',
        isPremium: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      status: 'not-started',
      membership: {
        trackId: 'leetcode-75',
        groupId: 'leetcode-75:dynamic-programming',
        groupTitle: 'Dynamic Programming',
        groupPosition: 2,
        problemPosition: 1,
        completedAt: null,
        completedRating: null,
      },
    }),
  ],
  dueCount: 2,
  tracks: [
    {
      track: createSerializedTrack({
        id: 'leetcode-75',
        slug: 'leetcode-75',
        title: 'LeetCode 75',
      }),
      progress: {
        completedCount: 1,
        totalCount: 3,
        percent: 33,
      },
    },
    {
      track: createSerializedTrack({
        id: 'grind-75',
        slug: 'grind-75',
        title: 'Grind 75',
      }),
      progress: {
        completedCount: 10,
        totalCount: 75,
        percent: 13,
      },
    },
  ],
})
