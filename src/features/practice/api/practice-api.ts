import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  sendMessage,
  type PracticeSaveReviewResultRequest,
} from '@/extension/messaging'

export function saveReviewResultViaRuntime(
  request: PracticeSaveReviewResultRequest,
) {
  return sendMessage('practice.saveReviewResult', request)
}

export function useSaveReviewResult() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: saveReviewResultViaRuntime,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['today-queue'] })
      void queryClient.invalidateQueries({ queryKey: ['app-shell-data'] })
    },
  })
}
