import { useMutation } from '@tanstack/react-query'

import {
  sendMessage,
  type ProblemsUpsertFromPageRequest,
} from '@/extension/messaging'
import { queryKeys } from '@/platform/query/query-keys'

export const problemsQueryKeys = queryKeys.problems

export function upsertProblemFromPageViaRuntime(
  request: ProblemsUpsertFromPageRequest,
) {
  return sendMessage('problems.upsertFromPage', request)
}

export function useUpsertProblemFromPage() {
  return useMutation({
    mutationFn: upsertProblemFromPageViaRuntime,
  })
}
