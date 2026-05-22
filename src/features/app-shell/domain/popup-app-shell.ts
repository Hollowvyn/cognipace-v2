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
  isTrackNext: boolean
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
  activeTrackNextSlug: string | null,
): PopupAppShellData['recommendation'] {
  if (!item) {
    return {
      title: 'Queue is clear',
      detail: 'No due or new problems are available for the active group.',
      category: null,
      problem: null,
      dueAt: null,
      alsoNextInTrack: false,
    }
  }

  return {
    title: item.problem.title,
    detail: `${formatQueueCategory(item.category)} ${formatDifficulty(item.problem.difficulty)}.`,
    category: item.category,
    problem: item.problem,
    dueAt: item.dueAt,
    alsoNextInTrack: item.problem.slug === activeTrackNextSlug,
  }
}

export function selectPopupRecommendation(
  data: PopupAppShellData,
  recommendationIndex: number,
  studyMode: StudyMode,
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
    recommendation: buildAppShellRecommendation(
      item,
      studyMode === 'studyPlan'
        ? (data.activeTrack.nextProblem?.slug ?? null)
        : null,
    ),
  }
}

export function createPopupAppShellView(
  data: PopupAppShellData,
  studyMode: StudyMode,
): PopupAppShellView {
  return {
    recommendation: createPopupRecommendationView(data, studyMode),
    activeTrack: createPopupActiveTrackView(data, studyMode),
  }
}

function createPopupRecommendationView(
  data: PopupAppShellData,
  studyMode: StudyMode,
): PopupRecommendationView {
  const problem = data.recommendation.problem
  const queueItem = problem
    ? data.queue.items.find((item) => item.problem.slug === problem.slug)
    : null

  return {
    title: problem ? problem.title : 'Queue Clear',
    emptyCopy: problem
      ? null
      : readEmptyRecommendationCopy(data.activeTrack.trackId, studyMode),
    problem,
    reason: readRecommendationReason(data.recommendation.category),
    difficulty: problem?.difficulty ?? null,
    isOverdue: queueItem?.summary.isOverdue ?? false,
    isTrackNext:
      studyMode === 'studyPlan' && data.recommendation.alsoNextInTrack,
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
    title: readActiveTrackTitle(data, studyMode),
    body: readActiveTrackBody(data, studyMode),
    groupTitle:
      hasActiveTrack && !isFreePractice ? activeTrack.groupTitle : null,
    dueAt: hasActiveTrack && !isFreePractice ? activeTrack.dueAt : null,
    progressPercent:
      hasActiveTrack && !isFreePractice ? activeTrack.progress.percent : null,
    nextProblem: isFreePractice ? null : activeTrack.nextProblem,
    modeActionLabel: isFreePractice
      ? 'Start study mode'
      : 'Start freestyle mode',
  }
}

function readEmptyRecommendationCopy(
  activeTrackId: string | null,
  studyMode: StudyMode,
) {
  if (studyMode === 'freePractice' || activeTrackId === null) {
    return 'No review pressure right now. Start study mode when you want guided track progression.'
  }

  return 'No review pressure right now. Continue the active track when you are ready.'
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

function readActiveTrackTitle(data: PopupAppShellData, studyMode: StudyMode) {
  if (studyMode === 'freePractice') {
    return 'You are in freestyle mode'
  }

  return data.activeTrack.title
}

function readActiveTrackBody(data: PopupAppShellData, studyMode: StudyMode) {
  const activeTrack = data.activeTrack

  if (studyMode === 'freePractice') {
    return 'Queue review is primary. Start study mode when you are ready for guided track progression.'
  }

  if (!activeTrack.trackId) {
    return 'Choose a track in the dashboard to restore guided progression.'
  }

  if (!activeTrack.nextProblem) {
    return activeTrack.progress.percent === 100
      ? 'Track complete. Switch tracks or use freestyle for due reviews.'
      : 'No available next problem in this track right now.'
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
