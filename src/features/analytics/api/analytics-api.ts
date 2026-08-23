import { useQuery } from '@tanstack/react-query'

import { sendMessage } from '@/extension/messaging'
import type { AnalyticsRange } from './analytics-contracts'

import { queryKeys } from '@/platform/query/query-keys'

export const analyticsQueryKeys = queryKeys.analytics

export function useAnalyticsSummary(range: AnalyticsRange = 30) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  return useQuery({
    queryKey: analyticsQueryKeys.summary(range, timeZone),
    queryFn: () =>
      sendMessage('analytics.getSummary', {
        surface: 'dashboard',
        range,
        timeZone,
      }),
  })
}
