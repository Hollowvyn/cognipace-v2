import { useQuery } from '@tanstack/react-query'

import { sendMessage, type QueueRequest } from '@/extension/messaging'

export function useTodayQueue(request: QueueRequest) {
  return useQuery({
    queryKey: ['today-queue', request.at ?? 'now'],
    queryFn: () => sendMessage('queue.getTodayQueue', request),
  })
}
