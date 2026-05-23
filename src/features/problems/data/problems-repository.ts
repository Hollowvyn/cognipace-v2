import { and, eq } from 'drizzle-orm'

import { parsePracticeStatus } from '@/features/practice/domain'
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
  createLeetCodeProblemSlug,
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
      slug: createLeetCodeProblemSlug(slug),
      title: input.title?.trim() || titleFromSlug(slug),
      difficulty: normalizeProblemDifficulty(input.difficulty),
      isPremium: input.isPremium ?? false,
      isUserCreated: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    } as const

    await this.db
      .insert(problems)
      .values(problem)
      .onConflictDoUpdate({
        target: problems.slug,
        set: {
          title: problem.title,
          difficulty: problem.difficulty,
          isPremium: problem.isPremium,
          updatedAt: timestamp,
        },
      })

    const savedProblem = await this.getBySlug(problem.slug)

    if (!savedProblem) {
      throw new Error(`Failed to read saved problem "${problem.slug}".`)
    }

    return savedProblem
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
          slug: problems.slug,
          title: problems.title,
          difficulty: problems.difficulty,
          isPremium: problems.isPremium,
          isUserCreated: problems.isUserCreated,
          createdAt: problems.createdAt,
          updatedAt: problems.updatedAt,
        },
        practiceStatus: problemPractice.status,
        cardDueAt: fsrsCards.dueAt,
      })
      .from(problems)
      .leftJoin(problemPractice, eq(problemPractice.problemSlug, problems.slug))
      .leftJoin(
        fsrsCards,
        and(
          eq(fsrsCards.problemSlug, problems.slug),
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
      practiceStatus:
        row.practiceStatus === null
          ? null
          : parsePracticeStatus(row.practiceStatus),
      dueAt: row.cardDueAt === null ? null : new Date(row.cardDueAt),
    }
  }
}

function mapProblem(row: ProblemRow): Problem {
  return {
    slug: row.slug,
    title: row.title,
    difficulty: normalizeProblemDifficulty(row.difficulty),
    isPremium: row.isPremium,
    isUserCreated: row.isUserCreated,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }
}
