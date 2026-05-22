import { and, asc, eq } from 'drizzle-orm'

import {
  normalizeProblemDifficulty,
  type Problem,
} from '@/features/problems/domain'
import {
  normalizeReviewLogFields,
  parsePracticeStatus,
  type PracticeStateSnapshot,
} from '@/features/practice/domain'
import { createSettingsRepository } from '@/features/settings/data/settings-repository'
import {
  defaultFsrsCardKind,
  parseFsrsCardState,
  parseReviewRating,
  type FsrsCardSnapshot,
} from '@/lib/fsrs'
import type { Db } from '@/platform/db'
import { fsrsCards, problemPractice, problems } from '@/platform/db/schema'

import { buildTodayQueue, type QueueCandidate } from '../domain'

export async function getTodayQueue(db: Db, generatedAt = new Date()) {
  const settings = await createSettingsRepository(db).getSettings()
  const candidates = await readQueueCandidates(db)

  return buildTodayQueue(candidates, settings, generatedAt)
}

async function readQueueCandidates(db: Db): Promise<QueueCandidate[]> {
  const rows = await db
    .select(queueCandidateSelection)
    .from(problems)
    .leftJoin(problemPractice, eq(problemPractice.problemId, problems.id))
    .leftJoin(
      fsrsCards,
      and(
        eq(fsrsCards.problemId, problems.id),
        eq(fsrsCards.cardKind, defaultFsrsCardKind),
      ),
    )
    .orderBy(asc(problems.slug))

  return rows.map(mapQueueCandidate)
}

const queueCandidateSelection = {
  problem: {
    id: problems.id,
    source: problems.source,
    externalId: problems.externalId,
    slug: problems.slug,
    title: problems.title,
    difficulty: problems.difficulty,
    url: problems.url,
    isPremium: problems.isPremium,
    acceptanceRate: problems.acceptanceRate,
    createdAt: problems.createdAt,
    updatedAt: problems.updatedAt,
  },
  practice: {
    status: problemPractice.status,
    lastReviewedAt: problemPractice.lastReviewedAt,
    attemptCount: problemPractice.attemptCount,
    solvedCount: problemPractice.solvedCount,
    isSuspended: problemPractice.isSuspended,
    lastRating: problemPractice.lastRating,
    lastElapsedSeconds: problemPractice.lastElapsedSeconds,
    bestElapsedSeconds: problemPractice.bestElapsedSeconds,
    interviewPattern: problemPractice.interviewPattern,
    timeComplexity: problemPractice.timeComplexity,
    spaceComplexity: problemPractice.spaceComplexity,
    languages: problemPractice.languages,
    notes: problemPractice.notes,
  },
  card: {
    dueAt: fsrsCards.dueAt,
    stability: fsrsCards.stability,
    difficulty: fsrsCards.difficulty,
    elapsedDays: fsrsCards.elapsedDays,
    scheduledDays: fsrsCards.scheduledDays,
    learningSteps: fsrsCards.learningSteps,
    reps: fsrsCards.reps,
    lapses: fsrsCards.lapses,
    state: fsrsCards.state,
    lastReviewAt: fsrsCards.lastReviewAt,
  },
} as const

function mapQueueCandidate(row: {
  problem: QueueProblemRow
  practice: QueuePracticeRow | null
  card: QueueCardRow | null
}): QueueCandidate {
  return {
    problem: mapProblem(row.problem),
    practice: mapPractice(row.practice),
    card: mapCard(row.card),
  }
}

interface QueueProblemRow {
  id: string
  source: string
  externalId: string | null
  slug: string
  title: string
  difficulty: string
  url: string
  isPremium: boolean
  acceptanceRate: number | null
  createdAt: number
  updatedAt: number
}

interface QueuePracticeRow {
  status: string | null
  lastReviewedAt: number | null
  attemptCount: number | null
  solvedCount: number | null
  isSuspended: boolean | null
  lastRating: string | null
  lastElapsedSeconds: number | null
  bestElapsedSeconds: number | null
  interviewPattern: string | null
  timeComplexity: string | null
  spaceComplexity: string | null
  languages: string | null
  notes: string | null
}

interface QueueCardRow {
  dueAt: number | null
  stability: number | null
  difficulty: number | null
  elapsedDays: number | null
  scheduledDays: number | null
  learningSteps: number | null
  reps: number | null
  lapses: number | null
  state: string | null
  lastReviewAt: number | null
}

function mapProblem(row: QueueProblemRow): Problem {
  return {
    id: row.id,
    source: 'leetcode',
    externalId: row.externalId,
    slug: row.slug,
    title: row.title,
    difficulty: normalizeProblemDifficulty(row.difficulty),
    url: row.url,
    isPremium: row.isPremium,
    acceptanceRate: row.acceptanceRate,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }
}

function mapPractice(
  row: QueuePracticeRow | null,
): PracticeStateSnapshot | null {
  if (!row || row.status === null) {
    return null
  }

  return {
    status: parsePracticeStatus(row.status),
    lastReviewedAt:
      row.lastReviewedAt === null ? null : new Date(row.lastReviewedAt),
    attemptCount: row.attemptCount ?? 0,
    solvedCount: row.solvedCount ?? 0,
    isSuspended: row.isSuspended ?? false,
    lastRating:
      row.lastRating === null ? null : parseReviewRating(row.lastRating),
    lastElapsedSeconds: row.lastElapsedSeconds,
    bestElapsedSeconds: row.bestElapsedSeconds,
    log: normalizeReviewLogFields({
      interviewPattern: row.interviewPattern,
      timeComplexity: row.timeComplexity,
      spaceComplexity: row.spaceComplexity,
      languages: row.languages,
      notes: row.notes,
    }),
  }
}

function mapCard(row: QueueCardRow | null): FsrsCardSnapshot | null {
  if (!row || row.dueAt === null || row.state === null) {
    return null
  }

  return {
    dueAt: new Date(row.dueAt),
    stability: row.stability ?? 0,
    difficulty: row.difficulty ?? 0,
    elapsedDays: row.elapsedDays ?? 0,
    scheduledDays: row.scheduledDays ?? 0,
    learningSteps: row.learningSteps ?? 0,
    reps: row.reps ?? 0,
    lapses: row.lapses ?? 0,
    state: parseFsrsCardState(row.state),
    lastReviewAt: row.lastReviewAt === null ? null : new Date(row.lastReviewAt),
  }
}
