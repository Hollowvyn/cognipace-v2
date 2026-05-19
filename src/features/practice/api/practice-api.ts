import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  sendMessage,
  type PracticeSaveReviewResultRequest,
} from '@/extension/messaging'

export function useSaveReviewResult() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: PracticeSaveReviewResultRequest) =>
      sendMessage('practice.saveReviewResult', request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['today-queue'] })
      void queryClient.invalidateQueries({ queryKey: ['app-shell-data'] })
    },
  })
}
