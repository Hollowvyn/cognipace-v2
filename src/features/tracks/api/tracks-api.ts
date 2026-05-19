import { useQuery } from '@tanstack/react-query'

import { sendMessage, type TracksRequest } from '@/extension/messaging'

export function useActiveTrack(request: TracksRequest) {
  return useQuery({
    queryKey: ['active-track'],
    queryFn: () => sendMessage('tracks.getActiveTrack', request),
  })
}
