import { describe, expect, it } from 'vitest'

import {
  createInitialFsrsCard,
  scheduleReview,
  type FsrsCardSnapshot,
} from '@/lib/fsrs'

import {
  derivePracticeSummary,
  normalizeReviewLogFields,
  statusFromReview,
  type PracticeStateSnapshot,
} from './practice'

describe('practice domain', () => {
  it('derives a new unstarted summary without a card or practice row', () => {
    expect(
      derivePracticeSummary({
        practice: null,
        card: null,
        now: baseNow,
      }),
    ).toEqual({
      phase: 'new',
      nextReviewAt: null,
      lastReviewedAt: null,
      reviewCount: 0,
      lapses: 0,
      difficulty: null,
      stability: null,
      scheduledDays: null,
      suspended: false,
      isStarted: false,
      isDue: false,
      isOverdue: false,
      overdueDays: 0,
      retrievability: null,
    })
  })

  it('prefers card state for active summaries and keeps due logic retrievability-based', () => {
    const reviewedCard = reviewedFsrsCard()
    const summary = derivePracticeSummary({
      practice: practiceState({ status: 'learning' }),
      card: reviewedCard,
      now: new Date('2026-06-01T10:00:00.000Z'),
      targetRetention: 0.9,
    })

    expect(summary).toMatchObject({
      phase: 'review',
      nextReviewAt: reviewedCard.dueAt,
      lastReviewedAt: reviewedCard.lastReviewAt,
      reviewCount: reviewedCard.reps,
      lapses: reviewedCard.lapses,
      isStarted: true,
      isDue: true,
      isOverdue: true,
    })
    expect(summary.retrievability).toBeLessThan(0.9)
  })

  it('falls back to practice status when an aggregate exists before a card is available', () => {
    expect(
      derivePracticeSummary({
        practice: practiceState({ status: 'mastered' }),
        card: null,
        now: baseNow,
      }),
    ).toMatchObject({
      phase: 'review',
      reviewCount: 1,
      isStarted: true,
      isDue: false,
    })
  })

  it('treats suspension as a practice-level override', () => {
    expect(
      derivePracticeSummary({
        practice: practiceState({ isSuspended: true, status: 'suspended' }),
        card: reviewedFsrsCard(),
        now: new Date('2026-06-01T10:00:00.000Z'),
      }),
    ).toMatchObject({
      phase: 'suspended',
      suspended: true,
      isDue: false,
      isOverdue: false,
    })
  })

  it('maps FSRS review states to practice statuses', () => {
    expect(statusFromReview('again', reviewedFsrsCard())).toBe('learning')
    expect(
      statusFromReview('good', reviewedFsrsCard({ state: 'learning' })),
    ).toBe('learning')
    expect(
      statusFromReview('good', reviewedFsrsCard({ state: 'relearning' })),
    ).toBe('learning')
    expect(statusFromReview('good', reviewedFsrsCard())).toBe('review')
  })

  it('normalizes blank practice log fields to null and trims text', () => {
    expect(
      normalizeReviewLogFields({
        interviewPattern: '  two pointers ',
        timeComplexity: '',
        spaceComplexity: '   ',
        languages: null,
        notes: ' remember bounds ',
      }),
    ).toEqual({
      interviewPattern: 'two pointers',
      timeComplexity: null,
      spaceComplexity: null,
      languages: null,
      notes: 'remember bounds',
    })
  })
})

function reviewedFsrsCard(
  overrides: Partial<FsrsCardSnapshot> = {},
): FsrsCardSnapshot {
  return {
    ...scheduleReview(createInitialFsrsCard(reviewedAt), 'easy', reviewedAt)
      .card,
    ...overrides,
  }
}

function practiceState(
  overrides: Partial<PracticeStateSnapshot> = {},
): PracticeStateSnapshot {
  return {
    status: 'review',
    lastReviewedAt: reviewedAt,
    attemptCount: 1,
    solvedCount: 1,
    isSuspended: false,
    lastRating: 'easy',
    lastElapsedSeconds: 600,
    bestElapsedSeconds: 600,
    log: {
      interviewPattern: null,
      timeComplexity: null,
      spaceComplexity: null,
      languages: null,
      notes: null,
    },
    ...overrides,
  }
}

const reviewedAt = new Date('2026-01-01T10:00:00.000Z')
const baseNow = new Date('2026-01-01T12:00:00.000Z')
