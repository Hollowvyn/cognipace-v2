import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { createPracticeRepository } from '@/features/practice/data/practice-repository'
import {
  bulkDeleteProblems,
  bulkUpdateProblems,
  createProblem,
  getProblemForEdit,
  getProblemLibrary,
  updateProblem,
  upsertProblemFromPage,
} from '@/features/problems/server/problems-service'
import {
  companies,
  problemCompanies,
  problemPractice,
  problemTopics,
  problems,
  reviewAttempts,
  topics,
} from '@/platform/db/schema'
import { createTestDb } from '@/platform/db/test-db'

import { createProblemsRepository } from './problems-repository'

describe('ProblemsRepository library data', () => {
  it('composes Library rows from DB-backed problem, practice, labels, companies, and tracks', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await handle.db.insert(problemTopics).values({
      problemSlug: 'two-sum',
      topicId: 'array',
    })
    await handle.db.insert(companies).values({
      id: 'netflix',
      label: 'Netflix',
    })
    await handle.db.insert(problemCompanies).values({
      problemSlug: 'two-sum',
      companyId: 'netflix',
    })
    await saveSolvedReview(handle.db)

    const library = await getProblemLibrary(handle.db, {
      surface: 'dashboard',
      at: '2026-01-01T10:01:00.000Z',
    })
    const twoSum = library.rows.find((row) => row.problem.slug === 'two-sum')

    expect(library.summary.totalCount).toBe(2)
    expect(twoSum).toMatchObject({
      status: 'scheduled',
      lastSolvedAt: solvedAt.toISOString(),
      topics: [{ id: 'array', label: 'Array' }],
      companies: [{ id: 'netflix', label: 'Netflix' }],
      trackMemberships: [
        { trackId: 'leetcode-75', groupId: 'leetcode-75:arrays-hashing' },
      ],
    })
  })

  it('creates user problems and edits seeded or user-created metadata with replacement labels', async () => {
    const handle = await createTestDb()

    const created = await createProblem(handle.db, newProblemInput({
      topicLabels: ['Array', 'Binary Search'],
      companyLabels: ['Meta'],
    }))
    const edited = await updateProblem(handle.db, updateProblemInput({
      title: 'Binary Search Updated',
      difficulty: 'medium',
      isPremium: true,
      topicLabels: ['Search'],
      companyLabels: ['Netflix'],
    }))
    const seededDuplicate = await createProblem(handle.db, newProblemInput({
      slugOrUrl: 'two-sum',
      title: 'Two Sum Custom',
      difficulty: 'hard',
      isPremium: true,
      topicLabels: ['Hash Table'],
      companyLabels: ['Amazon'],
    }))

    expect(created.problem).toMatchObject({
      slug: 'binary-search',
      isUserCreated: true,
    })
    expect(edited).toMatchObject({
      problem: {
        title: 'Binary Search Updated',
        difficulty: 'medium',
        isPremium: true,
      },
      topics: [{ label: 'Search' }],
      companies: [{ label: 'Netflix' }],
    })
    expect(seededDuplicate.problem).toMatchObject({
      slug: 'two-sum',
      title: 'Two Sum Custom',
      isUserCreated: false,
    })
  })

  it('bulk-updates fields and deletes existing problems', async () => {
    const handle = await createTestDb()

    await createProblem(handle.db, newProblemInput({
      topicLabels: ['Array'],
      companyLabels: ['Meta'],
    }))

    const bulkUpdate = await bulkUpdateProblems(handle.db, {
      surface: 'dashboard',
      problemSlugs: ['two-sum', 'binary-search', 'missing-problem'],
      set: {
        difficulty: 'hard',
        isPremium: true,
        topicLabels: ['Dynamic Programming'],
        companyLabels: [],
      },
    })
    const twoSum = await getProblemForEdit(handle.db, {
      surface: 'dashboard',
      problemSlug: 'two-sum',
    })
    await bulkDeleteProblems(handle.db, {
      surface: 'dashboard',
      problemSlugs: ['binary-search', 'two-sum', 'missing-problem'],
    })

    expect(bulkUpdate).toEqual({
      updatedProblemSlugs: ['two-sum', 'binary-search'],
      missingProblemSlugs: ['missing-problem'],
    })
    expect(twoSum).toMatchObject({
      problem: { difficulty: 'hard', isPremium: true },
      topics: [{ label: 'Dynamic Programming' }],
      companies: [],
    })
    await expect(
      getProblemForEdit(handle.db, {
        surface: 'dashboard',
        problemSlug: 'binary-search',
      }),
    ).rejects.toThrow(/was not found/)
    await expect(
      getProblemForEdit(handle.db, {
        surface: 'dashboard',
        problemSlug: 'two-sum',
      }),
    ).rejects.toThrow(/was not found/)
  })

  it('migrates stale page slugs without losing relations or practice history', async () => {
    const handle = await createTestDb({ seed: false })
    const repository = createProblemsRepository(handle.db)

    await repository.upsertFromLeetCode({
      slug: 'old-two-sum',
      title: 'Old Two Sum',
      difficulty: 'easy',
    })
    await handle.db.insert(topics).values({ id: 'array', label: 'Array' })
    await handle.db.insert(problemTopics).values({
      problemSlug: 'old-two-sum',
      topicId: 'array',
    })
    await saveSolvedReview(handle.db, 'old-two-sum')

    const saved = await upsertProblemFromPage(handle.db, {
      url: 'https://leetcode.com/problems/old-two-sum/',
      slug: 'two-sum',
      title: 'Two Sum',
      difficulty: 'Easy',
      isPremium: false,
    })
    const [oldRows, practiceRows, attemptRows] = await Promise.all([
      handle.db.select().from(problems).where(eq(problems.slug, 'old-two-sum')),
      handle.db
        .select()
        .from(problemPractice)
        .where(eq(problemPractice.problemSlug, 'two-sum')),
      handle.db
        .select()
        .from(reviewAttempts)
        .where(eq(reviewAttempts.problemSlug, 'two-sum')),
    ])
    const edit = await getProblemForEdit(handle.db, {
      surface: 'dashboard',
      problemSlug: 'two-sum',
    })

    expect(saved.slug).toBe('two-sum')
    expect(oldRows).toEqual([])
    expect(practiceRows).toHaveLength(1)
    expect(attemptRows).toHaveLength(1)
    expect(edit.topics).toEqual([{ id: 'array', label: 'Array' }])
  })
})

const solvedAt = new Date('2026-01-01T10:00:00.000Z')

function saveSolvedReview(
  db: Parameters<typeof createPracticeRepository>[0],
  problemSlug = 'two-sum',
) {
  return createPracticeRepository(db).saveReviewResult({
    problemSlug,
    rating: 'good',
    reviewedAt: solvedAt,
    isCorrect: true,
    targetRetention: 0.9,
  })
}

function newProblemInput(
  overrides: Partial<Parameters<typeof createProblem>[1]> = {},
) {
  return {
    surface: 'dashboard',
    slugOrUrl: 'binary-search',
    title: 'Binary Search',
    difficulty: 'easy',
    isPremium: false,
    topicLabels: [],
    companyLabels: [],
    ...overrides,
  } satisfies Parameters<typeof createProblem>[1]
}

function updateProblemInput(
  overrides: Partial<Parameters<typeof updateProblem>[1]> = {},
) {
  return {
    surface: 'dashboard',
    problemSlug: 'binary-search',
    title: 'Binary Search',
    difficulty: 'easy',
    isPremium: false,
    topicLabels: [],
    companyLabels: [],
    ...overrides,
  } satisfies Parameters<typeof updateProblem>[1]
}
