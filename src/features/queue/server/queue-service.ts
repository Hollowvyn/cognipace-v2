import { and, asc, eq, sql } from 'drizzle-orm'

import { normalizeProblemDifficulty, type Problem } from '@/features/problems'
import {
  normalizeReviewLogFields,
  type PracticeStateSnapshot,
} from '@/features/practice'
import { createSettingsRepository } from '@/features/settings'
import {
  defaultFsrsCardKind,
  parseFsrsCardState,
  parseReviewRating,
  type FsrsCardSnapshot,
} from '@/lib/fsrs'
import type { Db } from '@/platform/db'
import {
  fsrsCards,
  problemPractice,
  problems,
  trackGroupProblems,
  trackGroups,
  tracks,
  trackSession,
} from '@/platform/db/schema'

import { buildTodayQueue, type QueueCandidate } from '../domain'

export async function getTodayQueue(db: Db, generatedAt = new Date()) {
  const settings = await createSettingsRepository(db).getSettings()
  const activeGroupId = await readActiveGroupId(db)
  const candidates = await readQueueCandidates(db, activeGroupId)

  return buildTodayQueue(candidates, settings, generatedAt)
}

async function readActiveGroupId(db: Db) {
  const [session] = await db
    .select({
      activeTrackId: trackSession.activeTrackId,
      activeGroupId: trackSession.activeGroupId,
    })
    .from(trackSession)
    .where(eq(trackSession.id, 'active'))
    .limit(1)

  if (session?.activeGroupId) {
    return session.activeGroupId
  }

  const activeTrackId = session?.activeTrackId ?? (await readFirstActiveTrackId(db))

  if (!activeTrackId) {
    return null
  }

  return readFirstTrackGroupId(db, activeTrackId)
}

async function readFirstActiveTrackId(db: Db) {
  const [track] = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(eq(tracks.isActive, true))
    .orderBy(asc(tracks.createdAt))
    .limit(1)

  return track?.id ?? null
}

async function readFirstTrackGroupId(db: Db, trackId: string) {
  const [group] = await db
    .select({ id: trackGroups.id })
    .from(trackGroups)
    .where(eq(trackGroups.trackId, trackId))
    .orderBy(asc(trackGroups.position))
    .limit(1)

  return group?.id ?? null
}

async function readQueueCandidates(
  db: Db,
  activeGroupId: string | null,
): Promise<QueueCandidate[]> {
  if (activeGroupId) {
    const rows = await db
      .select({
        ...queueCandidateSelection,
        activeTrackPosition: trackGroupProblems.position,
      })
      .from(problems)
      .leftJoin(problemPractice, eq(problemPractice.problemId, problems.id))
      .leftJoin(
        fsrsCards,
        and(
          eq(fsrsCards.problemId, problems.id),
          eq(fsrsCards.cardKind, defaultFsrsCardKind),
        ),
      )
      .leftJoin(
        trackGroupProblems,
        and(
          eq(trackGroupProblems.problemId, problems.id),
          eq(trackGroupProblems.trackGroupId, activeGroupId),
        ),
      )
      .orderBy(asc(problems.slug))

    return rows.map(mapQueueCandidate)
  }

  const rows = await db
    .select({
      ...queueCandidateSelection,
      activeTrackPosition: sql<number | null>`null`,
    })
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
  activeTrackPosition: number | null
}): QueueCandidate {
  return {
    problem: mapProblem(row.problem),
    activeTrackPosition: row.activeTrackPosition,
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

function mapPractice(row: QueuePracticeRow | null): PracticeStateSnapshot | null {
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
    lastRating: row.lastRating === null ? null : parseReviewRating(row.lastRating),
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

function parsePracticeStatus(value: string): PracticeStateSnapshot['status'] {
  switch (value) {
    case 'new':
    case 'learning':
    case 'review':
    case 'mastered':
    case 'suspended':
      return value
    default:
      throw new Error(`Invalid practice status "${value}".`)
  }
}
