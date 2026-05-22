import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import type {
  AppShellProblemSummary,
  PopupAppShellData,
} from '@/features/app-shell'
import { defaultUserSettings } from '@/features/settings'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { usePopupAppShellController } from './use-popup-app-shell-controller'

const browserMocks = vi.hoisted(() => ({
  getURL: vi.fn((path: string) => `chrome-extension://extension-id${path}`),
  tabsCreate: vi.fn(),
}))

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: { getURL: browserMocks.getURL },
    tabs: { create: browserMocks.tabsCreate },
  },
}))

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

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

const popupData = {
  surface: 'popup',
  generatedAt: '2026-01-01T00:00:00.000Z',
  status: {
    label: 'Practice ready',
    detail: '0 due, 2 new, 0 reinforcement available.',
  },
  metrics: [
    { label: 'Due Today', value: '0' },
    { label: 'Streak', value: '0 days' },
  ],
  recommendation: {
    title: 'Two Sum',
    detail: 'Start easy.',
    category: 'new',
    problem: twoSum,
    dueAt: null,
    alsoNextInTrack: true,
  },
  activeTrack: {
    trackId: 'leetcode-75',
    title: 'LeetCode 75',
    description: 'Focused starter track for interview patterns.',
    groupTitle: 'Arrays and Hashing',
    dueAt: null,
    progress: {
      completedCount: 0,
      totalCount: 2,
      percent: 0,
    },
    detail: 'Next: Two Sum',
    nextProblem: twoSum,
  },
  queue: {
    dailyGoal: 4,
    dueCount: 0,
    newCount: 2,
    reinforcementCount: 0,
    items: [],
  },
  settings: {
    studyMode: 'studyPlan',
    timing: defaultUserSettings.timing,
    memoryReview: defaultUserSettings.memoryReview,
    questionFilters: defaultUserSettings.questionFilters,
  },
  popup: {
    queuePreview: [
      {
        category: 'new',
        problem: twoSum,
        dueAt: null,
        activeTrackPosition: 1,
        summary: createNewSummary(),
      },
      {
        category: 'new',
        problem: validParentheses,
        dueAt: null,
        activeTrackPosition: 2,
        summary: createNewSummary(),
      },
    ],
  },
} satisfies PopupAppShellData

describe('usePopupAppShellController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exposes an explicit loading state before popup data resolves', () => {
    vi.mocked(sendMessage).mockReturnValue(new Promise(() => undefined))
    const { wrapper } = createQueryTestHarness()

    const { result } = renderHook(() => usePopupAppShellController(), {
      wrapper,
    })

    expect(result.current.status).toMatchObject({
      scope: 'surface',
      message: 'Loading popup data...',
      isError: false,
    })
    expect(result.current.canToggleStudyMode).toBe(false)
  })

  it('exposes query failure and keeps study mode changes disabled', async () => {
    vi.mocked(sendMessage).mockRejectedValueOnce(
      new Error('Background offline'),
    )
    const { wrapper } = createQueryTestHarness()

    const { result } = renderHook(() => usePopupAppShellController(), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.status).toMatchObject({
        scope: 'surface',
        message: 'Background offline',
        isError: true,
      })
    })
    expect(result.current.canToggleStudyMode).toBe(false)
  })

  it('opens dashboard and problem actions', async () => {
    vi.mocked(sendMessage).mockImplementation(readRuntimeResponse)
    browserMocks.tabsCreate.mockResolvedValue({})
    const { wrapper } = createQueryTestHarness()

    const { result } = renderHook(() => usePopupAppShellController(), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.data.recommendation.problem?.slug).toBe('two-sum')
    })

    act(() => {
      result.current.actions.openSettings()
      result.current.actions.openProblem(twoSum, 'recommendation')
    })

    expect(browserMocks.tabsCreate).toHaveBeenCalledWith({
      url: 'chrome-extension://extension-id/dashboard.html#/settings',
    })
    expect(browserMocks.tabsCreate).toHaveBeenCalledWith({ url: twoSum.url })
  })

  it('updates study mode optimistically and refetches after save', async () => {
    let popupResponse: PopupAppShellData = popupData
    const updateDeferred = createDeferred()
    vi.mocked(sendMessage).mockImplementation((method, request) => {
      if (method === 'app.getShellData') {
        expect(request).toEqual({ surface: 'popup' })
        return Promise.resolve(popupResponse)
      }

      if (method === 'settings.updateSettings') {
        expect(request).toEqual({
          surface: 'popup',
          patch: { studyMode: 'freePractice' },
        })

        return updateDeferred.promise.then(() => {
          popupResponse = createPopupData({ studyMode: 'freePractice' })

          return {
            ...defaultUserSettings,
            studyMode: 'freePractice' as const,
          }
        })
      }

      return Promise.reject(new Error(`Unexpected runtime method ${method}`))
    })
    const { wrapper } = createQueryTestHarness()

    const { result } = renderHook(() => usePopupAppShellController(), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.canToggleStudyMode).toBe(true)
    })
    expect(result.current.studyMode).toBe('studyPlan')

    act(() => {
      result.current.actions.toggleStudyMode()
    })

    await waitFor(() => {
      expect(result.current.studyMode).toBe('freePractice')
    })
    expect(result.current.status).toMatchObject({
      scope: 'track',
      message: 'Switching to freestyle mode...',
      isError: false,
    })
    expect(result.current.isUpdatingStudyMode).toBe(true)
    expect(result.current.canToggleStudyMode).toBe(false)

    act(() => {
      updateDeferred.resolve()
    })

    await waitFor(() => {
      expect(result.current.status).toBeNull()
    })
    expect(result.current.studyMode).toBe('freePractice')
    expect(
      vi.mocked(sendMessage).mock.calls.filter(([method]) => {
        return method === 'app.getShellData'
      }).length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('rolls study mode back when saving fails', async () => {
    const updateDeferred = createDeferred()
    vi.mocked(sendMessage).mockImplementation((method, request) => {
      if (method === 'app.getShellData') {
        expect(request).toEqual({ surface: 'popup' })
        return Promise.resolve(popupData)
      }

      if (method === 'settings.updateSettings') {
        expect(request).toEqual({
          surface: 'popup',
          patch: { studyMode: 'freePractice' },
        })

        return updateDeferred.promise.then(() => ({
          ...defaultUserSettings,
          studyMode: 'freePractice' as const,
        }))
      }

      return Promise.reject(new Error(`Unexpected runtime method ${method}`))
    })
    const { wrapper } = createQueryTestHarness()

    const { result } = renderHook(() => usePopupAppShellController(), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.canToggleStudyMode).toBe(true)
    })
    expect(result.current.studyMode).toBe('studyPlan')

    act(() => {
      result.current.actions.toggleStudyMode()
    })

    await waitFor(() => {
      expect(result.current.studyMode).toBe('freePractice')
    })

    act(() => {
      updateDeferred.reject(new Error('Settings write failed'))
    })

    await waitFor(() => {
      expect(result.current.status).toMatchObject({
        scope: 'track',
        message: 'Settings write failed',
        isError: true,
      })
    })
    expect(result.current.studyMode).toBe('studyPlan')
    expect(result.current.isUpdatingStudyMode).toBe(false)
    expect(result.current.canToggleStudyMode).toBe(true)
  })

  it('rotates recommendations across queue preview candidates', async () => {
    vi.mocked(sendMessage).mockImplementation(readRuntimeResponse)
    const { wrapper } = createQueryTestHarness()

    const { result } = renderHook(() => usePopupAppShellController(), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.data.recommendation.problem?.slug).toBe('two-sum')
    })

    act(() => {
      result.current.actions.shuffleRecommendation()
    })

    expect(result.current.data.recommendation.problem?.slug).toBe(
      'valid-parentheses',
    )
  })
})

function readRuntimeResponse(method: string, request: unknown) {
  if (method === 'app.getShellData') {
    expect(request).toEqual({ surface: 'popup' })
    return Promise.resolve(popupData)
  }

  if (method === 'settings.updateSettings') {
    expect(request).toEqual({
      surface: 'popup',
      patch: { studyMode: 'freePractice' },
    })

    return Promise.resolve({
      ...defaultUserSettings,
      studyMode: 'freePractice' as const,
    })
  }

  return Promise.reject(new Error(`Unexpected runtime method ${method}`))
}

function createPopupData(input: {
  studyMode: PopupAppShellData['settings']['studyMode']
}): PopupAppShellData {
  return {
    ...popupData,
    settings: {
      ...popupData.settings,
      studyMode: input.studyMode,
    },
  }
}

function createDeferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<{
    studyMode: 'freePractice'
  }>((innerResolve, innerReject) => {
    resolve = () => {
      innerResolve({ studyMode: 'freePractice' })
    }
    reject = innerReject
  })

  return {
    promise,
    resolve,
    reject,
  }
}

function createNewSummary(): PopupAppShellData['queue']['items'][number]['summary'] {
  return {
    phase: 'new',
    nextReviewAt: null,
    lastReviewedAt: null,
    reviewCount: 0,
    lapses: 0,
    difficulty: null,
    stability: null,
    scheduledDays: null,
    suspended: false,
    isStarted: false,
    isDue: false,
    isOverdue: false,
    overdueDays: 0,
    retrievability: null,
  }
}
