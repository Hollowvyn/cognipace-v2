import {
  serializePracticeDetails,
  serializePracticeSummary,
} from '@/features/practice/api/practice-serializers'
import { getPracticeDetails } from '@/features/practice/server/practice-service'
import type { Problem } from '@/features/problems/domain'
import { getProblemContext } from '@/features/problems/server/problems-service'
import type { QueueItem } from '@/features/queue/domain'
import { getTodayQueue } from '@/features/queue/server/queue-service'
import type { UserSettings } from '@/features/settings/domain'
import { getSettings } from '@/features/settings/server/settings-service'
import type { ActiveTrack } from '@/features/tracks/domain'
import { getActiveTrack } from '@/features/tracks/server/tracks-service'
import type { Db } from '@/platform/db'

import type {
  AppShellData,
  AppShellProblemSummary,
  AppShellQueueItem,
  AppShellRequest,
  OverlayNextStep,
  PopupAppShellData,
} from '../api/app-shell-contracts'
import { buildAppShellRecommendation } from '../domain/popup-app-shell'

export async function getAppShellData(
  db: Db,
  request: AppShellRequest,
  now = new Date(),
): Promise<AppShellData> {
  switch (request.surface) {
    case 'popup':
      return getPopupAppShellData(db, now)
    case 'dashboard':
      return getDashboardAppShellData(db, now)
    case 'overlay':
      return getOverlayAppShellData(db, request, now)
    default:
      return assertNever(request)
  }
}

async function getPopupAppShellData(db: Db, now: Date) {
  const { baseData, queueItems } = await getMainAppShellData(db, now)

  return {
    ...baseData,
    surface: 'popup',
    popup: { queuePreview: queueItems.slice(0, 3) },
  } satisfies AppShellData
}

async function getDashboardAppShellData(db: Db, now: Date) {
  const { baseData, queueItems } = await getMainAppShellData(db, now)

  return {
    ...baseData,
    surface: 'dashboard',
    dashboard: { queuePreview: queueItems.slice(0, 8) },
  } satisfies AppShellData
}

async function getMainAppShellData(db: Db, now: Date) {
  const [settings, queue, activeTrack] = await Promise.all([
    getSettings(db),
    getTodayQueue(db, now),
    getActiveTrack(db),
  ])
  const queueItems = queue.items.map(serializeQueueItem)
  const baseData = {
    generatedAt: now.toISOString(),
    status: {
      label: 'Practice ready',
      detail: `${queue.dueCount} due, ${queue.newCount} new, ${queue.reinforcementCount} reinforcement available.`,
    },
    metrics: [
      { label: 'Due Today', value: String(queue.dueCount) },
      { label: 'Streak', value: '0 days' },
    ],
    recommendation: buildAppShellRecommendation(queueItems[0] ?? null),
    activeTrack: serializeActiveTrack(activeTrack),
    queue: {
      dailyGoal: queue.dailyGoal,
      dueCount: queue.dueCount,
      newCount: queue.newCount,
      reinforcementCount: queue.reinforcementCount,
      items: queueItems,
    },
    settings: {
      studyMode: settings.studyMode,
      timing: settings.timing,
      memoryReview: settings.memoryReview,
      questionFilters: settings.questionFilters,
    },
  } satisfies Omit<PopupAppShellData, 'surface' | 'popup'>

  return {
    baseData,
    queueItems,
  }
}

async function getOverlayAppShellData(
  db: Db,
  request: Extract<AppShellRequest, { surface: 'overlay' }>,
  now: Date,
) {
  const settings = await getSettings(db)

  return {
    generatedAt: now.toISOString(),
    surface: 'overlay',
    overlay: await getOverlayPayload(db, request, now, settings),
  } satisfies AppShellData
}

async function getOverlayPayload(
  db: Db,
  request: Extract<AppShellRequest, { surface: 'overlay' }>,
  now: Date,
  settings: UserSettings,
) {
  if (!request.problemSlug) {
    return {
      problem: null,
      practice: null,
      timing: settings.timing,
      nextStep: null,
    }
  }

  const context = await getProblemContext(db, request.problemSlug)

  if (!context) {
    return {
      problem: null,
      practice: null,
      timing: settings.timing,
      nextStep: null,
    }
  }

  const [practice, queue, activeTrack] = await Promise.all([
    getPracticeDetails(db, context.problem.id, {
      now,
      targetRetention: settings.memoryReview.targetRetention,
    }),
    getTodayQueue(db, now),
    getActiveTrack(db),
  ])
  const queueItems = queue.items.map(serializeQueueItem)
  const currentProblem = serializeProblemSummary(context.problem)
  const activeTrackNextProblem =
    settings.studyMode === 'studyPlan' && activeTrack?.nextProblem
      ? serializeProblemSummary(activeTrack.nextProblem)
      : null

  return {
    problem: currentProblem,
    practice: serializePracticeDetails(practice),
    timing: settings.timing,
    nextStep: serializeOverlayNextStep({
      activeTrackNextProblem,
      currentProblem,
      queueItems,
    }),
  }
}

function serializeOverlayNextStep(input: {
  activeTrackNextProblem: AppShellProblemSummary | null
  currentProblem: AppShellProblemSummary
  queueItems: AppShellQueueItem[]
}): OverlayNextStep {
  if (
    input.activeTrackNextProblem &&
    input.activeTrackNextProblem.slug !== input.currentProblem.slug
  ) {
    return {
      kind: 'track',
      title: input.activeTrackNextProblem.title,
      detail: `Next in track · ${formatDifficulty(input.activeTrackNextProblem.difficulty)}`,
      problem: input.activeTrackNextProblem,
      category: null,
      dueAt: null,
    }
  }

  const recommendation = input.queueItems.find(
    (item) => item.problem.slug !== input.currentProblem.slug,
  )

  if (recommendation) {
    return {
      kind: 'recommendation',
      title: recommendation.problem.title,
      detail: `${formatQueueCategory(recommendation.category)} · ${formatDifficulty(recommendation.problem.difficulty)}`,
      problem: recommendation.problem,
      category: recommendation.category,
      dueAt: recommendation.dueAt,
    }
  }

  return {
    kind: 'empty',
    title: 'No next problem queued',
    detail: 'Review queue is clear for now.',
    problem: null,
    category: null,
    dueAt: null,
  }
}

function serializeActiveTrack(activeTrack: ActiveTrack | null) {
  if (!activeTrack) {
    return {
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
    }
  }

  return {
    trackId: activeTrack.track.id,
    title: activeTrack.track.title,
    description: activeTrack.track.description,
    groupTitle: activeTrack.activeGroup?.title ?? null,
    dueAt: activeTrack.track.dueAt?.toISOString() ?? null,
    progress: activeTrack.progress,
    detail: readActiveTrackDetail(activeTrack),
    nextProblem: activeTrack.nextProblem
      ? serializeProblemSummary(activeTrack.nextProblem)
      : null,
  }
}

function readActiveTrackDetail(activeTrack: ActiveTrack) {
  if (activeTrack.nextProblem) {
    return `Next: ${activeTrack.nextProblem.title}`
  }

  return 'No track preview problem is available yet.'
}

function serializeQueueItem(item: QueueItem): AppShellQueueItem {
  return {
    category: item.category,
    problem: {
      id: item.problemId,
      slug: item.slug,
      title: item.title,
      difficulty: item.difficulty,
      url: item.url,
      isPremium: item.isPremium,
    },
    dueAt: item.dueAt?.toISOString() ?? null,
    summary: serializePracticeSummary(item.summary),
  }
}

function serializeProblemSummary(problem: Problem): AppShellProblemSummary {
  return {
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    url: problem.url,
    isPremium: problem.isPremium,
  }
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

function assertNever(value: never): never {
  void value
  throw new Error('Unhandled app-shell value')
}
