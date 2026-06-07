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
    expect(analyticsQueryKeys.summary()).toEqual(['analytics', 'summary'])
  })

  it('calls sendMessage with analytics.getSummary and an empty request', async () => {
    const payload = { generatedAt: '2026-01-15T12:00:00.000Z', reviewDays: 5 }
    vi.mocked(sendMessage).mockResolvedValueOnce(payload)

    const { wrapper } = createQueryTestHarness()
    const { result } = renderHook(() => useAnalyticsSummary(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(sendMessage).toHaveBeenCalledWith('analytics.getSummary', {})
    expect(result.current.data).toBe(payload)
  })
})
