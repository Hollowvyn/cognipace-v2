import { useMutation, useQuery } from '@tanstack/react-query'

import {
  sendMessage,
  type ProblemContextRequest,
  type ProblemsUpsertFromPageRequest,
} from '@/extension/messaging'

export function useProblemContext(request: ProblemContextRequest) {
  return useQuery({
    queryKey: ['problem-context', request.slug],
    queryFn: () => sendMessage('problems.getContext', request),
  })
}

export function useUpsertProblemFromPage() {
  return useMutation({
    mutationFn: (request: ProblemsUpsertFromPageRequest) =>
      sendMessage('problems.upsertFromPage', request),
  })
}
