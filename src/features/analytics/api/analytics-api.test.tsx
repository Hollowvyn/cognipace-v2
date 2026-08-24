import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { analyticsQueryKeys, useAnalyticsSummary } from './analytics-api'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('analytics runtime API', () => {
  it('uses distinct query keys for every long-range option and time zone', () => {
    expect(analyticsQueryKeys.summary(90, 'America/New_York')).toEqual([
      'analytics',
      'summary',
      90,
      'America/New_York',
    ])
    expect(analyticsQueryKeys.summary(120, 'America/New_York')).not.toEqual(
      analyticsQueryKeys.summary(90, 'America/New_York'),
    )
    expect(analyticsQueryKeys.summary('all', 'America/New_York')).not.toEqual(
      analyticsQueryKeys.summary(120, 'America/New_York'),
    )
    expect(analyticsQueryKeys.summary(90, 'UTC')).not.toEqual(
      analyticsQueryKeys.summary(90, 'America/New_York'),
    )
  })

  it('defaults analytics summary requests to 90 days', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce({} as never)

    const { wrapper } = createQueryTestHarness()
    const { result } = renderHook(() => useAnalyticsSummary(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    expect(sendMessage).toHaveBeenCalledWith('analytics.getSummary', {
      surface: 'dashboard',
      range: 90,
      timeZone,
    })
  })

  it('calls sendMessage with analytics.getSummary and a dashboard surface request', async () => {
    const payload = { generatedAt: '2026-01-15T12:00:00.000Z', reviewDays: 5 }
    vi.mocked(sendMessage).mockResolvedValueOnce(payload as never)

    const { wrapper } = createQueryTestHarness()
    const { result } = renderHook(() => useAnalyticsSummary(90), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    expect(sendMessage).toHaveBeenCalledWith('analytics.getSummary', {
      surface: 'dashboard',
      range: 90,
      timeZone,
    })
    expect(result.current.data).toBe(payload)
  })

  it('sends all-time summary requests without coercing the range', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce({} as never)

    const { wrapper } = createQueryTestHarness()
    const { result } = renderHook(() => useAnalyticsSummary('all'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    expect(sendMessage).toHaveBeenCalledWith('analytics.getSummary', {
      surface: 'dashboard',
      range: 'all',
      timeZone,
    })
  })
})
