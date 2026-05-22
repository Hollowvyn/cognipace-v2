import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { browser } from 'wxt/browser'

import { useUpdateSettings, type StudyMode } from '@/features/settings'
import {
  getDashboardUrl,
  type DashboardRoute,
} from '@/platform/chrome/extension-pages'

import type {
  AppShellProblemSummary,
  PopupAppShellData,
} from '../api/app-shell-contracts'
import { appShellQueryKeys, usePopupAppShellData } from '../api/app-shell-api'
import {
  createPopupAppShellView,
  selectPopupRecommendation,
  type PopupAppShellView,
} from '../domain/popup-app-shell'

export type PopupControllerStatus = {
  scope: 'surface' | 'recommendation' | 'track'
  message: string
  isError: boolean
} | null

export interface PopupAppShellActions {
  openSettings: () => void
  openTracks: () => void
  openProblem: (
    problem: AppShellProblemSummary,
    scope: 'recommendation' | 'track',
  ) => void
  shuffleRecommendation: () => void
  toggleStudyMode: () => void
}

export interface PopupAppShellController {
  data: PopupAppShellData
  view: PopupAppShellView
  studyMode: StudyMode
  status: PopupControllerStatus
  isUpdatingStudyMode: boolean
  canToggleStudyMode: boolean
  canShuffleRecommendation: boolean
  actions: PopupAppShellActions
}

const fallbackData = {
  surface: 'popup',
  generatedAt: new Date(0).toISOString(),
  status: {
    label: 'Loading foundation',
    detail: 'Waiting for background service worker response.',
  },
  metrics: [
    { label: 'Due Today', value: '--' },
    { label: 'Streak', value: '--' },
  ],
  recommendation: {
    title: 'Loading recommendation',
    detail: 'The queue service is not connected yet.',
    category: null,
    problem: null,
    dueAt: null,
    alsoNextInTrack: false,
  },
  activeTrack: {
    trackId: null,
    title: 'Loading track',
    description: null,
    groupTitle: null,
    dueAt: null,
    progress: {
      completedCount: 0,
      totalCount: 0,
      percent: 0,
    },
    detail: 'The track service is not connected yet.',
    nextProblem: null,
  },
  queue: {
    dailyGoal: 0,
    dueCount: 0,
    newCount: 0,
    reinforcementCount: 0,
    items: [],
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

export function usePopupAppShellController(): PopupAppShellController {
  const shell = usePopupAppShellData()
  const updateSettings = useUpdateSettings()
  const queryClient = useQueryClient()
  const [recommendationIndex, setRecommendationIndex] = useState(0)
  const [pendingStudyMode, setPendingStudyMode] = useState<StudyMode | null>(
    null,
  )
  const [status, setStatus] = useState<PopupControllerStatus>(null)
  const hasShellData = shell.data !== undefined
  const data = shell.data ?? fallbackData
  const studyMode = pendingStudyMode ?? data.settings.studyMode
  const displayData = useMemo(
    () => selectPopupRecommendation(data, recommendationIndex, studyMode),
    [data, recommendationIndex, studyMode],
  )
  const view = useMemo(
    () => createPopupAppShellView(displayData, studyMode),
    [displayData, studyMode],
  )
  const queryStatus = readShellQueryStatus({
    error: shell.error,
    hasData: hasShellData,
    isError: shell.isError,
    isPending: shell.isPending,
  })
  const canToggleStudyMode =
    hasShellData && !queryStatus?.isError && pendingStudyMode === null

  async function openDashboard(route: DashboardRoute) {
    try {
      await browser.tabs.create({ url: getDashboardUrl(route) })
    } catch (error) {
      setStatus({
        scope: 'surface',
        message: readErrorMessage(error, 'Failed to open dashboard.'),
        isError: true,
      })
    }
  }

  async function openProblem(
    problem: AppShellProblemSummary,
    scope: 'recommendation' | 'track',
  ) {
    try {
      await browser.tabs.create({ url: problem.url })
    } catch (error) {
      setStatus({
        scope,
        message: readErrorMessage(error, 'Failed to open problem.'),
        isError: true,
      })
    }
  }

  async function toggleStudyMode() {
    if (!canToggleStudyMode || updateSettings.isPending) {
      return
    }

    const nextMode: StudyMode =
      studyMode === 'studyPlan' ? 'freePractice' : 'studyPlan'

    setPendingStudyMode(nextMode)
    setStatus({
      scope: 'track',
      message:
        nextMode === 'freePractice'
          ? 'Switching to freestyle mode...'
          : 'Switching to study mode...',
      isError: false,
    })

    try {
      const settings = await updateSettings.mutateAsync({
        surface: 'popup',
        patch: { studyMode: nextMode },
      })
      queryClient.setQueryData<PopupAppShellData>(
        appShellQueryKeys.popup(),
        (currentData) =>
          currentData
            ? {
                ...currentData,
                settings: {
                  studyMode: settings.studyMode,
                  timing: settings.timing,
                  memoryReview: settings.memoryReview,
                  questionFilters: settings.questionFilters,
                },
              }
            : currentData,
      )
      setStatus(null)
    } catch (error) {
      setStatus({
        scope: 'track',
        message: readErrorMessage(error, 'Failed to update study mode.'),
        isError: true,
      })
    } finally {
      setPendingStudyMode(null)
    }
  }

  return {
    data: displayData,
    view,
    studyMode,
    status: status ?? queryStatus,
    isUpdatingStudyMode: pendingStudyMode !== null || updateSettings.isPending,
    canToggleStudyMode,
    canShuffleRecommendation:
      hasShellData && data.popup.queuePreview.length > 1,
    actions: {
      openSettings: () => {
        void openDashboard('settings')
      },
      openTracks: () => {
        void openDashboard('tracks')
      },
      openProblem: (problem, scope) => {
        void openProblem(problem, scope)
      },
      shuffleRecommendation: () => {
        if (!hasShellData) {
          return
        }

        setRecommendationIndex((current) => {
          const count = data.popup.queuePreview.length

          return count === 0 ? 0 : (current + 1) % count
        })
      },
      toggleStudyMode: () => {
        void toggleStudyMode()
      },
    },
  }
}

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function readShellQueryStatus(input: {
  error: unknown
  hasData: boolean
  isError: boolean
  isPending: boolean
}): PopupControllerStatus {
  if (input.hasData) {
    return null
  }

  if (input.isError) {
    return {
      scope: 'surface',
      message: readErrorMessage(input.error, 'Failed to load popup data.'),
      isError: true,
    }
  }

  if (input.isPending) {
    return {
      scope: 'surface',
      message: 'Loading popup data...',
      isError: false,
    }
  }

  return null
}
