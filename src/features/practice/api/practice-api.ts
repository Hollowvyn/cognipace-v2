import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  sendMessage,
  type PracticeOverrideLastReviewResultRequest,
  type PracticeSaveReviewResultRequest,
} from '@/extension/messaging'

const practiceRelatedQueryKeys = [
  ['today-queue'],
  ['app-shell-data'],
  ['problem-context'],
] as const

export function saveReviewResultViaRuntime(
  request: PracticeSaveReviewResultRequest,
) {
  return sendMessage('practice.saveReviewResult', request)
}

export function overrideLastReviewResultViaRuntime(
  request: PracticeOverrideLastReviewResultRequest,
) {
  return sendMessage('practice.overrideLastReviewResult', request)
}

export function useSaveReviewResult() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: saveReviewResultViaRuntime,
    onSuccess: () => {
      invalidatePracticeRelatedQueries(queryClient)
    },
  })
}

export function useOverrideLastReviewResult() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: overrideLastReviewResultViaRuntime,
    onSuccess: () => {
      invalidatePracticeRelatedQueries(queryClient)
    },
  })
}

function invalidatePracticeRelatedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  for (const queryKey of practiceRelatedQueryKeys) {
    void queryClient.invalidateQueries({ queryKey })
  }
}
