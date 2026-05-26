import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import {
  createAppShellQueueItem,
  createDashboardAppShellData,
} from '@/testing/app-shell-fixtures'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { OverviewScreen } from './overview-screen'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('OverviewScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a populated due-review recommendation with practice progress', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(createDashboardAppShellData())

    renderOverviewScreen()

    expect(
      await screen.findByRole('heading', { name: 'Add Binary' }),
    ).toBeVisible()
    const primaryPanel = screen.getByRole('region', { name: 'Review Now' })

    expect(within(primaryPanel).getByText('Due')).toBeVisible()
    expect(within(primaryPanel).getByText('Overdue')).toBeVisible()
    expect(within(primaryPanel).getByText('Easy')).toBeVisible()
    expect(
      within(primaryPanel).getByRole('link', { name: 'Open Problem' }),
    ).toHaveAttribute('href', 'https://leetcode.com/problems/add-binary/')

    const completedTodayMetric = screen.getByLabelText('Completed Today metric')

    expect(
      within(completedTodayMetric).getByText('Completed Today'),
    ).toBeVisible()
    expect(within(completedTodayMetric).getByText('1/4')).toBeVisible()
  })

  it('renders queue clear as the primary action while keeping active-track next visible', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      createDashboardAppShellData({
        recommendation: {
          title: 'Queue is clear',
          detail: 'No due reviews or extra practice are queued right now.',
          category: null,
          problem: null,
          dueAt: null,
        },
        queue: {
          dailyGoal: 4,
          dueCount: 0,
          newCount: 0,
          reinforcementCount: 0,
          items: [],
        },
        overview: {
          practiceProgress: {
            completedToday: 4,
            dailyGoal: 4,
            currentStreak: 3,
            goalMetToday: true,
            todayDateKey: '2026-05-25',
          },
          queuePreview: [],
        },
        dashboard: {
          queuePreview: [],
        },
      }),
    )

    renderOverviewScreen()

    expect(
      await screen.findByRole('heading', { name: 'Queue Clear' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open Library' })).toHaveAttribute(
      'href',
      '#/library',
    )
    expect(
      screen.getByRole('heading', {
        name: 'ByteByteGo Coding Patterns 101',
      }),
    ).toBeVisible()
    expect(screen.getByText('Pair Sum - Sorted')).toBeVisible()
  })

  it('renders active-track and queue preview problem actions', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      createDashboardAppShellData({
        overview: {
          practiceProgress: {
            completedToday: 1,
            dailyGoal: 4,
            currentStreak: 0,
            goalMetToday: false,
            todayDateKey: '2026-05-25',
          },
          queuePreview: [
            createAppShellQueueItem({
              problem: {
                problemSlug: 'jump-game-iv',
                title: 'Jump Game IV',
                difficulty: 'hard',
                isPremium: false,
              },
            }),
          ],
        },
      }),
    )

    renderOverviewScreen()

    expect(
      await screen.findByRole('heading', {
        name: 'ByteByteGo Coding Patterns 101',
      }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Continue Path' })).toHaveAttribute(
      'href',
      'https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/',
    )

    const todayQueue = screen.getByRole('region', { name: 'Today Queue' })

    expect(within(todayQueue).getAllByText('Today Queue')).toHaveLength(1)
    expect(within(todayQueue).getByText('Jump Game IV')).toBeVisible()
    expect(within(todayQueue).getByText('Showing 1')).toBeVisible()
    expect(
      within(todayQueue).getByRole('link', { name: 'Open Jump Game IV' }),
    ).toHaveAttribute('href', 'https://leetcode.com/problems/jump-game-iv/')
  })
})

function renderOverviewScreen() {
  const harness = createQueryTestHarness()

  render(
    <OverviewScreen
      libraryAction={<a href="#/library">Open Library</a>}
      tracksAction={<a href="#/tracks">Open Tracks</a>}
    />,
    { wrapper: harness.wrapper },
  )

  return harness
}
