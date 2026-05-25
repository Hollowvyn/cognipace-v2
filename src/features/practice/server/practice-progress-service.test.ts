import { describe, expect, it } from 'vitest'

import { createTestDb } from '@/platform/db/test-db'

import { createPracticeRepository } from '../data/practice-repository'
import { getPracticeProgressSummary } from './practice-service'

describe('getPracticeProgressSummary', () => {
  it('counts unique problems practiced today through the repository boundary', async () => {
    const handle = await createTestDb()
    const repository = createPracticeRepository(handle.db)
    const now = new Date('2026-05-25T16:30:00.000Z')

    await repository.saveReviewResult({
      problemSlug: 'two-sum',
      rating: 'again',
      reviewedAt: new Date('2026-05-25T10:00:00.000Z'),
      reviewMode: 'manual',
    })
    await repository.saveReviewResult({
      problemSlug: 'valid-parentheses',
      rating: 'hard',
      reviewedAt: new Date('2026-05-25T11:00:00.000Z'),
      reviewMode: 'manual',
    })
    await repository.saveReviewResult({
      problemSlug: 'reverse-linked-list',
      rating: 'good',
      reviewedAt: new Date('2026-05-25T12:00:00.000Z'),
      reviewMode: 'manual',
    })
    await repository.saveReviewResult({
      problemSlug: 'lru-cache',
      rating: 'easy',
      reviewedAt: new Date('2026-05-25T13:00:00.000Z'),
      reviewMode: 'manual',
    })
    await repository.saveReviewResult({
      problemSlug: 'two-sum',
      rating: 'again',
      reviewedAt: new Date('2026-05-25T14:00:00.000Z'),
      reviewMode: 'manual',
    })

    await expect(
      getPracticeProgressSummary(handle.db, {
        dailyGoal: 4,
        now,
      }),
    ).resolves.toMatchObject({
      completedToday: 4,
      currentStreak: 1,
      dailyGoal: 4,
      goalMetToday: true,
    })
  })

  it('requires today to meet the daily goal before reporting the current streak', async () => {
    const handle = await createTestDb()
    const repository = createPracticeRepository(handle.db)
    const now = new Date('2026-05-25T16:30:00.000Z')

    await repository.saveReviewResult({
      problemSlug: 'two-sum',
      rating: 'good',
      reviewedAt: new Date('2026-05-24T10:00:00.000Z'),
      reviewMode: 'manual',
    })
    await repository.saveReviewResult({
      problemSlug: 'valid-parentheses',
      rating: 'easy',
      reviewedAt: new Date('2026-05-24T11:00:00.000Z'),
      reviewMode: 'manual',
    })
    await repository.saveReviewResult({
      problemSlug: 'two-sum',
      rating: 'again',
      reviewedAt: new Date('2026-05-25T12:00:00.000Z'),
      reviewMode: 'manual',
    })

    await expect(
      getPracticeProgressSummary(handle.db, {
        dailyGoal: 2,
        now,
      }),
    ).resolves.toMatchObject({
      completedToday: 1,
      currentStreak: 0,
      dailyGoal: 2,
      goalMetToday: false,
    })
  })
})
