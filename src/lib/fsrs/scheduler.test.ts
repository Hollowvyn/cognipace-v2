import { describe, expect, it } from 'vitest'

import {
  createInitialFsrsCard,
  getRetrievability,
  scheduleReview,
} from './scheduler'

describe('fsrs scheduler wrapper', () => {
  it('creates a CogniPace card snapshot and schedules a review', () => {
    const reviewedAt = new Date('2026-01-01T10:00:00.000Z')
    const initialCard = createInitialFsrsCard(reviewedAt)
    const result = scheduleReview(initialCard, 'good', reviewedAt, {
      targetRetention: 0.85,
    })

    expect(initialCard.state).toBe('new')
    expect(result.card.reps).toBe(1)
    expect(result.card.dueAt.getTime()).toBeGreaterThan(reviewedAt.getTime())
  })

  it('calculates retrievability without exposing ts-fsrs enums', () => {
    const reviewedAt = new Date('2026-01-01T10:00:00.000Z')
    const result = scheduleReview(
      createInitialFsrsCard(reviewedAt),
      'easy',
      reviewedAt,
    )
    const retrievability = getRetrievability(
      result.card,
      new Date('2026-01-02T10:00:00.000Z'),
    )

    expect(retrievability).toBeGreaterThan(0)
    expect(retrievability).toBeLessThanOrEqual(1)
  })
})
