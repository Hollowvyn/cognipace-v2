import { PopupShell } from './popup-shell'

import {
  usePopupAppShellData,
  type PopupAppShellData,
} from '@/features/app-shell'
import { useExtensionPing } from '@/hooks/use-extension-ping'

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
  },
  activeTrack: {
    title: 'Loading track',
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

export function PopupApp() {
  const shell = usePopupAppShellData()
  const ping = useExtensionPing('popup')

  return (
    <PopupShell
      data={shell.data ?? fallbackData}
      pingLabel={ping.isSuccess ? 'Connected' : 'Connecting'}
    />
  )
}
