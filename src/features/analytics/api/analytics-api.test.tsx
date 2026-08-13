import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { analyticsQueryKeys, useAnalyticsSummary } from './analytics-api'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('analytics runtime API', () => {
  it('uses the correct analytics summary query key', () => {
    expect(analyticsQueryKeys.summary(14)).toEqual(['analytics', 'summary', 14])
  })

  it('calls sendMessage with analytics.getSummary and a dashboard surface request', async () => {
    const payload = { generatedAt: '2026-01-15T12:00:00.000Z', reviewDays: 5 }
    vi.mocked(sendMessage).mockResolvedValueOnce(payload as never)

    const { wrapper } = createQueryTestHarness()
    const { result } = renderHook(() => useAnalyticsSummary(90), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(sendMessage).toHaveBeenCalledWith('analytics.getSummary', {
      surface: 'dashboard',
      range: 90,
    })
    expect(result.current.data).toBe(payload)
  })
})
