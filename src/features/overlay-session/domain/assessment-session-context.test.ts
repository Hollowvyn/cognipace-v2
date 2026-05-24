import { describe, expect, it } from 'vitest'

import type { SerializedPracticeDetails } from '@/features/practice'

import {
  deriveOverlayAssessmentSessionContext,
  overlaySubmissionSources,
  toAssessmentPracticeContext,
  type OverlaySubmissionSource,
} from './assessment-session-context'

const emptyLog = {
  interviewPattern: null,
  timeComplexity: null,
  spaceComplexity: null,
  languages: null,
  notes: null,
} satisfies SerializedPracticeDetails['currentLog']

describe('deriveOverlayAssessmentSessionContext', () => {
  it('detects a first solve when there is no prior review history', () => {
    const context = deriveOverlayAssessmentSessionContext({
      practice: createPracticeDetails(),
      submissionSource: 'manual-overlay',
      timerUsed: false,
      currentDraftHasChanges: false,
    })

    expect(context).toEqual({
      sessionKind: 'first-solve',
      submissionSource: 'manual-overlay',
      timerUsed: false,
      previousRating: null,
      bestElapsedSeconds: null,
      latestAttemptId: null,
      currentDraftHasChanges: false,
    })
  })

  it('treats a missing practice record as a first solve', () => {
    const context = deriveOverlayAssessmentSessionContext({
      practice: null,
      submissionSource: 'collapsed-quick',
      timerUsed: true,
      currentDraftHasChanges: true,
    })

    expect(context).toMatchObject({
      sessionKind: 'first-solve',
      previousRating: null,
      bestElapsedSeconds: null,
      latestAttemptId: null,
    })
  })

  it('detects a recall review when a latest attempt exists', () => {
    const context = deriveOverlayAssessmentSessionContext({
      practice: createPracticeDetails({
        practice: createPracticeState({
          lastRating: 'good',
          bestElapsedSeconds: 12 * 60,
        }),
        latestAttempt: createPracticeAttempt({
          id: 'attempt-9',
          rating: 'good',
        }),
        summary: createSummary({ reviewCount: 3 }),
      }),
      submissionSource: 'leetcode-watcher',
      timerUsed: true,
      currentDraftHasChanges: false,
    })

    expect(context).toMatchObject({
      sessionKind: 'recall-review',
      previousRating: 'good',
      bestElapsedSeconds: 12 * 60,
      latestAttemptId: 'attempt-9',
    })
  })

  it('detects a recall review from review count even without a latest attempt', () => {
    const context = deriveOverlayAssessmentSessionContext({
      practice: createPracticeDetails({
        summary: createSummary({ reviewCount: 2 }),
      }),
      submissionSource: 'manual-overlay',
      timerUsed: false,
      currentDraftHasChanges: false,
    })

    expect(context.sessionKind).toBe('recall-review')
  })

  it.each(overlaySubmissionSources)(
    'preserves the %s submission source',
    (submissionSource: OverlaySubmissionSource) => {
      const context = deriveOverlayAssessmentSessionContext({
        practice: null,
        submissionSource,
        timerUsed: false,
        currentDraftHasChanges: false,
      })

      expect(context.submissionSource).toBe(submissionSource)
    },
  )

  it('passes through live timer and draft signals', () => {
    const context = deriveOverlayAssessmentSessionContext({
      practice: null,
      submissionSource: 'manual-overlay',
      timerUsed: true,
      currentDraftHasChanges: true,
    })

    expect(context).toMatchObject({
      timerUsed: true,
      currentDraftHasChanges: true,
    })
  })

  it('prefers the practice state rating and best time over the latest attempt', () => {
    const context = deriveOverlayAssessmentSessionContext({
      practice: createPracticeDetails({
        practice: createPracticeState({
          lastRating: 'hard',
          bestElapsedSeconds: 5 * 60,
        }),
        latestAttempt: createPracticeAttempt({ rating: 'good' }),
        summary: createSummary({ reviewCount: 1 }),
      }),
      submissionSource: 'manual-overlay',
      timerUsed: false,
      currentDraftHasChanges: false,
    })

    expect(context).toMatchObject({
      previousRating: 'hard',
      bestElapsedSeconds: 5 * 60,
    })
  })
})

describe('toAssessmentPracticeContext', () => {
  it('maps a recall session to the policy practice context', () => {
    expect(
      toAssessmentPracticeContext({
        sessionKind: 'recall-review',
        submissionSource: 'manual-overlay',
        timerUsed: true,
        previousRating: 'good',
        bestElapsedSeconds: 600,
        latestAttemptId: 'attempt-1',
        currentDraftHasChanges: true,
      }),
    ).toEqual({
      reviewMode: 'recall',
      previousRating: 'good',
      previousBestSeconds: 600,
    })
  })

  it('maps a first solve to the policy practice context', () => {
    expect(
      toAssessmentPracticeContext({
        sessionKind: 'first-solve',
        submissionSource: 'collapsed-quick',
        timerUsed: false,
        previousRating: null,
        bestElapsedSeconds: null,
        latestAttemptId: null,
        currentDraftHasChanges: false,
      }),
    ).toEqual({
      reviewMode: 'first-solve',
      previousRating: null,
      previousBestSeconds: null,
    })
  })
})

function createPracticeDetails(
  overrides: Partial<SerializedPracticeDetails> = {},
): SerializedPracticeDetails {
  return {
    problemSlug: 'two-sum',
    cardId: 'fsrs:two-sum',
    practice: null,
    card: null,
    summary: createSummary(),
    currentLog: emptyLog,
    recentAttempts: [],
    latestAttempt: null,
    canOverrideLatestReview: false,
    ...overrides,
  }
}

function createPracticeState(
  overrides: Partial<NonNullable<SerializedPracticeDetails['practice']>> = {},
): NonNullable<SerializedPracticeDetails['practice']> {
  return {
    status: 'learning',
    lastReviewedAt: '2026-01-01T10:00:00.000Z',
    attemptCount: 1,
    solvedCount: 1,
    isSuspended: false,
    lastRating: 'good',
    lastElapsedSeconds: null,
    bestElapsedSeconds: null,
    log: emptyLog,
    ...overrides,
  }
}

function createPracticeAttempt(
  overrides: Partial<
    NonNullable<SerializedPracticeDetails['latestAttempt']>
  > = {},
): NonNullable<SerializedPracticeDetails['latestAttempt']> {
  return {
    id: 'attempt-1',
    problemSlug: 'two-sum',
    cardId: 'fsrs:two-sum',
    rating: 'good',
    reviewMode: 'leetcode',
    reviewedAt: '2026-01-01T10:00:00.000Z',
    elapsedSeconds: null,
    isCorrect: true,
    log: emptyLog,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    ...overrides,
  }
}

function createSummary(
  overrides: Partial<SerializedPracticeDetails['summary']> = {},
): SerializedPracticeDetails['summary'] {
  return {
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
    ...overrides,
  }
}
