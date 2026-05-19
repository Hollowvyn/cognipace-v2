import { useMutation, useQuery } from '@tanstack/react-query'

import {
  sendMessage,
  type ProblemContextRequest,
  type ProblemsUpsertFromPageRequest,
} from '@/extension/messaging'

export function getProblemContextViaRuntime(request: ProblemContextRequest) {
  return sendMessage('problems.getContext', request)
}

export function upsertProblemFromPageViaRuntime(
  request: ProblemsUpsertFromPageRequest,
) {
  return sendMessage('problems.upsertFromPage', request)
}

export type RuntimeProblemContext = Awaited<
  ReturnType<typeof getProblemContextViaRuntime>
>

export function useProblemContext(request: ProblemContextRequest) {
  return useQuery({
    queryKey: ['problem-context', request.slug],
    queryFn: () => getProblemContextViaRuntime(request),
  })
}

export function useUpsertProblemFromPage() {
  return useMutation({
    mutationFn: upsertProblemFromPageViaRuntime,
  })
}
