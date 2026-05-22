import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { createPopupAppShellView } from '@/features/app-shell'
import type {
  AppShellProblemSummary,
  PopupAppShellController,
  PopupAppShellData,
} from '@/features/app-shell'

import { PopupShell } from './popup-shell'

const twoSum = {
  id: 'leetcode:two-sum',
  slug: 'two-sum',
  title: 'Two Sum',
  difficulty: 'easy',
  url: 'https://leetcode.com/problems/two-sum/',
  isPremium: false,
} satisfies AppShellProblemSummary

const validParentheses = {
  id: 'leetcode:valid-parentheses',
  slug: 'valid-parentheses',
  title: 'Valid Parentheses',
  difficulty: 'easy',
  url: 'https://leetcode.com/problems/valid-parentheses/',
  isPremium: false,
} satisfies AppShellProblemSummary

const shellData = {
  surface: 'popup',
  generatedAt: '2026-01-01T00:00:00.000Z',
  status: {
    label: 'Practice ready',
    detail: '1 due, 1 new, 0 reinforcement available.',
  },
  metrics: [
    { label: 'Due Today', value: '1' },
    { label: 'Streak', value: '0 days' },
  ],
  recommendation: {
    title: 'Valid Parentheses',
    detail: 'Review easy.',
    category: 'due',
    problem: validParentheses,
    dueAt: '2025-12-31T00:00:00.000Z',
  },
  activeTrack: {
    trackId: 'leetcode-75',
    title: 'LeetCode 75',
    description: 'Focused starter track for interview patterns.',
    groupTitle: 'Arrays and Hashing',
    dueAt: '2026-03-01T00:00:00.000Z',
    progress: {
      completedCount: 0,
      totalCount: 1,
      percent: 0,
    },
    detail: 'Next: Two Sum',
    nextProblem: twoSum,
  },
  queue: {
    dailyGoal: 4,
    dueCount: 1,
    newCount: 1,
    reinforcementCount: 0,
    items: [
      {
        category: 'due',
        problem: validParentheses,
        dueAt: '2025-12-31T00:00:00.000Z',
        summary: {
          phase: 'review',
          nextReviewAt: '2025-12-31T00:00:00.000Z',
          lastReviewedAt: '2025-12-01T00:00:00.000Z',
          reviewCount: 1,
          lapses: 0,
          difficulty: 5,
          stability: 1,
          scheduledDays: 1,
          suspended: false,
          isStarted: true,
          isDue: true,
          isOverdue: true,
          overdueDays: 1,
          retrievability: 0.4,
        },
      },
    ],
  },
  settings: {
    studyMode: 'studyPlan',
    timing: {
      requireSolveTime: false,
      hardMode: false,
      easyMinutes: 20,
      mediumMinutes: 35,
      hardMinutes: 50,
    },
    memoryReview: {
      targetRetention: 0.9,
      reviewOrder: 'dueFirst',
    },
    questionFilters: {
      skipPremium: false,
    },
  },
  popup: {
    queuePreview: [],
  },
} satisfies PopupAppShellData

describe('PopupShell', () => {
  it('renders real popup data and routes user actions through callbacks', async () => {
    const user = userEvent.setup()
    const controller = createController()

    render(<PopupShell controller={controller} />)

    expect(
      screen.getByRole('heading', { name: 'CogniPace' }),
    ).toBeInTheDocument()
    const metrics = screen.getByRole('region', { name: 'Practice Metrics' })
    expect(within(metrics).getByText('Due Today')).toBeInTheDocument()
    expect(within(metrics).getByText('0 days')).toBeInTheDocument()

    const recommendation = screen.getByRole('region', {
      name: 'Valid Parentheses',
    })
    expect(within(recommendation).getByText('Due')).toBeInTheDocument()
    expect(within(recommendation).getByText('Easy')).toBeInTheDocument()
    expect(within(recommendation).getByText('Overdue')).toBeInTheDocument()

    const activeTrack = screen.getByRole('region', { name: 'LeetCode 75' })
    expect(within(activeTrack).getByText('Due Mar 1, 2026')).toBeInTheDocument()
    expect(
      within(activeTrack).getByText('Arrays and Hashing'),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Track progress 0 percent complete'),
    ).toBeInTheDocument()
    expect(within(activeTrack).getByText('Two Sum')).toBeInTheDocument()
    expect(
      screen.queryByText(/Open the current best review target/i),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open Settings' }))
    await user.click(screen.getByRole('button', { name: 'Open Tracks' }))
    await user.click(screen.getByRole('button', { name: 'Open Problem' }))
    await user.click(screen.getByRole('button', { name: 'Continue Track' }))
    await user.click(
      screen.getByRole('button', { name: 'Start freestyle mode' }),
    )

    expect(controller.actions.openSettings).toHaveBeenCalledTimes(1)
    expect(controller.actions.openTracks).toHaveBeenCalledTimes(1)
    expect(controller.actions.openProblem).toHaveBeenNthCalledWith(
      1,
      validParentheses,
      'recommendation',
    )
    expect(controller.actions.openProblem).toHaveBeenNthCalledWith(
      2,
      twoSum,
      'track',
    )
    expect(controller.actions.toggleStudyMode).toHaveBeenCalledTimes(1)
  })

  it('shows the shuffle affordance when another recommendation is available', async () => {
    const user = userEvent.setup()
    const controller = createController({ canShuffleRecommendation: true })

    render(<PopupShell controller={controller} />)

    await user.click(
      screen.getByRole('button', { name: 'Shuffle recommendation' }),
    )

    expect(controller.actions.shuffleRecommendation).toHaveBeenCalledTimes(1)
  })

  it('keeps the active-track preview visible in freestyle mode', () => {
    render(
      <PopupShell
        controller={createController({
          data: {
            ...shellData,
            settings: { ...shellData.settings, studyMode: 'freePractice' },
          },
          studyMode: 'freePractice',
        })}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'LeetCode 75' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Start study mode' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Up Next')).toBeInTheDocument()
    expect(screen.getByText('Two Sum')).toBeInTheDocument()
    expect(screen.queryByText('Next in track')).not.toBeInTheDocument()
    expect(screen.getByText('Arrays and Hashing')).toBeInTheDocument()
  })

  it('disables the mode action while study mode is saving', () => {
    render(
      <PopupShell
        controller={createController({ isUpdatingStudyMode: true })}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Start freestyle mode' }),
    ).toBeDisabled()
  })

  it('renders compact empty and no-active-track states', () => {
    render(
      <PopupShell
        controller={createController({
          data: {
            ...shellData,
            recommendation: {
              title: 'Queue is clear',
              detail: 'No due reviews or extra practice are queued right now.',
              category: null,
              problem: null,
              dueAt: null,
            },
            activeTrack: {
              trackId: null,
              title: 'No active track',
              description: null,
              groupTitle: null,
              dueAt: null,
              progress: {
                completedCount: 0,
                totalCount: 0,
                percent: 0,
              },
              detail: 'Choose a track to restore guided progression.',
              nextProblem: null,
            },
            queue: {
              ...shellData.queue,
              dueCount: 0,
              newCount: 0,
              reinforcementCount: 0,
              items: [],
            },
            popup: { queuePreview: [] },
          },
        })}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Queue Clear' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'No active track' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Your review queue is clear/i)).toBeInTheDocument()
    expect(screen.queryByText('Up Next')).not.toBeInTheDocument()
  })

  it('surfaces load failure and disables study mode changes', () => {
    render(
      <PopupShell
        controller={createController({
          status: {
            scope: 'surface',
            message: 'Failed to load popup data.',
            isError: true,
          },
          canToggleStudyMode: false,
        })}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Failed to load popup data.',
    )
    expect(
      screen.getByRole('button', { name: 'Start freestyle mode' }),
    ).toBeDisabled()
  })
})

function createController(
  overrides: Partial<PopupAppShellController> = {},
): PopupAppShellController {
  const data = overrides.data ?? shellData
  const studyMode = overrides.studyMode ?? data.settings.studyMode
  const view = overrides.view ?? createPopupAppShellView(data, studyMode)

  return {
    data,
    view,
    studyMode,
    status: null,
    isUpdatingStudyMode: false,
    canToggleStudyMode: true,
    canShuffleRecommendation: false,
    actions: {
      openSettings: vi.fn(),
      openTracks: vi.fn(),
      openProblem: vi.fn(),
      shuffleRecommendation: vi.fn(),
      toggleStudyMode: vi.fn(),
    },
    ...overrides,
  }
}
