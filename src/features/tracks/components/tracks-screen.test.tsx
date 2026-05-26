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

  it('renders the active workspace contract', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(twoGroupWorkspace)
    renderTracksScreen()

    expect(
      await screen.findByRole('heading', { name: 'LeetCode 75' }),
    ).toBeVisible()
    expect(screen.getByLabelText('Track progress summary')).toHaveTextContent(
      '1 of 3',
    )
    expect(screen.getByLabelText('Due reviews metric')).toHaveTextContent('2')
    expect(screen.getAllByRole('link', { name: 'Two Sum' })[0]).toHaveAttribute(
      'href',
      'https://leetcode.com/problems/two-sum/',
    )
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
    expect(getTrackProblemRow('Two Sum')).toBeVisible()
    expect(getTrackProblemRow('Binary Search')).toBeVisible()
    expect(queryTrackProblemRow('Maximum Subarray')).not.toBeInTheDocument()
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

    expect(within(targetSummary).getByText('Jun 15, 2026')).toBeVisible()
    expect(within(targetSummary).getByText('14 days left')).toBeVisible()

    await userEvent.click(
      screen.getByRole('button', { name: 'Show all tracks' }),
    )

    expect(screen.getAllByText('Target Jun 15 · 14 days left')).toHaveLength(1)
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

  it('keeps destructive mutation errors inside the confirmation dialog', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'tracks.getWorkspace') {
        return Promise.resolve(twoGroupWorkspace)
      }

      if (method === 'tracks.deleteTrack') {
        return Promise.reject(new Error('Delete failed'))
      }

      return Promise.resolve(null)
    })

    renderTracksScreen()

    await screen.findByRole('heading', { name: 'LeetCode 75' })

    await user.click(screen.getByRole('button', { name: 'Delete Track' }))
    const deleteDialog = screen.getByRole('dialog', { name: 'Delete track?' })
    await user.click(
      within(deleteDialog).getByRole('button', { name: 'Delete Track' }),
    )
    expect(await within(deleteDialog).findByRole('alert')).toHaveTextContent(
      'Delete failed',
    )
    expect(sendMessage).toHaveBeenCalledWith('tracks.deleteTrack', {
      surface: 'dashboard',
      trackId: 'leetcode-75',
    })
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
