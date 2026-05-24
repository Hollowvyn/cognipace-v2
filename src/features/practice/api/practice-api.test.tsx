import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { createSerializedPracticeDetails } from '@/testing/practice-fixtures'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import {
  useResetPracticeSchedule,
  useSaveReviewResult,
  useSetPracticeSuspended,
} from './practice-api'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

const queryMocks = vi.hoisted(() => ({
  invalidateTaggedQueries: vi.fn(),
}))

vi.mock('@/platform/query/cache-invalidation', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/platform/query/cache-invalidation')>()

  queryMocks.invalidateTaggedQueries.mockImplementation(
    actual.invalidateTaggedQueries,
  )

  return {
    ...actual,
    invalidateTaggedQueries: queryMocks.invalidateTaggedQueries,
  }
})

describe('practice API hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  it('invalidates practice-backed queries after suspend and reset writes', async () => {
    await expectPracticeMutation({
      method: 'practice.setSuspended',
      request: {
        surface: 'dashboard',
        problemSlug: 'two-sum',
        suspended: true,
      },
      useHook: useSetPracticeSuspended,
    })
    await expectPracticeMutation({
      method: 'practice.resetSchedule',
      request: {
        surface: 'dashboard',
        problemSlug: 'two-sum',
      },
      useHook: useResetPracticeSchedule,
    })
  })
})

const practiceDetails = createSerializedPracticeDetails({
  cardId: 'fsrs:two-sum',
})

async function expectPracticeMutation<TRequest>(input: {
  method: string
  request: TRequest
  useHook: () => {
    mutateAsync: (request: TRequest) => Promise<unknown>
  }
}) {
  const { queryClient, wrapper } = createQueryTestHarness()
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  vi.mocked(sendMessage).mockResolvedValue(practiceDetails)
  const { result } = renderHook(() => input.useHook(), { wrapper })

  await act(async () => {
    await result.current.mutateAsync(input.request)
  })

  expect(sendMessage).toHaveBeenCalledWith(input.method, input.request)
  expect(queryMocks.invalidateTaggedQueries).toHaveBeenCalledWith(queryClient, [
    'practice',
    'problems',
    'tracks',
  ])
  expect(invalidateQueries.mock.calls.map(([call]) => call)).toEqual([
    { queryKey: ['practice-details'] },
    { queryKey: ['problems'] },
    { queryKey: ['app-shell-data'] },
    { queryKey: ['today-queue'] },
    { queryKey: ['tracks'] },
  ])
}
