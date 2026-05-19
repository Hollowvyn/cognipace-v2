import { endOfDay } from 'date-fns'

import type { Problem, ProblemDifficulty } from '@/features/problems'
import type { UserSettings } from '@/features/settings'

export type QueueItemKind = 'due' | 'new'

export interface QueueCandidate {
  problem: Problem
  position: number
  practiceStatus: string | null
  isSuspended: boolean
  dueAt: Date | null
  cardState: string | null
}

export interface QueueItem {
  kind: QueueItemKind
  problemId: string
  title: string
  slug: string
  difficulty: ProblemDifficulty
  dueAt: Date | null
  position: number
}

export interface TodayQueue {
  generatedAt: Date
  dailyGoal: number
  items: QueueItem[]
}

export function buildTodayQueue(
  candidates: QueueCandidate[],
  settings: UserSettings,
  generatedAt = new Date(),
): TodayQueue {
  const dueCutoff = endOfDay(generatedAt).getTime()
  const eligible = candidates.filter((candidate) => !candidate.isSuspended)
  const dueItems = eligible
    .filter(
      (candidate) =>
        candidate.dueAt !== null && candidate.dueAt.getTime() <= dueCutoff,
    )
    .sort((left, right) => compareDates(left.dueAt, right.dueAt))
  const newItems = eligible
    .filter((candidate) => candidate.dueAt === null)
    .sort((left, right) => left.position - right.position)
  const items = [...dueItems, ...newItems]
    .slice(0, settings.dailyQuestionGoal)
    .map(mapQueueItem)

  return {
    generatedAt,
    dailyGoal: settings.dailyQuestionGoal,
    items,
  }
}

function mapQueueItem(candidate: QueueCandidate): QueueItem {
  return {
    kind: candidate.dueAt ? 'due' : 'new',
    problemId: candidate.problem.id,
    title: candidate.problem.title,
    slug: candidate.problem.slug,
    difficulty: candidate.problem.difficulty,
    dueAt: candidate.dueAt,
    position: candidate.position,
  }
}

function compareDates(left: Date | null, right: Date | null) {
  return (left?.getTime() ?? 0) - (right?.getTime() ?? 0)
}
