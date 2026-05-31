import type {
  Problem,
  ProblemDifficulty,
  ProblemSlug,
} from '@/features/problems'
import { type NormalizedPracticeState } from '@/features/practice'
import type { UserSettings } from '@/features/settings'

export type QueueItemCategory = 'due' | 'new' | 'reinforcement'

export type RecommendationReason =
  | 'overdue'
  | 'due-now'
  | 'reinforcement'
  | 'new-problem'

export interface QueueCandidate {
  problem: Problem
  state: NormalizedPracticeState
}

export interface QueueItem {
  category: QueueItemCategory
  problemSlug: ProblemSlug
  title: string
  difficulty: ProblemDifficulty
  isPremium: boolean
  state: NormalizedPracticeState
  reason: RecommendationReason
}

export interface TodayQueue {
  generatedAt: Date
  dueCount: number
  newCount: number
  reinforcementCount: number
  excludedCount: number
  items: QueueItem[]
  topRecommendation: QueueItem | null
}

export function buildTodayQueue(
  candidates: QueueCandidate[],
  settings: UserSettings,
  generatedAt = new Date(),
): TodayQueue {
  const dailyGoal = Math.max(0, Math.round(settings.practice.dailyGoal))
  const { partitions, excludedCount } = partitionQueueCandidates(
    candidates,
    settings,
  )
  const dueItems = orderQueueItems(partitions.due, settings.review.order)
  const newItems = orderQueueItems(partitions.new, settings.review.order)
  const reinforcementItems = orderQueueItems(
    partitions.reinforcement,
    settings.review.order,
  )

  const dueForQueue = dueItems.slice(0, dailyGoal)
  const slotsAfterDue = Math.max(0, dailyGoal - dueForQueue.length)
  const reinforcementForQueue = reinforcementItems.slice(0, slotsAfterDue)
  const newForQueue =
    dueForQueue.length + reinforcementForQueue.length === 0
      ? newItems.slice(0, dailyGoal)
      : []

  const items = [...dueForQueue, ...reinforcementForQueue, ...newForQueue]

  return {
    generatedAt,
    dueCount: dueItems.length,
    newCount: newItems.length,
    reinforcementCount: reinforcementItems.length,
    excludedCount,
    items,
    topRecommendation: items[0] ?? null,
  }
}

function partitionQueueCandidates(
  candidates: QueueCandidate[],
  settings: UserSettings,
) {
  const partitions: Record<QueueItemCategory, QueueItem[]> = {
    due: [],
    new: [],
    reinforcement: [],
  }
  let excludedCount = 0

  for (const candidate of candidates) {
    if (isEffectivelySuspended(candidate, settings)) {
      excludedCount++
      continue
    }

    if (candidate.state.isDue) {
      partitions.due.push(mapQueueItem(candidate, 'due'))
      continue
    }

    if (!candidate.state.isStarted) {
      partitions.new.push(mapQueueItem(candidate, 'new'))
      continue
    }

    partitions.reinforcement.push(mapQueueItem(candidate, 'reinforcement'))
  }

  return { partitions, excludedCount }
}

function isEffectivelySuspended(
  candidate: QueueCandidate,
  settings: UserSettings,
) {
  return (
    candidate.state.isSuspended === true ||
    candidate.state.status === 'mastered' ||
    candidate.state.status === 'suspended' ||
    (settings.practice.problemFilters.skipPremium &&
      candidate.problem.isPremium)
  )
}

function deriveRecommendationReason(
  category: QueueItemCategory,
  isOverdue: boolean,
): RecommendationReason {
  if (category === 'due') return isOverdue ? 'overdue' : 'due-now'
  if (category === 'reinforcement') return 'reinforcement'
  return 'new-problem'
}

function mapQueueItem(
  candidate: QueueCandidate,
  category: QueueItemCategory,
): QueueItem {
  return {
    category,
    problemSlug: candidate.problem.slug,
    title: candidate.problem.title,
    difficulty: candidate.problem.difficulty,
    isPremium: candidate.problem.isPremium,
    state: candidate.state,
    reason: deriveRecommendationReason(category, candidate.state.isOverdue),
  }
}

function orderQueueItems(
  items: QueueItem[],
  strategy: UserSettings['review']['order'],
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
    const dueComparison = compareDates(left.state.dueAt, right.state.dueAt)

    if (dueComparison !== 0) {
      return dueComparison
    }

    return left.problemSlug.localeCompare(right.problemSlug)
  })
}

function sortByWeakest(items: QueueItem[]) {
  return [...items].sort((left, right) => {
    if (right.state.lapses !== left.state.lapses) {
      return right.state.lapses - left.state.lapses
    }

    if ((right.state.difficulty ?? 0) !== (left.state.difficulty ?? 0)) {
      return (right.state.difficulty ?? 0) - (left.state.difficulty ?? 0)
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
