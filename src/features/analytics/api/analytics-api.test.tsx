import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { createSerializedAnalyticsSummary } from '@/testing/analytics-fixtures'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { analyticsQueryKeys, useAnalyticsSummary } from './analytics-api'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('analytics runtime API', () => {
  it('uses the correct analytics summary query key', () => {
    expect(analyticsQueryKeys.summary(14, 'America/New_York')).toEqual([
      'analytics',
      'summary',
      14,
      'America/New_York',
    ])
  })

  it('calls sendMessage with analytics.getSummary and a dashboard surface request', async () => {
    const payload = createSerializedAnalyticsSummary()
    vi.mocked(sendMessage).mockResolvedValueOnce(payload)

    const { wrapper } = createQueryTestHarness()
    const { result } = renderHook(() => useAnalyticsSummary(90), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    expect(sendMessage).toHaveBeenCalledWith('analytics.getSummary', {
      surface: 'dashboard',
      range: 90,
      timeZone,
    })
    expect(result.current.data).toEqual(payload)
  })

  it('rejects incompatible summaries before dashboard components render them', async () => {
    const summary = createSerializedAnalyticsSummary()

    vi.mocked(sendMessage).mockResolvedValueOnce({
      ...summary,
      views: {
        ...summary.views,
        observedRecallVsFsrs: {
          rows: summary.views.observedRecallVsFsrs.rows,
        },
      },
    } as never)

    const { wrapper } = createQueryTestHarness()
    const { result } = renderHook(() => useAnalyticsSummary(90), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toHaveProperty('name', 'ZodError')
  })
})
