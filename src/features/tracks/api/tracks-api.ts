import { useQuery } from '@tanstack/react-query'

import { sendMessage, type TracksRequest } from '@/extension/messaging'
import { queryKeys } from '@/platform/query/query-keys'

export const tracksQueryKeys = queryKeys.tracks

export function useActiveTrack(request: TracksRequest) {
  return useQuery({
    queryKey: tracksQueryKeys.active(request.surface),
    queryFn: () => sendMessage('tracks.getActiveTrack', request),
  })
}
