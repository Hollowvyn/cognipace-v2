import { useQuery } from '@tanstack/react-query'

import { sendMessage } from '@/extension/messaging'

import { queryKeys } from '@/platform/query/query-keys'

export const analyticsQueryKeys = queryKeys.analytics

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: analyticsQueryKeys.summary(),
    queryFn: () =>
      sendMessage('analytics.getSummary', { surface: 'dashboard' }),
  })
}
