import { useQuery } from '@tanstack/react-query'

import { sendMessage, type QueueRequest } from '@/extension/messaging'
import { queryKeys } from '@/platform/query/query-keys'

export const queueQueryKeys = queryKeys.queue

export function useTodayQueue(request: QueueRequest) {
  return useQuery({
    queryKey: queueQueryKeys.today(request.at),
    queryFn: () => sendMessage('queue.getTodayQueue', request),
  })
}
