import { describe, expect, it } from 'vitest'

import { saveReviewResult } from '@/features/practice/server/practice-service'
import { createProblemsRepository } from '@/features/problems/data/problems-repository'
import { getTodayQueue } from '@/features/queue/server/queue-service'
import { createTracksRepository } from '@/features/tracks/data/tracks-repository'
import migration0000 from '@/platform/db/migrations/0000_initial.sql?raw'
import migration0001 from '@/platform/db/migrations/0001_lively_namor.sql?raw'
import migration0002 from '@/platform/db/migrations/0002_add_track_due_at.sql?raw'
import migration0003 from '@/platform/db/migrations/0003_problem_slugs_and_constraints.sql?raw'
import migration0004 from '@/platform/db/migrations/0004_tracks_phase_3.sql?raw'
import { createDb, createSqliteWasmLocator } from '@/platform/db'
import { execProxy, isMutationStatement } from '@/platform/db/proxy'
import { fsrsCards, problemPractice, problems } from '@/platform/db/schema'
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
        'fsrs_cards_problem_slug_kind_unique',
        'companies_label_unique',
        'problem_companies_company_idx',
        'problem_practice_last_reviewed_idx',
        'problem_practice_status_idx',
        'problem_practice_suspended_idx',
        'problem_topics_topic_idx',
        'review_attempts_card_idx',
        'review_attempts_problem_slug_idx',
        'review_attempts_reviewed_at_idx',
        'topics_label_unique',
        'track_group_problems_problem_slug_idx',
        'track_groups_track_idx',
        'track_problem_progress_problem_slug_idx',
        'tracks_slug_unique',
      ]),
    )
  })

  it('migrates track progress ledger state without losing active session', async () => {
    const handle = await createDb({
      locateWasm: createSqliteWasmLocator(),
    })

    handle.rawDb.exec(
      [migration0000, migration0001, migration0002, migration0003].join('\n'),
    )
    handle.rawDb.exec(`
      INSERT INTO problems (
        slug,
        title,
        difficulty,
        is_premium,
        created_at,
        updated_at
      )
      VALUES ('two-sum', 'Two Sum', 'easy', false, 1000, 1000);
      INSERT INTO tracks (
        id,
        slug,
        title,
        description,
        is_active,
        created_at,
        updated_at,
        due_at
      )
      VALUES ('leetcode-75', 'leetcode-75', 'LeetCode 75', null, true, 1000, 1000, null);
      INSERT INTO track_groups (
        id,
        track_id,
        title,
        position,
        created_at,
        updated_at
      )
      VALUES ('leetcode-75:arrays', 'leetcode-75', 'Arrays', 1, 1000, 1000);
      INSERT INTO track_group_problems (track_group_id, problem_slug, position)
      VALUES ('leetcode-75:arrays', 'two-sum', 1);
      INSERT INTO track_session (
        id,
        active_track_id,
        active_group_id,
        started_at,
        updated_at
      )
      VALUES ('active', 'leetcode-75', 'leetcode-75:arrays', 1000, 1000);
    `)

    handle.rawDb.exec(migration0004)

    expect(
      readSqliteRows(handle.rawDb, "PRAGMA table_info('tracks')")
        .map((row) => row[1])
        .includes('is_active'),
    ).toBe(false)
    expect(readSqliteRows(handle.rawDb, 'SELECT id FROM tracks')).toEqual([
      ['leetcode-75'],
    ])
    expect(
      readSqliteRows(
        handle.rawDb,
        'SELECT active_track_id, active_group_id FROM track_session',
      ),
    ).toEqual([['leetcode-75', 'leetcode-75:arrays']])
    expect(
      readSqliteRows(
        handle.rawDb,
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'track_problem_progress'",
      ),
    ).toEqual([['track_problem_progress']])
  })

  it('migrates legacy problem ids to slug-backed problem identity', async () => {
    const handle = await createDb({
      locateWasm: createSqliteWasmLocator(),
    })

    handle.rawDb.exec([migration0000, migration0001, migration0002].join('\n'))
    handle.rawDb.exec(`
      INSERT INTO problems (
        id,
        source,
        external_id,
        slug,
        title,
        difficulty,
        url,
        is_premium,
        acceptance_rate,
        created_at,
        updated_at
      )
      VALUES (
        'leetcode:two-sum',
        'leetcode',
        '1',
        'two-sum',
        'Two Sum',
        'Medium',
        'https://leetcode.com/problems/two-sum/',
        false,
        55.5,
        1000,
        1000
      );

      INSERT INTO topics (id, label) VALUES ('array', 'Array');
      INSERT INTO companies (id, label) VALUES ('meta', 'Meta');
      INSERT INTO tracks (
        id,
        slug,
        title,
        description,
        is_active,
        created_at,
        updated_at,
        due_at
      )
      VALUES ('leetcode-75', 'leetcode-75', 'LeetCode 75', null, true, 1000, 1000, null);
      INSERT INTO track_groups (
        id,
        track_id,
        title,
        position,
        created_at,
        updated_at
      )
      VALUES ('leetcode-75:arrays', 'leetcode-75', 'Arrays', 1, 1000, 1000);
      INSERT INTO problem_topics (problem_id, topic_id)
      VALUES ('leetcode:two-sum', 'array');
      INSERT INTO problem_companies (problem_id, company_id)
      VALUES ('leetcode:two-sum', 'meta');
      INSERT INTO track_group_problems (track_group_id, problem_id, position)
      VALUES ('leetcode-75:arrays', 'leetcode:two-sum', 1);
      INSERT INTO problem_practice (
        problem_id,
        status,
        first_seen_at,
        last_seen_at,
        last_reviewed_at,
        last_rating,
        last_elapsed_seconds,
        best_elapsed_seconds,
        interview_pattern,
        time_complexity,
        space_complexity,
        languages,
        notes,
        solved_count,
        attempt_count,
        is_suspended,
        created_at,
        updated_at
      )
      VALUES (
        'leetcode:two-sum',
        'review',
        1000,
        1000,
        1000,
        'good',
        120,
        120,
        null,
        null,
        null,
        null,
        null,
        1,
        1,
        false,
        1000,
        1000
      );
      INSERT INTO fsrs_cards (
        id,
        problem_id,
        card_kind,
        due_at,
        stability,
        difficulty,
        elapsed_days,
        scheduled_days,
        learning_steps,
        reps,
        lapses,
        state,
        last_review_at,
        created_at,
        updated_at
      )
      VALUES (
        'legacy-card',
        'leetcode:two-sum',
        'recall',
        1000,
        1,
        1,
        0,
        1,
        0,
        1,
        0,
        'review',
        1000,
        1000,
        1000
      );
      INSERT INTO review_attempts (
        id,
        problem_id,
        card_id,
        rating,
        review_mode,
        reviewed_at,
        elapsed_seconds,
        is_correct,
        interview_pattern,
        time_complexity,
        space_complexity,
        languages,
        notes,
        fsrs_review_log,
        created_at,
        updated_at
      )
      VALUES (
        'review-1',
        'leetcode:two-sum',
        'legacy-card',
        'good',
        'manual',
        1000,
        120,
        true,
        null,
        null,
        null,
        null,
        null,
        null,
        1000,
        1000
      );
    `)

    handle.rawDb.exec(migration0003)

    expect(
      readSqliteRows(handle.rawDb, 'SELECT slug, difficulty FROM problems'),
    ).toEqual([['two-sum', 'medium']])
    expect(
      readSqliteRows(handle.rawDb, "PRAGMA table_info('problems')")
        .map((row) => row[1])
        .includes('is_user_created'),
    ).toBe(false)
    expect(
      readSqliteRows(handle.rawDb, 'SELECT problem_slug FROM problem_topics'),
    ).toEqual([['two-sum']])
    expect(
      readSqliteRows(
        handle.rawDb,
        'SELECT problem_slug FROM problem_companies',
      ),
    ).toEqual([['two-sum']])
    expect(
      readSqliteRows(
        handle.rawDb,
        'SELECT problem_slug FROM track_group_problems',
      ),
    ).toEqual([['two-sum']])
    expect(
      readSqliteRows(handle.rawDb, 'SELECT problem_slug FROM problem_practice'),
    ).toEqual([['two-sum']])
    expect(
      readSqliteRows(handle.rawDb, 'SELECT id, problem_slug FROM fsrs_cards'),
    ).toEqual([['two-sum:recall', 'two-sum']])
    expect(
      readSqliteRows(
        handle.rawDb,
        'SELECT problem_slug, card_id FROM review_attempts',
      ),
    ).toEqual([['two-sum', 'two-sum:recall']])
    expect(readSqliteRows(handle.rawDb, 'PRAGMA foreign_key_check')).toEqual([])
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
    const twoSum = await problemsRepository.getBySlug('two-sum')

    expect(twoSum).not.toBeNull()

    const review = await saveReviewResult(handle.db, {
      problemSlug: twoSum?.slug ?? '',
      rating: 'good',
      reviewedAt: new Date('2026-01-01T10:00:00.000Z'),
      isCorrect: true,
      targetRetention: 0.85,
    })
    const queue = await getTodayQueue(
      handle.db,
      new Date('2026-01-01T10:01:00.000Z'),
    )

    expect(review.problemSlug).toBe('two-sum')
    expect(review.dueAt.getTime()).toBeGreaterThan(
      new Date('2026-01-01T10:00:00.000Z').getTime(),
    )
    expect(queue.items[0]?.problemSlug).toBe('two-sum')
  })

  it('rolls back practice state when review history cannot be written', async () => {
    const handle = await createTestDb()
    const reviewedAt = new Date('2026-01-01T10:00:00.000Z')

    await saveReviewResult(handle.db, {
      problemSlug: 'two-sum',
      rating: 'good',
      reviewedAt,
      isCorrect: true,
      reviewAttemptId: 'fixed-review-id',
    })

    const cardBeforeFailure = await handle.db.select().from(fsrsCards).limit(1)
    const practiceBeforeFailure = await handle.db
      .select()
      .from(problemPractice)
      .limit(1)

    await expect(
      saveReviewResult(handle.db, {
        problemSlug: 'two-sum',
        rating: 'easy',
        reviewedAt: new Date('2026-01-02T10:00:00.000Z'),
        isCorrect: true,
        reviewAttemptId: 'fixed-review-id',
      }),
    ).rejects.toThrow()

    const cardAfterFailure = await handle.db.select().from(fsrsCards).limit(1)
    const practiceAfterFailure = await handle.db
      .select()
      .from(problemPractice)
      .limit(1)

    expect(cardAfterFailure[0]?.reps).toBe(cardBeforeFailure[0]?.reps)
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
      problemSlug: 'two-sum',
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
    })

    expect(problem).toMatchObject({
      slug: 'binary-search',
      title: 'Binary Search',
      difficulty: 'easy',
    })
  })
})

function readSqliteIndexNames(rawDb: Parameters<typeof execProxy>[0]) {
  return readSqliteRows(
    rawDb,
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex_%' ORDER BY name",
  ).map((row) => String(row[0]))
}

function readSqliteRows(rawDb: Parameters<typeof execProxy>[0], sql: string) {
  const result = execProxy(rawDb, sql, [], 'all')

  return result.rows as unknown[][]
}
