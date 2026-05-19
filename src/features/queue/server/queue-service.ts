import { and, asc, eq } from 'drizzle-orm'

import { normalizeProblemDifficulty, type Problem } from '@/features/problems'
import { createSettingsRepository } from '@/features/settings'
import { defaultFsrsCardKind } from '@/lib/fsrs'
import type { Db } from '@/platform/db'
import {
  fsrsCards,
  problemPractice,
  problems,
  trackGroupProblems,
  trackGroups,
  trackSession,
} from '@/platform/db/schema'

import { buildTodayQueue, type QueueCandidate } from '../domain'

export async function getTodayQueue(db: Db, generatedAt = new Date()) {
  const [settings, candidates] = await Promise.all([
    createSettingsRepository(db).getSettings(),
    readActiveTrackCandidates(db),
  ])

  return buildTodayQueue(candidates, settings, generatedAt)
}

async function readActiveTrackCandidates(db: Db): Promise<QueueCandidate[]> {
  const rows = await db
    .select({
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
      practiceStatus: problemPractice.status,
      isSuspended: problemPractice.isSuspended,
      cardDueAt: fsrsCards.dueAt,
      cardState: fsrsCards.state,
      position: trackGroupProblems.position,
    })
    .from(trackSession)
    .innerJoin(trackGroups, eq(trackGroups.id, trackSession.activeGroupId))
    .innerJoin(
      trackGroupProblems,
      eq(trackGroupProblems.trackGroupId, trackGroups.id),
    )
    .innerJoin(problems, eq(problems.id, trackGroupProblems.problemId))
    .leftJoin(problemPractice, eq(problemPractice.problemId, problems.id))
    .leftJoin(
      fsrsCards,
      and(
        eq(fsrsCards.problemId, problems.id),
        eq(fsrsCards.cardKind, defaultFsrsCardKind),
      ),
    )
    .where(eq(trackSession.id, 'active'))
    .orderBy(asc(trackGroupProblems.position))

  return rows.map((row) => ({
    problem: {
      id: row.problem.id,
      source: 'leetcode',
      externalId: row.problem.externalId,
      slug: row.problem.slug,
      title: row.problem.title,
      difficulty: normalizeProblemDifficulty(row.problem.difficulty),
      url: row.problem.url,
      isPremium: row.problem.isPremium,
      acceptanceRate: row.problem.acceptanceRate,
      createdAt: new Date(row.problem.createdAt),
      updatedAt: new Date(row.problem.updatedAt),
    } satisfies Problem,
    position: row.position,
    practiceStatus: row.practiceStatus,
    isSuspended: row.isSuspended ?? false,
    dueAt: row.cardDueAt === null ? null : new Date(row.cardDueAt),
    cardState: row.cardState,
  }))
}
