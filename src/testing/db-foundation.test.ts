import { describe, expect, it } from 'vitest'

import { createPracticeRepository } from '@/features/practice/data/practice-repository'
import { createProblemsRepository } from '@/features/problems/data/problems-repository'
import { getTodayQueue } from '@/features/queue/server/queue-service'
import { createTracksRepository } from '@/features/tracks/data/tracks-repository'
import { createDb, createSqliteWasmLocator } from '@/platform/db'
import { execProxy, isMutationStatement } from '@/platform/db/proxy'
import { problemPractice, problems } from '@/platform/db/schema'
import { createTestDb } from '@/platform/db/test-db'

import { deserializeDb, serializeDb } from '@/platform/db/snapshot'

describe('db foundation', () => {
  it('boots sqlite, applies migrations, and seeds the starter catalog', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    const rows = await handle.db.select().from(problems)
    const activeTrack = await createTracksRepository(handle.db).getActiveTrack()

    expect(rows.map((row) => row.slug)).toEqual([
      'two-sum',
      'valid-parentheses',
    ])
    expect(activeTrack?.track.title).toBe('LeetCode 75')
    expect(activeTrack?.nextProblem?.slug).toBe('two-sum')
  })

  it('keeps migration indexes aligned with current query paths', async () => {
    const handle = await createTestDb({ seed: false })
    const indexNames = readSqliteIndexNames(handle.rawDb)

    expect(indexNames).toEqual(
      expect.arrayContaining([
        'fsrs_cards_due_idx',
        'fsrs_cards_problem_kind_unique',
        'companies_label_unique',
        'problem_companies_company_idx',
        'problem_practice_last_reviewed_idx',
        'problem_practice_status_idx',
        'problem_practice_suspended_idx',
        'problem_topics_topic_idx',
        'problems_slug_idx',
        'problems_slug_unique',
        'review_attempts_card_idx',
        'review_attempts_problem_idx',
        'review_attempts_reviewed_at_idx',
        'topics_label_unique',
        'track_group_problems_problem_idx',
        'track_groups_track_idx',
        'tracks_active_idx',
        'tracks_slug_unique',
      ]),
    )
  })

  it('classifies snapshot-worthy sqlite statements without transaction noise', () => {
    expect(isMutationStatement('insert into problems values (?)')).toBe(true)
    expect(isMutationStatement('UPDATE problem_practice SET status = ?')).toBe(
      true,
    )
    expect(isMutationStatement('begin')).toBe(false)
    expect(isMutationStatement('commit')).toBe(false)
    expect(isMutationStatement('select * from problems')).toBe(false)
  })

  it('round-trips a serialized sqlite snapshot', async () => {
    const original = await createTestDb()
    const bytes = serializeDb(original)
    const restored = await createDb({
      locateWasm: createSqliteWasmLocator(),
    })

    deserializeDb(restored, bytes)

    const restoredRows = await restored.db.select().from(problems)

    expect(restoredRows).toHaveLength(2)
    expect(restoredRows[0]?.slug).toBe('two-sum')
  })

  it('saves a review result and updates the queue from data state', async () => {
    const handle = await createTestDb()
    const problemsRepository = createProblemsRepository(handle.db)
    const practiceRepository = createPracticeRepository(handle.db)
    const twoSum = await problemsRepository.getBySlug('two-sum')

    expect(twoSum).not.toBeNull()

    const review = await practiceRepository.saveReviewResult({
      problemId: twoSum?.id ?? '',
      rating: 'good',
      reviewedAt: new Date('2026-01-01T10:00:00.000Z'),
      isCorrect: true,
      targetRetention: 0.85,
    })
    const queue = await getTodayQueue(
      handle.db,
      new Date('2026-01-01T10:01:00.000Z'),
    )

    expect(review.problemId).toBe('leetcode:two-sum')
    expect(review.dueAt.getTime()).toBeGreaterThan(
      new Date('2026-01-01T10:00:00.000Z').getTime(),
    )
    expect(queue.items[0]?.slug).toBe('two-sum')
  })

  it('rolls back practice state when review history cannot be written', async () => {
    const handle = await createTestDb()
    const practiceRepository = createPracticeRepository(handle.db)
    const reviewedAt = new Date('2026-01-01T10:00:00.000Z')

    await practiceRepository.saveReviewResult({
      problemId: 'leetcode:two-sum',
      rating: 'good',
      reviewedAt,
      isCorrect: true,
      reviewAttemptId: 'fixed-review-id',
    })

    const cardBeforeFailure =
      await practiceRepository.getCard('leetcode:two-sum')
    const practiceBeforeFailure = await handle.db
      .select()
      .from(problemPractice)
      .limit(1)

    await expect(
      practiceRepository.saveReviewResult({
        problemId: 'leetcode:two-sum',
        rating: 'easy',
        reviewedAt: new Date('2026-01-02T10:00:00.000Z'),
        isCorrect: true,
        reviewAttemptId: 'fixed-review-id',
      }),
    ).rejects.toThrow()

    const cardAfterFailure =
      await practiceRepository.getCard('leetcode:two-sum')
    const practiceAfterFailure = await handle.db
      .select()
      .from(problemPractice)
      .limit(1)

    expect(cardAfterFailure?.reps).toBe(cardBeforeFailure?.reps)
    expect(practiceAfterFailure[0]?.attemptCount).toBe(
      practiceBeforeFailure[0]?.attemptCount,
    )
    expect(practiceAfterFailure[0]?.solvedCount).toBe(
      practiceBeforeFailure[0]?.solvedCount,
    )
  })

  it('keeps track preview catalog-backed when a problem is mastered', async () => {
    const handle = await createTestDb()
    const timestamp = new Date('2026-01-01T00:00:00.000Z').getTime()

    await handle.db.insert(problemPractice).values({
      problemId: 'leetcode:two-sum',
      status: 'mastered',
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      lastReviewedAt: timestamp,
      solvedCount: 1,
      attemptCount: 1,
      isSuspended: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    const activeTrack = await createTracksRepository(handle.db).getActiveTrack()

    expect(activeTrack?.nextProblem).toMatchObject({
      slug: 'two-sum',
    })
    expect(activeTrack?.progress).toEqual({
      completedCount: 0,
      totalCount: 1,
      percent: 0,
    })
  })

  it('can create a new LeetCode problem from page data', async () => {
    const handle = await createTestDb()
    const repository = createProblemsRepository(handle.db)

    const problem = await repository.upsertFromLeetCode({
      slug: 'binary-search',
      title: 'Binary Search',
      difficulty: 'Easy',
      url: 'https://leetcode.com/problems/binary-search/',
    })

    expect(problem).toMatchObject({
      id: 'leetcode:binary-search',
      slug: 'binary-search',
      title: 'Binary Search',
      difficulty: 'easy',
    })
  })
})

function readSqliteIndexNames(rawDb: Parameters<typeof execProxy>[0]) {
  const result = execProxy(
    rawDb,
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex_%' ORDER BY name",
    [],
    'all',
  )

  return (result.rows as unknown[][]).map((row) => String(row[0]))
}
