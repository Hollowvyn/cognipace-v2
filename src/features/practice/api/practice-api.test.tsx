import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { useSaveReviewResult } from './practice-api'
import type { SerializedReviewResult } from './practice-contracts'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('practice API hooks', () => {
  it('sends saved reviews through the runtime mutation boundary', async () => {
    const { queryClient, wrapper } = createQueryTestHarness()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    vi.mocked(sendMessage).mockResolvedValue(reviewResult)
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

const reviewResult = {
  problemId: 'leetcode:two-sum',
  cardId: 'fsrs:leetcode:two-sum',
  rating: 'good',
  status: 'learning',
  dueAt: '2026-01-02T10:00:00.000Z',
  reviewedAt: '2026-01-01T10:00:00.000Z',
  summary: {
    phase: 'learning',
    nextReviewAt: '2026-01-02T10:00:00.000Z',
    lastReviewedAt: '2026-01-01T10:00:00.000Z',
    reviewCount: 1,
    lapses: 0,
    difficulty: 5,
    stability: 1,
    scheduledDays: 1,
    suspended: false,
    isStarted: true,
    isDue: false,
    isOverdue: false,
    overdueDays: 0,
    retrievability: 1,
  },
} satisfies SerializedReviewResult
