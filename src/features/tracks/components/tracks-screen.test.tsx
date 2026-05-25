import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pencil, Plus } from 'lucide-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
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

  it('renders all tracks expanded when no active track is selected', async () => {
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
    expect(screen.getByRole('region', { name: 'All tracks' })).toBeVisible()
    expect(screen.getByText('All tracks')).toBeVisible()
    expect(screen.getByText('Grind 75')).toBeVisible()

    const allTracksActions = screen.getByLabelText('All tracks actions')

    expect(
      within(allTracksActions).getByRole('link', { name: 'New Track' }),
    ).toHaveAttribute('href', '#/tracks/new')
    expect(
      within(allTracksActions).getByRole('button', {
        name: 'All tracks shown',
      }),
    ).toBeDisabled()
  })

  it('renders the active workspace title, summaries, metrics, groups, and active rows', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(twoGroupWorkspace)
    renderTracksScreen()

    expect(
      await screen.findByRole('heading', { name: 'LeetCode 75' }),
    ).toBeVisible()
    expect(screen.getByText('Core interview practice.')).toBeVisible()
    const progressSummary = screen.getByLabelText('Track progress summary')
    expect(within(progressSummary).getByText('Progress')).toBeVisible()
    expect(within(progressSummary).getByText('1 of 3')).toBeVisible()
    expect(within(progressSummary).getByText('2 problems left')).toBeVisible()
    expect(within(progressSummary).getByLabelText('33% complete')).toBeVisible()
    expect(screen.queryByLabelText('Progress metric')).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText('Track target summary'),
    ).not.toBeInTheDocument()
    const dueMetric = screen.getByLabelText('Due reviews metric')
    expect(within(dueMetric).getByText('Due Reviews')).toBeVisible()
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
      screen.getByRole('tab', {
        name: 'Arrays and Hashing, 1 of 2 completed',
      }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByRole('tab', {
        name: 'Dynamic Programming, 0 of 1 completed',
      }),
    ).toBeVisible()
    expect(screen.getByRole('tablist', { name: 'Track groups' })).toBeVisible()
    expect(getTrackProblemRow('Two Sum')).toBeVisible()
    expect(getTrackProblemRow('Binary Search')).toBeVisible()
    expect(queryTrackProblemRow('Maximum Subarray')).not.toBeInTheDocument()
  })

  it('renders track completion separately from review status', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(twoGroupWorkspace)
    renderTracksScreen()

    expect(
      await screen.findByRole('columnheader', { name: 'Completed' }),
    ).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Review' })).toBeVisible()
    expect(screen.queryByRole('columnheader', { name: 'Track' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Status' })).toBeNull()

    const incompleteBadge = within(getTrackProblemRow('Two Sum')).getByText(
      'No',
    )

    expect(incompleteBadge).toBeVisible()
    expect(incompleteBadge).toHaveAttribute('data-cp-track-completed', 'false')
    expect(incompleteBadge).toHaveAttribute('data-cp-tone', 'danger')
    expect(within(getTrackProblemRow('Two Sum')).getByText('Due')).toBeVisible()
    const completedBadge = within(
      getTrackProblemRow('Binary Search'),
    ).getByText('Yes')

    expect(completedBadge).toBeVisible()
    expect(completedBadge).toHaveAttribute('data-cp-track-completed', 'true')
    expect(completedBadge).toHaveAttribute('data-cp-tone', 'success')
    expect(
      within(getTrackProblemRow('Binary Search')).getByText('Scheduled'),
    ).toBeVisible()
  })

  it('formats target summary and catalog metadata without local timezone drift', async () => {
    const dueAt = '2026-06-15T00:00:00.000Z'
    const activeTrack = twoGroupWorkspace.activeTrack

    if (!activeTrack) {
      throw new Error('Expected active track fixture.')
    }

    vi.mocked(sendMessage).mockResolvedValueOnce({
      ...twoGroupWorkspace,
      generatedAt: '2026-06-01T12:00:00.000Z',
      activeTrack: {
        ...activeTrack,
        track: {
          ...activeTrack.track,
          dueAt,
        },
      },
      tracks: twoGroupWorkspace.tracks.map((row) =>
        row.track.id === 'grind-75'
          ? {
              ...row,
              track: {
                ...row.track,
                dueAt,
              },
            }
          : row,
      ),
    })
    renderTracksScreen()

    const targetSummary = await screen.findByLabelText('Track target summary')

    expect(within(targetSummary).getByText('Target')).toBeVisible()
    expect(within(targetSummary).getByText('Jun 15, 2026')).toBeVisible()
    expect(within(targetSummary).getByText('14 days left')).toBeVisible()
    expect(targetSummary).toHaveAttribute('data-cp-tone', 'success')
    expect(screen.queryByText('Due Jun 15, 2026')).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Show all tracks' }),
    )

    expect(screen.getAllByText('Target Jun 15 · 14 days left')).toHaveLength(1)
  })

  it('labels due count as due reviews instead of track target date', async () => {
    const activeTrack = twoGroupWorkspace.activeTrack

    if (!activeTrack) {
      throw new Error('Expected active track fixture.')
    }

    vi.mocked(sendMessage).mockResolvedValueOnce({
      ...twoGroupWorkspace,
      generatedAt: '2026-06-01T12:00:00.000Z',
      dueCount: 0,
      activeTrack: {
        ...activeTrack,
        track: {
          ...activeTrack.track,
          dueAt: '2026-06-15T00:00:00.000Z',
        },
      },
    })
    renderTracksScreen()

    const dueMetric = await screen.findByLabelText('Due reviews metric')

    expect(within(dueMetric).getByText('Due Reviews')).toBeVisible()
    expect(dueMetric).toHaveTextContent('0')
    expect(
      within(dueMetric).queryByText('Jun 15, 2026'),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Track target summary')).toHaveTextContent(
      'Jun 15, 2026',
    )
  })

  it('marks overdue track targets without making the row an error state', async () => {
    const user = userEvent.setup()
    const activeTrack = twoGroupWorkspace.activeTrack

    if (!activeTrack) {
      throw new Error('Expected active track fixture.')
    }

    vi.mocked(sendMessage).mockResolvedValueOnce({
      ...twoGroupWorkspace,
      generatedAt: '2026-06-01T12:00:00.000Z',
      activeTrack: {
        ...activeTrack,
        track: {
          ...activeTrack.track,
          dueAt: '2026-05-21T00:00:00.000Z',
        },
      },
      tracks: twoGroupWorkspace.tracks.map((row) => ({
        ...row,
        track: {
          ...row.track,
          dueAt: '2026-05-21T00:00:00.000Z',
        },
      })),
    })
    renderTracksScreen()

    const targetSummary = await screen.findByLabelText('Track target summary')

    expect(targetSummary).toHaveAttribute('data-cp-tone', 'danger')
    expect(within(targetSummary).getByText('Overdue')).toBeVisible()
    expect(within(targetSummary).getByText('11 days late')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Show all tracks' }))

    const overdueMetadata = screen.getAllByText(
      'Target May 21 · Overdue · 11 days late',
    )
    expect(overdueMetadata).toHaveLength(2)
    for (const metadata of overdueMetadata) {
      expect(metadata).toHaveAttribute('data-cp-tone', 'danger')
    }
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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
      await screen.findByRole('tab', {
        name: 'Dynamic Programming, 0 of 1 completed',
      }),
    )

    expect(sendMessage).toHaveBeenCalledWith('tracks.setActiveGroup', {
      surface: 'dashboard',
      trackId: 'leetcode-75',
      groupId: 'leetcode-75:dynamic-programming',
    })
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
      await screen.findByRole('button', { name: 'Show all tracks' }),
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

  it('clears the active track from the active workspace header', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'tracks.getWorkspace') {
        return Promise.resolve(twoGroupWorkspace)
      }

      return Promise.resolve(null)
    })

    renderTracksScreen()

    await screen.findByRole('heading', { name: 'LeetCode 75' })
    const clearActiveButton = screen.getByRole('button', {
      name: 'Clear Active',
    })
    const activeHeaderActions = screen.getByLabelText(
      'LeetCode 75 track actions',
    )

    expect(
      within(activeHeaderActions).getByRole('link', { name: 'Edit Track' }),
    ).toHaveAttribute('href', '#/tracks/leetcode-75/edit')
    expect(
      within(activeHeaderActions).getByRole('button', {
        name: 'Reset Progress',
      }),
    ).toBeVisible()
    expect(
      within(activeHeaderActions).getByRole('button', { name: 'Delete Track' }),
    ).toBeVisible()

    await user.click(clearActiveButton)

    expect(sendMessage).toHaveBeenCalledWith('tracks.clearActiveTrack', {
      surface: 'dashboard',
    })
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
        <IconButton
          asChild
          label="Edit Track"
          size="sm"
          tooltip="Edit Track"
          variant="ghost"
        >
          <a href={`#/tracks/${track.id}/edit`}>
            <Pencil aria-hidden="true" />
          </a>
        </IconButton>
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
