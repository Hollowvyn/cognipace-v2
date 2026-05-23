import type { SerializedPracticeDetails } from '@/features/practice/api/practice-contracts'

export function createSerializedPracticeSummary(
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

export function createSerializedPracticeDetails(
  overrides: Partial<SerializedPracticeDetails> = {},
): SerializedPracticeDetails {
  return {
    problemSlug: 'two-sum',
    cardId: 'two-sum:default',
    practice: null,
    card: null,
    summary: createSerializedPracticeSummary(),
    currentLog: {
      interviewPattern: null,
      timeComplexity: null,
      spaceComplexity: null,
      languages: null,
      notes: null,
    },
    recentAttempts: [],
    latestAttempt: null,
    canOverrideLatestReview: false,
    ...overrides,
  }
}
