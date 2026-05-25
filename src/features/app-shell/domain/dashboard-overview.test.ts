import { describe, expect, it } from 'vitest'

import {
  createAppShellQueueItem,
  createDashboardAppShellData,
} from '@/testing/app-shell-fixtures'

import { createDashboardOverviewView } from './dashboard-overview'

describe('createDashboardOverviewView', () => {
  it('maps a due recommendation into the primary review card', () => {
    const view = createDashboardOverviewView(createDashboardAppShellData())

    expect(view.primary).toMatchObject({
      kind: 'problem',
      kicker: 'Review Now',
      title: 'Add Binary',
      categoryLabel: 'Due',
      isOverdue: true,
      actionLabel: 'Open Problem',
    })
    expect(view.metrics).toEqual([
      {
        label: 'Due',
        value: '1',
        caption: 'Problems ready for review.',
      },
      {
        label: 'Completed Today',
        value: '1/4',
        caption: 'Unique problems practiced.',
      },
      {
        label: 'Streak',
        value: '0',
        caption: 'Goal-qualified days.',
      },
    ])
  })

  it('keeps queue clear separate from active-track next problem', () => {
    const view = createDashboardOverviewView(
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

    expect(view.primary).toMatchObject({
      kind: 'queue-clear',
      title: 'Queue Clear',
      actionLabel: 'Open Library',
    })
    expect(view.activeTrack.nextProblem?.title).toBe('Pair Sum - Sorted')
    expect(view.queuePreview).toEqual([])
  })

  it('limits the queue preview to five rows', () => {
    const queuePreview = Array.from({ length: 6 }, (_, index) =>
      createAppShellQueueItem({
        problem: {
          problemSlug: `problem-${index + 1}`,
          title: `Problem ${index + 1}`,
          difficulty: 'easy',
          isPremium: false,
        },
      }),
    )
    const view = createDashboardOverviewView(
      createDashboardAppShellData({
        overview: {
          practiceProgress: {
            completedToday: 0,
            dailyGoal: 4,
            currentStreak: 0,
            goalMetToday: false,
            todayDateKey: '2026-05-25',
          },
          queuePreview,
        },
      }),
    )

    expect(view.queuePreview.map((item) => item.problem.title)).toEqual([
      'Problem 1',
      'Problem 2',
      'Problem 3',
      'Problem 4',
      'Problem 5',
    ])
  })
})
