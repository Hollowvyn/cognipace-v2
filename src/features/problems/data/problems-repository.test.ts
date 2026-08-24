import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { describe, expect, it } from 'vitest'

import { saveReviewResult } from '@/features/practice/server/practice-service'
import {
  bulkDeleteProblems,
  bulkUpdateProblems,
  createProblem,
  getProblemForEdit,
  getProblemLibrary,
  getProblemLibraryRowsBySlug,
  updateProblem,
  upsertProblemFromPage,
} from '@/features/problems/server/problems-service'
import { updateSettings } from '@/features/settings/server/settings-service'
import type { Db } from '@/platform/db'
import { createProxyCallback } from '@/platform/db/proxy'
import * as schema from '@/platform/db/schema'
import {
  companies,
  fsrsCards,
  problemCompanies,
  problemPractice,
  problemTopics,
  problems,
  reviewAttempts,
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

    expect(library.summary.totalCount).toBe(library.rows.length)
    expect(library.rows.map((row) => row.problem.slug)).toEqual(
      expect.arrayContaining([
        'two-sum',
        'valid-parentheses',
        'two-sum-ii-input-array-is-sorted',
      ]),
    )
    expect(twoSum).toMatchObject({
      status: 'scheduled',
      lastSolvedAt: solvedAt.toISOString(),
      topics: [{ id: 'array', label: 'Array' }],
      companies: [{ id: 'netflix', label: 'Netflix' }],
    })
    expect(twoSum?.trackMemberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          trackId: 'leetcode-75',
          groupId: 'leetcode-75:arrays-hashing',
        }),
      ]),
    )
  })

  it('creates user problems and edits seeded or user-created metadata with replacement labels', async () => {
    const handle = await createTestDb()

    const created = await createProblem(
      handle.db,
      newProblemInput({
        topicLabels: ['Array', 'Binary Search'],
        companyLabels: ['Meta'],
      }),
    )
    const edited = await updateProblem(
      handle.db,
      updateProblemInput({
        title: 'Binary Search Updated',
        difficulty: 'medium',
        isPremium: true,
        topicLabels: ['Search'],
        companyLabels: ['Netflix'],
      }),
    )
    const seededDuplicate = await createProblem(
      handle.db,
      newProblemInput({
        slugOrUrl: 'two-sum',
        title: 'Two Sum Custom',
        difficulty: 'hard',
        isPremium: true,
        topicLabels: ['Hash Table'],
        companyLabels: ['Amazon'],
      }),
    )

    expect(created.problem).toMatchObject({
      slug: 'binary-search',
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
    })
  })

  it('resolves topic aliases and auto-creates unknown topics on manual writes', async () => {
    const handle = await createTestDb({
      now: new Date('2026-05-29T12:00:00.000Z'),
    })

    await createProblem(
      handle.db,
      newProblemInput({
        slugOrUrl: 'heap-drill',
        title: 'Heap Drill',
        topicLabels: ['Heaps', 'Priority Queue', 'Brand New Pattern'],
      }),
    )

    const saved = await createProblemsRepository(handle.db).getForEdit(
      'heap-drill',
    )

    expect(saved?.topics.map((topic) => topic.label)).toEqual([
      'Brand New Pattern',
      'Heap (Priority Queue)',
    ])
    expect(saved?.topics.map((topic) => topic.id)).toEqual([
      'brand-new-pattern',
      'heap-priority-queue',
    ])
  })

  it('keeps manual topic replacement semantics after alias resolution', async () => {
    const handle = await createTestDb()

    await createProblem(
      handle.db,
      newProblemInput({
        slugOrUrl: 'replace-topic-drill',
        title: 'Replace Topic Drill',
        topicLabels: ['Array', 'Heaps'],
      }),
    )
    await updateProblem(
      handle.db,
      updateProblemInput({
        problemSlug: 'replace-topic-drill',
        title: 'Replace Topic Drill',
        topicLabels: ['DP'],
      }),
    )

    const saved = await createProblemsRepository(handle.db).getForEdit(
      'replace-topic-drill',
    )

    expect(saved?.topics.map((topic) => topic.label)).toEqual([
      'Dynamic Programming',
    ])
  })

  it('returns parent rollups for direct problem topics', async () => {
    const handle = await createTestDb()

    await createProblem(
      handle.db,
      newProblemInput({
        slugOrUrl: 'graph-rollup',
        title: 'Graph Rollup',
        topicLabels: ['BFS'],
      }),
    )

    const saved = await createProblemsRepository(handle.db).getForEdit(
      'graph-rollup',
    )

    expect(saved?.topics).toEqual([
      {
        id: 'breadth-first-search',
        label: 'Breadth-First Search',
        parentTopics: [
          { id: 'binary-tree', label: 'Binary Tree' },
          { id: 'graph-theory', label: 'Graph Theory' },
          { id: 'tree', label: 'Tree' },
        ],
      },
    ])
  })

  it('includes parent rollups for direct topics in Library rows', async () => {
    const handle = await createTestDb()

    await createProblem(
      handle.db,
      newProblemInput({
        slugOrUrl: 'library-rollup',
        title: 'Library Rollup',
        topicLabels: ['BFS'],
        companyLabels: ['Meta'],
      }),
    )

    const rows = await createProblemsRepository(handle.db).getLibraryRowsBySlug(
      ['library-rollup'],
      { now: new Date('2026-01-01T10:01:00.000Z') },
    )

    expect(rows[0]?.topics).toEqual([
      {
        id: 'breadth-first-search',
        label: 'Breadth-First Search',
        parentTopics: [
          { id: 'binary-tree', label: 'Binary Tree' },
          { id: 'graph-theory', label: 'Graph Theory' },
          { id: 'tree', label: 'Tree' },
        ],
      },
    ])
    expect(rows[0]?.companies).toEqual([{ id: 'meta', label: 'Meta' }])
  })

  it('bulk-updates fields and deletes existing problems', async () => {
    const handle = await createTestDb()

    await createProblem(
      handle.db,
      newProblemInput({
        topicLabels: ['Array'],
        companyLabels: ['Meta'],
      }),
    )

    await bulkUpdateProblems(handle.db, {
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
    await saveSolvedReview(handle.db, 'binary-search')
    await bulkDeleteProblems(handle.db, {
      surface: 'dashboard',
      problemSlugs: ['binary-search', 'two-sum', 'missing-problem'],
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
    expect(
      await handle.db
        .select()
        .from(problemPractice)
        .where(eq(problemPractice.problemSlug, 'binary-search')),
    ).toEqual([])
    expect(
      await handle.db
        .select()
        .from(reviewAttempts)
        .where(eq(reviewAttempts.problemSlug, 'binary-search')),
    ).toEqual([])
  })

  it('upserts page captures by canonical LeetCode slug', async () => {
    const handle = await createTestDb({ seed: false })
    const repository = createProblemsRepository(handle.db)

    await repository.upsertFromLeetCode({
      slug: 'two-sum',
      title: 'Two Sum',
      difficulty: 'easy',
    })

    const saved = await upsertProblemFromPage(handle.db, {
      url: 'https://leetcode.com/problems/two-sum/',
      slug: 'two-sum',
      title: 'Two Sum Updated',
      difficulty: 'Medium',
      isPremium: true,
    })

    expect(saved).toMatchObject({
      slug: 'two-sum',
      title: 'Two Sum Updated',
      difficulty: 'medium',
      isPremium: true,
    })
  })

  it('merges captured LeetCode topics without clearing manual topics', async () => {
    const handle = await createTestDb()

    await createProblem(
      handle.db,
      newProblemInput({
        slugOrUrl: 'two-sum',
        title: 'Two Sum',
        topicLabels: ['Custom Local Topic'],
      }),
    )
    await upsertProblemFromPage(handle.db, {
      url: 'https://leetcode.com/problems/two-sum/',
      slug: 'two-sum',
      title: 'Two Sum',
      difficulty: 'Easy',
      isPremium: false,
      topicLabels: ['Array', 'Hash Map'],
    })

    const saved = await createProblemsRepository(handle.db).getForEdit(
      'two-sum',
    )

    expect(saved?.topics).toEqual([
      { id: 'array', label: 'Array', parentTopics: [] },
      {
        id: 'custom-local-topic',
        label: 'Custom Local Topic',
        parentTopics: [],
      },
      { id: 'hash-table', label: 'Hash Table', parentTopics: [] },
    ])
  })

  it('leaves existing topic links unchanged when page topic labels are omitted', async () => {
    const handle = await createTestDb()

    await createProblem(
      handle.db,
      newProblemInput({
        slugOrUrl: 'two-sum',
        title: 'Two Sum',
        topicLabels: ['Custom Local Topic'],
      }),
    )
    await upsertProblemFromPage(handle.db, {
      url: 'https://leetcode.com/problems/two-sum/',
      slug: 'two-sum',
      title: 'Two Sum',
      difficulty: 'Easy',
      isPremium: false,
    })

    const saved = await createProblemsRepository(handle.db).getForEdit(
      'two-sum',
    )

    expect(saved?.topics).toEqual([
      {
        id: 'custom-local-topic',
        label: 'Custom Local Topic',
        parentTopics: [],
      },
    ])
  })

  it('returns Library rows only for requested slugs', async () => {
    const handle = await createTestDb()
    const repository = createProblemsRepository(handle.db)

    const rows = await repository.getLibraryRowsBySlug(['valid-parentheses'], {
      now: new Date('2026-01-01T10:01:00.000Z'),
    })

    expect(rows.map((row) => row.problem.slug)).toEqual(['valid-parentheses'])
  })

  it('allows callers to preserve input order by mapping rows back by slug', async () => {
    const handle = await createTestDb()
    const repository = createProblemsRepository(handle.db)
    const requestedSlugs = ['valid-parentheses', 'two-sum'] as const

    const rows = await repository.getLibraryRowsBySlug(requestedSlugs, {
      now: new Date('2026-01-01T10:01:00.000Z'),
    })
    const rowsBySlug = new Map(rows.map((row) => [row.problem.slug, row]))

    expect(rows.map((row) => row.problem.slug)).toEqual([
      'two-sum',
      'valid-parentheses',
    ])
    expect(
      requestedSlugs.map((slug) => rowsBySlug.get(slug)?.problem.slug),
    ).toEqual(['valid-parentheses', 'two-sum'])
  })

  it('includes Library row details for requested slugs', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const repository = createProblemsRepository(handle.db)

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

    const rows = await repository.getLibraryRowsBySlug(['two-sum'], {
      now: new Date('2026-01-01T10:01:00.000Z'),
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      problem: { slug: 'two-sum' },
      status: 'scheduled',
      topics: [{ id: 'array', label: 'Array' }],
      companies: [{ id: 'netflix', label: 'Netflix' }],
      state: {
        isStarted: true,
        isDue: false,
        reviewCount: 1,
        lastReviewedAt: solvedAt,
      },
      lastReviewedAt: solvedAt,
      lastSolvedAt: solvedAt,
    })
    expect(rows[0]?.nextReviewAt).toBeInstanceOf(Date)
    expect(rows[0]?.state.dueAt).toEqual(rows[0]?.nextReviewAt)
  })

  it('uses settings target retention for service rows when target retention is omitted or undefined', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await updateSettings(handle.db, { review: { targetRetention: 0.97 } })
    await saveSolvedReview(handle.db)

    const rowAtReviewTime = await getProblemLibraryRowsBySlug(
      handle.db,
      ['two-sum'],
      { now: solvedAt, targetRetention: undefined },
    )
    const rowWithOmittedRetention = await getProblemLibraryRowsBySlug(
      handle.db,
      ['two-sum'],
      { now: serviceRetentionCheckAt },
    )
    const rowWithUndefinedRetention = await getProblemLibraryRowsBySlug(
      handle.db,
      ['two-sum'],
      {
        now: serviceRetentionCheckAt,
        targetRetention: undefined,
      },
    )

    expect(rowAtReviewTime[0]?.status).toBe('scheduled')
    expect(rowWithOmittedRetention[0]).toMatchObject({
      status: 'due',
      state: {
        isDue: true,
      },
    })
    expect(rowWithUndefinedRetention[0]).toMatchObject({
      status: 'due',
      state: {
        isDue: true,
      },
    })
    expect(rowWithUndefinedRetention[0]?.state.retrievability).toBeGreaterThan(
      0.9,
    )
    expect(rowWithUndefinedRetention[0]?.state.retrievability).toBeLessThan(
      0.97,
    )
  })

  it('deduplicates duplicate input slugs before querying', async () => {
    const handle = await createTestDb()
    const { db, queries } = createInstrumentedDb(handle)
    const repository = createProblemsRepository(db)

    await repository.getLibraryRowsBySlug(
      [
        ' Two Sum!! ',
        'two-sum',
        'https://leetcode.com/problems/valid-parentheses/',
        'valid-parentheses',
      ],
      { now: new Date('2026-01-01T10:01:00.000Z') },
    )

    const problemSelect = queries.find(
      (query) =>
        query.method === 'all' &&
        query.sql.includes('from "problems"') &&
        query.sql.includes('"problems"."slug" in'),
    )

    expect(problemSelect).toBeDefined()
    if (!problemSelect) {
      throw new Error('Expected the problem slug select query to be captured.')
    }
    expect(
      problemSelect.params.filter((param) => param === 'two-sum'),
    ).toHaveLength(1)
    expect(
      problemSelect.params.filter((param) => param === 'valid-parentheses'),
    ).toHaveLength(1)
  })
})

describe('ProblemsRepository missing-problem imports', () => {
  it('preserves existing metadata, inserts missing rows with fallbacks, and classifies both sets', async () => {
    const handle = await createTestDb({ seed: false })
    const repository = createProblemsRepository(handle.db)
    const originalCreatedAt = new Date('2026-01-01T00:00:00.000Z').getTime()
    const originalUpdatedAt = new Date('2026-01-02T00:00:00.000Z').getTime()
    const now = new Date('2026-01-03T00:00:00.000Z')

    await handle.db.insert(problems).values({
      slug: 'existing-problem',
      title: 'Original Metadata',
      difficulty: 'hard',
      isPremium: true,
      createdAt: originalCreatedAt,
      updatedAt: originalUpdatedAt,
    })

    const result = await repository.createMissingProblems(
      [
        {
          slug: 'Existing Problem',
          title: 'Incoming Metadata',
          difficulty: 'easy',
          isPremium: false,
        },
        {
          slug: 'explicit_problem',
          title: 'Explicit Metadata',
          difficulty: 'medium',
          isPremium: true,
        },
        {
          slug: 'fallback_problem',
        },
      ],
      now,
    )

    expect(result).toEqual({
      createdSlugs: ['explicit-problem', 'fallback-problem'],
      reusedSlugs: ['existing-problem'],
    })

    const rows = await handle.db.select().from(problems)

    expect(rows).toEqual(
      expect.arrayContaining([
        {
          slug: 'existing-problem',
          title: 'Original Metadata',
          difficulty: 'hard',
          isPremium: true,
          createdAt: originalCreatedAt,
          updatedAt: originalUpdatedAt,
        },
        {
          slug: 'explicit-problem',
          title: 'Explicit Metadata',
          difficulty: 'medium',
          isPremium: true,
          createdAt: now.getTime(),
          updatedAt: now.getTime(),
        },
        {
          slug: 'fallback-problem',
          title: 'Fallback Problem',
          difficulty: 'unknown',
          isPremium: false,
          createdAt: now.getTime(),
          updatedAt: now.getTime(),
        },
      ]),
    )
    expect(
      await handle.db
        .select()
        .from(problemPractice)
        .where(eq(problemPractice.problemSlug, 'fallback-problem')),
    ).toEqual([])
    expect(
      await handle.db
        .select()
        .from(fsrsCards)
        .where(eq(fsrsCards.problemSlug, 'fallback-problem')),
    ).toEqual([])
    expect(
      await handle.db
        .select()
        .from(reviewAttempts)
        .where(eq(reviewAttempts.problemSlug, 'fallback-problem')),
    ).toEqual([])
  })

  it('deduplicates normalized slugs before reading and inserting', async () => {
    const handle = await createTestDb({ seed: false })
    const { db, queries } = createInstrumentedDb(handle)
    const repository = createProblemsRepository(db)

    const result = await repository.createMissingProblems([
      { slug: ' New Problem ' },
      { slug: 'new_problem', title: 'Duplicate Metadata' },
      { slug: 'https://leetcode.com/problems/another-problem/' },
      { slug: 'another-problem' },
    ])

    expect(result).toEqual({
      createdSlugs: ['new-problem', 'another-problem'],
      reusedSlugs: [],
    })

    const problemSelect = queries.find(
      (query) =>
        query.method === 'all' &&
        query.sql.includes('from "problems"') &&
        query.sql.includes('"problems"."slug" in'),
    )

    expect(problemSelect).toBeDefined()
    if (!problemSelect) {
      throw new Error('Expected the problem slug select query to be captured.')
    }
    expect(problemSelect.params).toEqual(['new-problem', 'another-problem'])
    expect(
      queries.some(
        (query) =>
          query.method === 'all' &&
          query.sql.toLowerCase().includes('on conflict do nothing'),
      ),
    ).toBe(true)
  })

  it('treats a slug that races into existence as reused without overwriting it', async () => {
    const handle = await createTestDb({ seed: false })
    const delegate = createProxyCallback(handle.rawDb)
    let raced = false
    const db: Db = drizzle(
      async (sql, params, method) => {
        const result = await delegate(sql, params, method)

        if (
          !raced &&
          method === 'all' &&
          sql.includes('from "problems"') &&
          sql.includes('"problems"."slug" in')
        ) {
          raced = true
          handle.rawDb.exec(
            `INSERT INTO problems (slug, title, difficulty, is_premium, created_at, updated_at) VALUES ('raced-problem', 'Raced Metadata', 'hard', 1, 10, 10)`,
          )
        }

        return result
      },
      { schema },
    )

    const result = await createProblemsRepository(db).createMissingProblems([
      { slug: 'raced_problem', title: 'Incoming Metadata' },
    ])

    expect(result).toEqual({
      createdSlugs: [],
      reusedSlugs: ['raced-problem'],
    })
    await expect(
      createProblemsRepository(handle.db).getBySlug('raced-problem'),
    ).resolves.toMatchObject({
      title: 'Raced Metadata',
      difficulty: 'hard',
      isPremium: true,
    })
  })
})

const solvedAt = new Date('2026-01-01T10:00:00.000Z')
const serviceRetentionCheckAt = new Date('2026-01-02T10:00:00.000Z')

function saveSolvedReview(
  db: Parameters<typeof saveReviewResult>[0],
  problemSlug = 'two-sum',
) {
  return saveReviewResult(db, {
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

function createInstrumentedDb(
  handle: Awaited<ReturnType<typeof createTestDb>>,
) {
  const delegate = createProxyCallback(handle.rawDb)
  const queries: CapturedQuery[] = []
  const db: Db = drizzle(
    (sql, params, method) => {
      queries.push({
        sql,
        params: Array.from(params as readonly unknown[]),
        method,
      })
      return delegate(sql, params, method)
    },
    { schema },
  )

  return { db, queries }
}

interface CapturedQuery {
  sql: string
  params: unknown[]
  method: string
}
