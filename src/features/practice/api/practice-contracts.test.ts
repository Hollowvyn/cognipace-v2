import { describe, expect, it } from 'vitest'

import {
  practiceOverrideLastReviewResultRequestSchema,
  practiceReviewResultSchema,
} from './practice-contracts'

describe('practice runtime contracts', () => {
  it('accepts serialized review results with a review attempt id', () => {
    expect(
      practiceReviewResultSchema.parse({
        problemSlug: 'two-sum',
        cardId: 'two-sum:default',
        reviewAttemptId: 'review-1',
        rating: 'good',
        status: 'review',
        dueAt: '2026-01-02T10:00:00.000Z',
        reviewedAt: '2026-01-01T10:00:00.000Z',
        summary: {
          phase: 'review',
          nextReviewAt: '2026-01-02T10:00:00.000Z',
          lastReviewedAt: '2026-01-01T10:00:00.000Z',
          reviewCount: 1,
          lapses: 0,
          difficulty: 5,
          stability: 2,
          scheduledDays: 1,
          suspended: false,
          isStarted: true,
          isDue: false,
          isOverdue: false,
          overdueDays: 0,
          retrievability: 1,
        },
      }),
    ).toMatchObject({
      reviewAttemptId: 'review-1',
    })
  })

  it('rejects missing or invalid review attempt ids on review results', () => {
    const reviewResult = {
      problemSlug: 'two-sum',
      cardId: 'two-sum:default',
      reviewAttemptId: 'review-1',
      rating: 'good',
      status: 'review',
      dueAt: '2026-01-02T10:00:00.000Z',
      reviewedAt: '2026-01-01T10:00:00.000Z',
      summary: {
        phase: 'review',
        nextReviewAt: '2026-01-02T10:00:00.000Z',
        lastReviewedAt: '2026-01-01T10:00:00.000Z',
        reviewCount: 1,
        lapses: 0,
        difficulty: 5,
        stability: 2,
        scheduledDays: 1,
        suspended: false,
        isStarted: true,
        isDue: false,
        isOverdue: false,
        overdueDays: 0,
        retrievability: 1,
      },
    }

    expect(() =>
      practiceReviewResultSchema.parse({
        ...reviewResult,
        reviewAttemptId: undefined,
      }),
    ).toThrow()
    expect(() =>
      practiceReviewResultSchema.parse({
        ...reviewResult,
        reviewAttemptId: 123,
      }),
    ).toThrow()
  })

  it('rejects reviewedAt on override requests', () => {
    expect(() =>
      practiceOverrideLastReviewResultRequestSchema.parse({
        surface: 'content-script',
        problemSlug: 'two-sum',
        rating: 'good',
        reviewedAt: '2026-01-01T10:00:00.000Z',
      }),
    ).toThrow()
  })
})
