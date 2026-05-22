import { and, eq } from 'drizzle-orm'

import type { PracticeStatus } from '@/features/practice/domain'
import { defaultFsrsCardKind } from '@/lib/fsrs'
import { normalizeLeetCodeSlug } from '@/lib/leetcode'
import type { Db } from '@/platform/db'
import {
  fsrsCards,
  problemPractice,
  problems,
  type ProblemRow,
} from '@/platform/db/schema'

import {
  createLeetCodeProblemId,
  normalizeProblemDifficulty,
  titleFromSlug,
  type Problem,
  type ProblemContext,
  type UpsertProblemInput,
} from '../domain'

export function createProblemsRepository(db: Db) {
  return new ProblemsRepository(db)
}

export class ProblemsRepository {
  constructor(private readonly db: Db) {}

  async upsertFromLeetCode(input: UpsertProblemInput, now = new Date()) {
    const slug = normalizeLeetCodeSlug(input.slug)

    if (!slug) {
      throw new Error('Cannot upsert a LeetCode problem without a slug.')
    }

    const timestamp = now.getTime()
    const problem = {
      id: createLeetCodeProblemId(slug),
      source: 'leetcode',
      externalId: input.externalId ?? null,
      slug,
      title: input.title?.trim() || titleFromSlug(slug),
      difficulty: normalizeProblemDifficulty(input.difficulty),
      url: input.url ?? `https://leetcode.com/problems/${slug}/`,
      isPremium: input.isPremium ?? false,
      acceptanceRate: input.acceptanceRate ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    } as const

    await this.db
      .insert(problems)
      .values(problem)
      .onConflictDoUpdate({
        target: problems.id,
        set: {
          externalId: problem.externalId,
          title: problem.title,
          difficulty: problem.difficulty,
          url: problem.url,
          isPremium: problem.isPremium,
          acceptanceRate: problem.acceptanceRate,
          updatedAt: timestamp,
        },
      })

    const savedProblem = await this.getById(problem.id)

    if (!savedProblem) {
      throw new Error(`Failed to read saved problem "${problem.id}".`)
    }

    return savedProblem
  }

  async getById(id: string) {
    const rows = await this.db
      .select()
      .from(problems)
      .where(eq(problems.id, id))
      .limit(1)

    return rows[0] ? mapProblem(rows[0]) : null
  }

  async getBySlug(slug: string) {
    const rows = await this.db
      .select()
      .from(problems)
      .where(eq(problems.slug, normalizeLeetCodeSlug(slug)))
      .limit(1)

    return rows[0] ? mapProblem(rows[0]) : null
  }

  async getContextBySlug(slug: string): Promise<ProblemContext | null> {
    const rows = await this.db
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
        cardDueAt: fsrsCards.dueAt,
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
      .where(eq(problems.slug, normalizeLeetCodeSlug(slug)))
      .limit(1)

    const row = rows[0]

    if (!row) {
      return null
    }

    return {
      problem: mapProblem(row.problem),
      isTracked: row.practiceStatus !== null,
      practiceStatus: row.practiceStatus as PracticeStatus | null,
      dueAt: row.cardDueAt === null ? null : new Date(row.cardDueAt),
    }
  }
}

function mapProblem(row: ProblemRow): Problem {
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
