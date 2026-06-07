import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { queueQueryKeys, useTodayQueue } from './queue-api'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('queue runtime API', () => {
  it('today key uses "now" when at is omitted or null', () => {
    expect(queueQueryKeys.today()).toEqual(['today-queue', 'now'])
    expect(queueQueryKeys.today(null)).toEqual(['today-queue', 'now'])
  })

  it('today key includes the at string when provided', () => {
    expect(queueQueryKeys.today('2026-01-15T12:00:00.000Z')).toEqual([
      'today-queue',
      '2026-01-15T12:00:00.000Z',
    ])
  })

  it('calls sendMessage with queue.getTodayQueue and the full request', async () => {
    const payload = { dueCount: 3, newCount: 1, items: [] }
    vi.mocked(sendMessage).mockResolvedValueOnce(payload)

    const request = { surface: 'popup' as const }
    const { wrapper } = createQueryTestHarness()
    const { result } = renderHook(() => useTodayQueue(request), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(sendMessage).toHaveBeenCalledWith('queue.getTodayQueue', request)
    expect(result.current.data).toBe(payload)
  })

  it('forwards the optional at parameter in the request', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce({})
    const at = '2026-01-15T12:00:00.000Z'
    const request = { surface: 'popup' as const, at }
    const { wrapper } = createQueryTestHarness()
    const { result } = renderHook(() => useTodayQueue(request), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(sendMessage).toHaveBeenCalledWith('queue.getTodayQueue', { surface: 'popup', at })
  })
})
