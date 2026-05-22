import type { Problem, ProblemDifficulty } from '@/features/problems'
import {
  derivePracticeSummary,
  type PracticeStateSnapshot,
  type PracticeSummary,
} from '@/features/practice'
import type { UserSettings } from '@/features/settings'
import type { FsrsCardSnapshot } from '@/lib/fsrs'

export type QueueItemCategory = 'due' | 'new' | 'reinforcement'

export interface QueueCandidate {
  problem: Problem
  activeTrackPosition: number | null
  practice: PracticeStateSnapshot | null
  card: FsrsCardSnapshot | null
}

export interface QueueItem {
  category: QueueItemCategory
  problemId: string
  title: string
  slug: string
  difficulty: ProblemDifficulty
  url: string
  isPremium: boolean
  dueAt: Date | null
  activeTrackPosition: number | null
  summary: PracticeSummary
}

export interface TodayQueue {
  generatedAt: Date
  dailyGoal: number
  dueCount: number
  newCount: number
  reinforcementCount: number
  items: QueueItem[]
}

export function buildTodayQueue(
  candidates: QueueCandidate[],
  settings: UserSettings,
  generatedAt = new Date(),
): TodayQueue {
  const dailyGoal = Math.max(0, Math.round(settings.dailyQuestionGoal))
  const partitioned = partitionQueueCandidates(
    candidates,
    settings,
    generatedAt,
  )
  const dueItems = orderQueueItems(
    partitioned.due,
    settings.memoryReview.reviewOrder,
  )
  const newItems = orderQueueItems(
    partitioned.new,
    settings.memoryReview.reviewOrder,
  )
  const reinforcementItems = orderQueueItems(
    partitioned.reinforcement,
    settings.memoryReview.reviewOrder,
  )
  const dueForQueue = dueItems.slice(0, dailyGoal)
  const slotsAfterDue = Math.max(0, dailyGoal - dueForQueue.length)
  const newForQueue = newItems.slice(0, slotsAfterDue)
  const reinforcementSlots = Math.max(0, slotsAfterDue - newForQueue.length)
  const reinforcementForQueue = reinforcementItems.slice(0, reinforcementSlots)

  return {
    generatedAt,
    dailyGoal,
    dueCount: dueItems.length,
    newCount: newItems.length,
    reinforcementCount: reinforcementItems.length,
    items: [...dueForQueue, ...newForQueue, ...reinforcementForQueue],
  }
}

function partitionQueueCandidates(
  candidates: QueueCandidate[],
  settings: UserSettings,
  generatedAt: Date,
) {
  const partitions: Record<QueueItemCategory, QueueItem[]> = {
    due: [],
    new: [],
    reinforcement: [],
  }

  for (const candidate of candidates) {
    if (isEffectivelySuspended(candidate, settings)) {
      continue
    }

    const summary = derivePracticeSummary({
      practice: candidate.practice,
      card: candidate.card,
      now: generatedAt,
      targetRetention: settings.memoryReview.targetRetention,
    })

    if (summary.isDue) {
      partitions.due.push(mapQueueItem(candidate, 'due', summary))
      continue
    }

    if (!summary.isStarted) {
      if (candidate.activeTrackPosition !== null) {
        partitions.new.push(mapQueueItem(candidate, 'new', summary))
      }
      continue
    }

    partitions.reinforcement.push(
      mapQueueItem(candidate, 'reinforcement', summary),
    )
  }

  return partitions
}

function isEffectivelySuspended(
  candidate: QueueCandidate,
  settings: UserSettings,
) {
  return (
    candidate.practice?.isSuspended === true ||
    candidate.practice?.status === 'mastered' ||
    candidate.practice?.status === 'suspended' ||
    (settings.questionFilters.skipPremium && candidate.problem.isPremium)
  )
}

function mapQueueItem(
  candidate: QueueCandidate,
  category: QueueItemCategory,
  summary: PracticeSummary,
): QueueItem {
  return {
    category,
    problemId: candidate.problem.id,
    title: candidate.problem.title,
    slug: candidate.problem.slug,
    difficulty: candidate.problem.difficulty,
    url: candidate.problem.url,
    isPremium: candidate.problem.isPremium,
    dueAt: summary.nextReviewAt,
    activeTrackPosition: candidate.activeTrackPosition,
    summary,
  }
}

function orderQueueItems(
  items: QueueItem[],
  strategy: UserSettings['memoryReview']['reviewOrder'],
): QueueItem[] {
  if (strategy === 'weakestFirst') {
    return sortByWeakest(items)
  }

  if (strategy === 'mixByDifficulty') {
    return interleaveByDifficulty(items)
  }

  return sortByDueThenPosition(items)
}

function sortByDueThenPosition(items: QueueItem[]) {
  return [...items].sort((left, right) => {
    const dueComparison = compareDates(left.dueAt, right.dueAt)

    if (dueComparison !== 0) {
      return dueComparison
    }

    return comparePositions(left.activeTrackPosition, right.activeTrackPosition)
  })
}

function sortByWeakest(items: QueueItem[]) {
  return [...items].sort((left, right) => {
    if (right.summary.lapses !== left.summary.lapses) {
      return right.summary.lapses - left.summary.lapses
    }

    if ((right.summary.difficulty ?? 0) !== (left.summary.difficulty ?? 0)) {
      return (right.summary.difficulty ?? 0) - (left.summary.difficulty ?? 0)
    }

    return sortByDueThenPosition([left, right])[0] === left ? -1 : 1
  })
}

function interleaveByDifficulty(items: QueueItem[]) {
  const buckets: Record<ProblemDifficulty, QueueItem[]> = {
    easy: [],
    medium: [],
    hard: [],
    unknown: [],
  }

  for (const item of sortByDueThenPosition(items)) {
    buckets[item.difficulty].push(item)
  }

  const difficultyOrder: ProblemDifficulty[] = [
    'easy',
    'medium',
    'hard',
    'unknown',
  ]
  const orderedItems: QueueItem[] = []
  let addedItem = true

  while (addedItem) {
    addedItem = false

    for (const difficulty of difficultyOrder) {
      const item = buckets[difficulty].shift()

      if (item) {
        orderedItems.push(item)
        addedItem = true
      }
    }
  }

  return orderedItems
}

function compareDates(left: Date | null, right: Date | null) {
  return (
    (left?.getTime() ?? Number.MAX_SAFE_INTEGER) -
    (right?.getTime() ?? Number.MAX_SAFE_INTEGER)
  )
}

function comparePositions(left: number | null, right: number | null) {
  return (left ?? Number.MAX_SAFE_INTEGER) - (right ?? Number.MAX_SAFE_INTEGER)
}
