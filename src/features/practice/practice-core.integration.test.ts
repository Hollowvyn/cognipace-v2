import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'

import { createPracticeRepository } from '@/features/practice/data/practice-repository'
import { getTodayQueue } from '@/features/queue/server/queue-service'
import { createTestDb } from '@/platform/db/test-db'
import {
  fsrsCards,
  problemPractice,
  reviewAttempts,
} from '@/platform/db/schema'

describe('practice core', () => {
  it('saves a review with a practice log snapshot and latest aggregate log', async () => {
    const handle = await createTestDb()
    const repository = createPracticeRepository(handle.db)
    const reviewedAt = new Date('2026-01-01T10:00:00.000Z')

    const result = await repository.saveReviewResult({
      problemId: 'leetcode:two-sum',
      rating: 'good',
      reviewedAt,
      elapsedSeconds: 725,
      isCorrect: true,
      log: {
        interviewPattern: 'Hash map',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        languages: 'TypeScript',
        notes: 'Track complements while scanning.',
      },
      reviewAttemptId: 'review-1',
    })

    const [practice] = await handle.db
      .select()
      .from(problemPractice)
      .where(eq(problemPractice.problemId, 'leetcode:two-sum'))
    const [attempt] = await handle.db
      .select()
      .from(reviewAttempts)
      .where(eq(reviewAttempts.id, 'review-1'))

    expect(result.summary).toMatchObject({
      isStarted: true,
      reviewCount: 1,
      suspended: false,
    })
    expect(practice).toMatchObject({
      lastRating: 'good',
      lastElapsedSeconds: 725,
      bestElapsedSeconds: 725,
      interviewPattern: 'Hash map',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
      languages: 'TypeScript',
      notes: 'Track complements while scanning.',
      isSuspended: false,
    })
    expect(attempt).toMatchObject({
      rating: 'good',
      elapsedSeconds: 725,
      interviewPattern: 'Hash map',
      notes: 'Track complements while scanning.',
    })
    expect(JSON.parse(attempt?.fsrsReviewLog ?? '{}')).toMatchObject({
      rating: 'good',
      state: 'new',
      reviewedAt: reviewedAt.toISOString(),
    })
  })

  it('reads a complete practice details model with the latest five attempts', async () => {
    const handle = await createTestDb()
    const repository = createPracticeRepository(handle.db)

    for (const index of [1, 2, 3, 4, 5, 6]) {
      await repository.saveReviewResult({
        problemId: 'leetcode:two-sum',
        rating: 'good',
        reviewedAt: new Date(`2026-01-0${index}T10:00:00.000Z`),
        elapsedSeconds: 600 + index,
        isCorrect: true,
        log: { notes: `Attempt ${index}` },
        reviewAttemptId: `review-${index}`,
      })
    }

    const details = await repository.getPracticeDetails('leetcode:two-sum', {
      now: new Date('2026-01-06T10:01:00.000Z'),
    })

    expect(details).toMatchObject({
      problemId: 'leetcode:two-sum',
      cardId: 'leetcode:two-sum:default',
      canOverrideLatestReview: true,
      currentLog: { notes: 'Attempt 6' },
      summary: {
        isStarted: true,
        reviewCount: 6,
      },
    })
    expect(details.card?.reps).toBe(6)
    expect(details.latestAttempt?.id).toBe('review-6')
    expect(details.recentAttempts.map((attempt) => attempt.id)).toEqual([
      'review-6',
      'review-5',
      'review-4',
      'review-3',
      'review-2',
    ])
  })

  it('reads a log-only practice row as unstarted details', async () => {
    const handle = await createTestDb()
    const repository = createPracticeRepository(handle.db)
    const timestamp = new Date('2026-01-01T10:00:00.000Z').getTime()

    await handle.db.insert(problemPractice).values({
      problemId: 'leetcode:two-sum',
      status: 'new',
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      lastReviewedAt: null,
      solvedCount: 0,
      attemptCount: 0,
      isSuspended: false,
      notes: 'Read the two-pointer variant.',
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    const details = await repository.getPracticeDetails('leetcode:two-sum')

    expect(details).toMatchObject({
      card: null,
      latestAttempt: null,
      canOverrideLatestReview: false,
      currentLog: {
        notes: 'Read the two-pointer variant.',
      },
      summary: {
        phase: 'new',
        isStarted: false,
        reviewCount: 0,
      },
    })
    expect(details.recentAttempts).toEqual([])
  })

  it('carries the current aggregate log snapshot when a quick save has no log draft', async () => {
    const handle = await createTestDb()
    const repository = createPracticeRepository(handle.db)

    await repository.saveReviewResult({
      problemId: 'leetcode:two-sum',
      rating: 'good',
      reviewedAt: new Date('2026-01-01T10:00:00.000Z'),
      log: { notes: 'Keep this note.' },
      reviewAttemptId: 'review-1',
    })
    await repository.saveReviewResult({
      problemId: 'leetcode:two-sum',
      rating: 'hard',
      reviewedAt: new Date('2026-01-02T10:00:00.000Z'),
      reviewAttemptId: 'review-2',
    })

    const [practice] = await handle.db
      .select()
      .from(problemPractice)
      .where(eq(problemPractice.problemId, 'leetcode:two-sum'))
    const [quickAttempt] = await handle.db
      .select()
      .from(reviewAttempts)
      .where(eq(reviewAttempts.id, 'review-2'))

    expect(practice?.notes).toBe('Keep this note.')
    expect(quickAttempt?.notes).toBe('Keep this note.')
  })

  it('merges partial log updates into the latest aggregate snapshot', async () => {
    const handle = await createTestDb()
    const repository = createPracticeRepository(handle.db)

    await repository.saveReviewResult({
      problemId: 'leetcode:two-sum',
      rating: 'good',
      reviewedAt: new Date('2026-01-01T10:00:00.000Z'),
      log: {
        interviewPattern: 'Hash map',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        languages: 'TypeScript',
        notes: 'Initial note.',
      },
      reviewAttemptId: 'review-1',
    })
    await repository.saveReviewResult({
      problemId: 'leetcode:two-sum',
      rating: 'hard',
      reviewedAt: new Date('2026-01-02T10:00:00.000Z'),
      log: { notes: 'Updated note.' },
      reviewAttemptId: 'review-2',
    })

    const [practice] = await handle.db
      .select()
      .from(problemPractice)
      .where(eq(problemPractice.problemId, 'leetcode:two-sum'))
    const [attempt] = await handle.db
      .select()
      .from(reviewAttempts)
      .where(eq(reviewAttempts.id, 'review-2'))

    expect(practice).toMatchObject({
      interviewPattern: 'Hash map',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
      languages: 'TypeScript',
      notes: 'Updated note.',
    })
    expect(attempt).toMatchObject({
      interviewPattern: 'Hash map',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
      languages: 'TypeScript',
      notes: 'Updated note.',
    })
  })

  it('overrides the latest review without appending a duplicate attempt', async () => {
    const handle = await createTestDb()
    const repository = createPracticeRepository(handle.db)

    await repository.saveReviewResult({
      problemId: 'leetcode:two-sum',
      rating: 'good',
      reviewedAt: new Date('2026-01-01T10:00:00.000Z'),
      elapsedSeconds: 800,
      isCorrect: true,
      reviewAttemptId: 'review-1',
    })
    const beforeOverride = await repository.saveReviewResult({
      problemId: 'leetcode:two-sum',
      rating: 'easy',
      reviewedAt: new Date('2026-01-03T10:00:00.000Z'),
      elapsedSeconds: 600,
      isCorrect: true,
      log: {
        interviewPattern: 'Hash map',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        languages: 'TypeScript',
        notes: 'Original note.',
      },
      reviewAttemptId: 'review-2',
    })

    const override = await repository.overrideLastReviewResult({
      problemId: 'leetcode:two-sum',
      rating: 'again',
      elapsedSeconds: 900,
      isCorrect: false,
      log: { notes: 'Missed edge case.' },
    })
    const attempts = await handle.db
      .select()
      .from(reviewAttempts)
      .where(eq(reviewAttempts.problemId, 'leetcode:two-sum'))
    const [practice] = await handle.db
      .select()
      .from(problemPractice)
      .where(eq(problemPractice.problemId, 'leetcode:two-sum'))
    const [card] = await handle.db
      .select()
      .from(fsrsCards)
      .where(eq(fsrsCards.problemId, 'leetcode:two-sum'))

    expect(attempts).toHaveLength(2)
    expect(attempts.find((attempt) => attempt.id === 'review-2')).toMatchObject(
      {
        rating: 'again',
        elapsedSeconds: 900,
        isCorrect: false,
        interviewPattern: 'Hash map',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        languages: 'TypeScript',
        notes: 'Missed edge case.',
      },
    )
    expect(
      JSON.parse(
        attempts.find((attempt) => attempt.id === 'review-2')?.fsrsReviewLog ??
          '{}',
      ),
    ).toMatchObject({
      rating: 'again',
      state: 'learning',
    })
    expect(practice).toMatchObject({
      attemptCount: 2,
      solvedCount: 1,
      lastRating: 'again',
      lastElapsedSeconds: 900,
      bestElapsedSeconds: 800,
      interviewPattern: 'Hash map',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
      languages: 'TypeScript',
      notes: 'Missed edge case.',
      isSuspended: false,
    })
    expect(card?.reps).toBe(2)
    expect(card?.dueAt).not.toBe(beforeOverride.dueAt.getTime())
    expect(override.summary.reviewCount).toBe(2)
  })

  it('overrides the latest saved review when review times match', async () => {
    const handle = await createTestDb()
    const repository = createPracticeRepository(handle.db)
    const reviewedAt = new Date('2026-01-01T10:00:00.000Z')

    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T10:01:00.000Z'))
      await repository.saveReviewResult({
        problemId: 'leetcode:two-sum',
        rating: 'good',
        reviewedAt,
        reviewAttemptId: 'review-1',
      })

      vi.setSystemTime(new Date('2026-01-01T10:02:00.000Z'))
      await repository.saveReviewResult({
        problemId: 'leetcode:two-sum',
        rating: 'easy',
        reviewedAt,
        reviewAttemptId: 'review-2',
      })

      vi.setSystemTime(new Date('2026-01-01T10:03:00.000Z'))
      await repository.overrideLastReviewResult({
        problemId: 'leetcode:two-sum',
        rating: 'again',
      })
    } finally {
      vi.useRealTimers()
    }

    const attempts = await handle.db
      .select()
      .from(reviewAttempts)
      .where(eq(reviewAttempts.problemId, 'leetcode:two-sum'))
    const details = await repository.getPracticeDetails('leetcode:two-sum')

    expect(attempts.find((attempt) => attempt.id === 'review-1')).toMatchObject(
      {
        rating: 'good',
      },
    )
    expect(attempts.find((attempt) => attempt.id === 'review-2')).toMatchObject(
      {
        rating: 'again',
        reviewedAt: reviewedAt.getTime(),
      },
    )
    expect(details.latestAttempt?.id).toBe('review-2')
    expect(details.summary.reviewCount).toBe(2)
  })

  it('suspends and resumes practice without deleting review history', async () => {
    const handle = await createTestDb()
    const repository = createPracticeRepository(handle.db)

    await repository.saveReviewResult({
      problemId: 'leetcode:two-sum',
      rating: 'easy',
      reviewedAt: new Date('2026-01-01T10:00:00.000Z'),
      log: { notes: 'Keep the hash-map invariant.' },
      reviewAttemptId: 'review-1',
    })

    const suspended = await repository.setPracticeSuspended({
      problemId: 'leetcode:two-sum',
      suspended: true,
    })
    const queueWhileSuspended = await getTodayQueue(
      handle.db,
      new Date('2026-01-01T10:01:00.000Z'),
    )
    const resumed = await repository.setPracticeSuspended({
      problemId: 'leetcode:two-sum',
      suspended: false,
    })

    expect(suspended).toMatchObject({
      canOverrideLatestReview: true,
      currentLog: { notes: 'Keep the hash-map invariant.' },
      practice: {
        attemptCount: 1,
        isSuspended: true,
        status: 'review',
      },
      summary: {
        phase: 'suspended',
        suspended: true,
        isDue: false,
      },
    })
    expect(suspended.card?.reps).toBe(1)
    expect(suspended.latestAttempt?.id).toBe('review-1')
    expect(
      queueWhileSuspended.items.some(
        (item) => item.problemId === 'leetcode:two-sum',
      ),
    ).toBe(false)
    expect(resumed).toMatchObject({
      practice: {
        attemptCount: 1,
        isSuspended: false,
        status: 'review',
      },
      summary: {
        phase: 'review',
        suspended: false,
      },
    })
    expect(resumed.card?.reps).toBe(1)
  })

  it('keeps suspension explicit when a suspended problem is reviewed', async () => {
    const handle = await createTestDb()
    const repository = createPracticeRepository(handle.db)

    await repository.setPracticeSuspended({
      problemId: 'leetcode:two-sum',
      suspended: true,
    })

    const result = await repository.saveReviewResult({
      problemId: 'leetcode:two-sum',
      rating: 'good',
      reviewedAt: new Date('2026-01-01T10:00:00.000Z'),
      reviewAttemptId: 'review-1',
    })
    const details = await repository.getPracticeDetails('leetcode:two-sum')

    expect(result.summary).toMatchObject({
      phase: 'suspended',
      suspended: true,
    })
    expect(details).toMatchObject({
      canOverrideLatestReview: true,
      practice: {
        attemptCount: 1,
        isSuspended: true,
        status: 'learning',
      },
      summary: {
        phase: 'suspended',
        suspended: true,
      },
    })
  })

  it('updates current log before any review without creating schedule history', async () => {
    const handle = await createTestDb()
    const repository = createPracticeRepository(handle.db)

    const details = await repository.updateCurrentPracticeLog({
      problemId: 'leetcode:two-sum',
      log: {
        interviewPattern: 'Hash map',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        languages: 'TypeScript',
        notes: 'Use complements.',
      },
    })
    const attempts = await handle.db
      .select()
      .from(reviewAttempts)
      .where(eq(reviewAttempts.problemId, 'leetcode:two-sum'))
    const cards = await handle.db
      .select()
      .from(fsrsCards)
      .where(eq(fsrsCards.problemId, 'leetcode:two-sum'))

    expect(attempts).toEqual([])
    expect(cards).toEqual([])
    expect(details).toMatchObject({
      card: null,
      latestAttempt: null,
      canOverrideLatestReview: false,
      currentLog: {
        interviewPattern: 'Hash map',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        languages: 'TypeScript',
        notes: 'Use complements.',
      },
      practice: {
        status: 'new',
        attemptCount: 0,
        solvedCount: 0,
        isSuspended: false,
      },
      summary: {
        phase: 'new',
        isStarted: false,
        reviewCount: 0,
      },
    })
  })

  it('merges current log patches and clears explicit blank fields', async () => {
    const handle = await createTestDb()
    const repository = createPracticeRepository(handle.db)

    await repository.updateCurrentPracticeLog({
      problemId: 'leetcode:two-sum',
      log: {
        interviewPattern: 'Hash map',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        languages: 'TypeScript',
        notes: 'Keep this note.',
      },
    })

    const details = await repository.updateCurrentPracticeLog({
      problemId: 'leetcode:two-sum',
      log: {
        timeComplexity: null,
        spaceComplexity: '   ',
        notes: 'Updated note.',
      },
    })

    expect(details.currentLog).toEqual({
      interviewPattern: 'Hash map',
      timeComplexity: null,
      spaceComplexity: null,
      languages: 'TypeScript',
      notes: 'Updated note.',
    })
  })

  it('snapshots the current log when a review is saved without a log draft', async () => {
    const handle = await createTestDb()
    const repository = createPracticeRepository(handle.db)

    await repository.updateCurrentPracticeLog({
      problemId: 'leetcode:two-sum',
      log: {
        interviewPattern: 'Hash map',
        notes: 'Saved before solving.',
      },
    })

    await repository.saveReviewResult({
      problemId: 'leetcode:two-sum',
      rating: 'good',
      reviewedAt: new Date('2026-01-01T10:00:00.000Z'),
      reviewAttemptId: 'review-1',
    })

    const [attempt] = await handle.db
      .select()
      .from(reviewAttempts)
      .where(eq(reviewAttempts.id, 'review-1'))

    expect(attempt).toMatchObject({
      interviewPattern: 'Hash map',
      notes: 'Saved before solving.',
    })
  })

  it('reset clears schedule history while preserving log and suspension by default', async () => {
    const handle = await createTestDb()
    const repository = createPracticeRepository(handle.db)

    await repository.saveReviewResult({
      problemId: 'leetcode:two-sum',
      rating: 'good',
      reviewedAt: new Date('2026-01-01T10:00:00.000Z'),
      log: {
        interviewPattern: 'Hash map',
        notes: 'Carry this through reset.',
      },
      reviewAttemptId: 'review-1',
    })
    await repository.setPracticeSuspended({
      problemId: 'leetcode:two-sum',
      suspended: true,
    })

    const reset = await repository.resetPracticeSchedule({
      problemId: 'leetcode:two-sum',
    })
    const attempts = await handle.db
      .select()
      .from(reviewAttempts)
      .where(eq(reviewAttempts.problemId, 'leetcode:two-sum'))
    const cards = await handle.db
      .select()
      .from(fsrsCards)
      .where(eq(fsrsCards.problemId, 'leetcode:two-sum'))

    expect(attempts).toEqual([])
    expect(cards).toEqual([])
    expect(reset).toMatchObject({
      card: null,
      latestAttempt: null,
      canOverrideLatestReview: false,
      currentLog: {
        interviewPattern: 'Hash map',
        notes: 'Carry this through reset.',
      },
      practice: {
        status: 'new',
        attemptCount: 0,
        solvedCount: 0,
        lastRating: null,
        lastElapsedSeconds: null,
        bestElapsedSeconds: null,
        isSuspended: true,
      },
      summary: {
        phase: 'suspended',
        isStarted: false,
        reviewCount: 0,
        suspended: true,
      },
    })
  })

  it('reset can clear the current practice log', async () => {
    const handle = await createTestDb()
    const repository = createPracticeRepository(handle.db)

    await repository.saveReviewResult({
      problemId: 'leetcode:two-sum',
      rating: 'good',
      reviewedAt: new Date('2026-01-01T10:00:00.000Z'),
      log: { notes: 'Clear me.' },
      reviewAttemptId: 'review-1',
    })

    const reset = await repository.resetPracticeSchedule({
      problemId: 'leetcode:two-sum',
      keepLog: false,
    })

    expect(reset.currentLog).toEqual({
      interviewPattern: null,
      timeComplexity: null,
      spaceComplexity: null,
      languages: null,
      notes: null,
    })
  })
})
