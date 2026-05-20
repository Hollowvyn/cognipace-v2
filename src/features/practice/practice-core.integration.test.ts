import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { createPracticeRepository } from '@/features/practice'
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

  it('preserves the latest aggregate log when a quick save has no log draft', async () => {
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
    expect(quickAttempt?.notes).toBeNull()
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
    expect(attempts.find((attempt) => attempt.id === 'review-2')).toMatchObject({
      rating: 'again',
      elapsedSeconds: 900,
      isCorrect: false,
      notes: 'Missed edge case.',
    })
    expect(
      JSON.parse(
        attempts.find((attempt) => attempt.id === 'review-2')
          ?.fsrsReviewLog ?? '{}',
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
      notes: 'Missed edge case.',
      isSuspended: false,
    })
    expect(card?.reps).toBe(2)
    expect(card?.dueAt).not.toBe(beforeOverride.dueAt.getTime())
    expect(override.summary.reviewCount).toBe(2)
  })
})
