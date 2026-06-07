import { useQuery } from '@tanstack/react-query'

import { sendMessage } from '@/extension/messaging'

export const devSmokeQueryKey = ['dev-smoke'] as const

export function useDevSmokeReport(runLiveGenAi: boolean) {
  return useQuery({
    queryKey: [...devSmokeQueryKey, { runLiveGenAi }] as const,
    queryFn: () =>
      sendMessage('devSmoke.run', {
        surface: 'dashboard',
        runLiveGenAi,
      }),
  })
}
