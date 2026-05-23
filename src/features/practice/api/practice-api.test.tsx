import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { createSerializedPracticeDetails } from '@/testing/practice-fixtures'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { useSaveReviewResult } from './practice-api'

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
        problemSlug: 'two-sum',
        rating: 'good',
      })
    })

    expect(sendMessage).toHaveBeenCalledWith('practice.saveReviewResult', {
      surface: 'content-script',
      problemSlug: 'two-sum',
      rating: 'good',
    })
    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})

const practiceDetails = createSerializedPracticeDetails({
  cardId: 'fsrs:two-sum',
})
