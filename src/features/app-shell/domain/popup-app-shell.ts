import type {
  AppShellProblemSummary,
  AppShellQueueItem,
  PopupAppShellData,
} from '../api/app-shell-contracts'

import type { StudyMode } from '@/features/settings'

export type PopupRecommendationReason = {
  label: string
  tone: 'warning' | 'info' | 'success'
}

export type PopupRecommendationView = {
  title: string
  emptyCopy: string | null
  problem: AppShellProblemSummary | null
  reason: PopupRecommendationReason | null
  difficulty: AppShellProblemSummary['difficulty'] | null
  isOverdue: boolean
}

export type PopupActiveTrackView = {
  title: string
  body: string
  groupTitle: string | null
  dueAt: string | null
  progressPercent: number | null
  nextProblem: AppShellProblemSummary | null
  modeActionLabel: string
}

export type PopupAppShellView = {
  recommendation: PopupRecommendationView
  activeTrack: PopupActiveTrackView
}

export function buildAppShellRecommendation(
  item: AppShellQueueItem | null,
): PopupAppShellData['recommendation'] {
  if (!item) {
    return {
      title: 'Queue is clear',
      detail: 'No due reviews or extra practice are queued right now.',
      category: null,
      problem: null,
      dueAt: null,
    }
  }

  return {
    title: item.problem.title,
    detail: `${formatQueueCategory(item.category)} ${formatDifficulty(item.problem.difficulty)}.`,
    category: item.category,
    problem: item.problem,
    dueAt: item.dueAt,
  }
}

export function selectPopupRecommendation(
  data: PopupAppShellData,
  recommendationIndex: number,
): PopupAppShellData {
  const itemCount = data.popup.queuePreview.length

  if (itemCount === 0) {
    return data
  }

  const item = data.popup.queuePreview[recommendationIndex % itemCount]

  if (!item) {
    return data
  }

  return {
    ...data,
    recommendation: buildAppShellRecommendation(item),
  }
}

export function createPopupAppShellView(
  data: PopupAppShellData,
  studyMode: StudyMode,
): PopupAppShellView {
  return {
    recommendation: createPopupRecommendationView(data),
    activeTrack: createPopupActiveTrackView(data, studyMode),
  }
}

function createPopupRecommendationView(
  data: PopupAppShellData,
): PopupRecommendationView {
  const problem = data.recommendation.problem
  const queueItem = problem
    ? data.queue.items.find((item) => item.problem.slug === problem.slug)
    : null

  return {
    title: problem ? problem.title : 'Queue Clear',
    emptyCopy: problem ? null : readEmptyRecommendationCopy(),
    problem,
    reason: readRecommendationReason(data.recommendation.category),
    difficulty: problem?.difficulty ?? null,
    isOverdue: queueItem?.summary.isOverdue ?? false,
  }
}

function createPopupActiveTrackView(
  data: PopupAppShellData,
  studyMode: StudyMode,
): PopupActiveTrackView {
  const activeTrack = data.activeTrack
  const hasActiveTrack = activeTrack.trackId !== null
  const isFreePractice = studyMode === 'freePractice'

  return {
    title: readActiveTrackTitle(data),
    body: readActiveTrackBody(data),
    groupTitle: hasActiveTrack ? activeTrack.groupTitle : null,
    dueAt: hasActiveTrack ? activeTrack.dueAt : null,
    progressPercent: hasActiveTrack ? activeTrack.progress.percent : null,
    nextProblem: activeTrack.nextProblem,
    modeActionLabel: isFreePractice
      ? 'Start study mode'
      : 'Start freestyle mode',
  }
}

function readEmptyRecommendationCopy() {
  return 'No review pressure right now. Your review queue is clear.'
}

function readRecommendationReason(
  category: PopupAppShellData['recommendation']['category'],
) {
  switch (category) {
    case 'due':
      return { label: 'Due', tone: 'warning' as const }
    case 'new':
      return { label: 'New', tone: 'info' as const }
    case 'reinforcement':
      return { label: 'Extra Practice', tone: 'success' as const }
    case null:
      return null
  }
}

function readActiveTrackTitle(data: PopupAppShellData) {
  return data.activeTrack.title
}

function readActiveTrackBody(data: PopupAppShellData) {
  const activeTrack = data.activeTrack

  if (!activeTrack.trackId) {
    return 'Choose a track in the dashboard to restore guided progression.'
  }

  if (!activeTrack.nextProblem) {
    return 'No track preview problem is available yet.'
  }

  return activeTrack.description ?? activeTrack.detail
}

const queueCategoryLabelByCategory = {
  due: 'Review',
  new: 'Start',
  reinforcement: 'Extra Practice',
} as const satisfies Record<AppShellQueueItem['category'], string>

const difficultyLabelByDifficulty = {
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
  unknown: 'unknown difficulty',
} as const satisfies Record<AppShellProblemSummary['difficulty'], string>

function formatQueueCategory(category: AppShellQueueItem['category']) {
  return queueCategoryLabelByCategory[category]
}

function formatDifficulty(difficulty: AppShellProblemSummary['difficulty']) {
  return difficultyLabelByDifficulty[difficulty]
}
