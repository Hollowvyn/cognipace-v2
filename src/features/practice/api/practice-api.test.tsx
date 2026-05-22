import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { useSaveReviewResult } from './practice-api'
import type { SerializedPracticeDetails } from './practice-contracts'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('practice API hooks', () => {
  it('sends saved reviews through the runtime mutation boundary', async () => {
    const { queryClient, wrapper } = createQueryTestHarness()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    vi.mocked(sendMessage).mockResolvedValue(practiceDetails)
    const { result } = renderHook(() => useSaveReviewResult(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({
        surface: 'content-script',
        problemId: 'leetcode:two-sum',
        rating: 'good',
      })
    })

    expect(sendMessage).toHaveBeenCalledWith('practice.saveReviewResult', {
      surface: 'content-script',
      problemId: 'leetcode:two-sum',
      rating: 'good',
    })
    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})

const practiceDetails = {
  problemId: 'leetcode:two-sum',
  cardId: 'fsrs:leetcode:two-sum',
  practice: null,
  card: null,
  summary: {
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
  },
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
} satisfies SerializedPracticeDetails
