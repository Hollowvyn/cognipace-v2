import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  sendMessage,
} from '@/extension/messaging'
import { invalidateTaggedQueries } from '@/platform/query/cache-invalidation'
import { queryKeys } from '@/platform/query/query-keys'

import type {
  ProblemsBulkDeleteRequest,
  ProblemsBulkUpdateProblemsRequest,
  ProblemsCreateProblemRequest,
  ProblemsDeleteProblemRequest,
  ProblemsGetLibraryRequest,
  ProblemsGetProblemForEditRequest,
  ProblemsUpdateProblemRequest,
  ProblemsUpsertFromPageRequest,
} from './problems-contracts'

export const problemsQueryKeys = queryKeys.problems

export function upsertProblemFromPageViaRuntime(
  request: ProblemsUpsertFromPageRequest,
) {
  return sendMessage('problems.upsertFromPage', request)
}

export function getProblemLibraryViaRuntime(request: ProblemsGetLibraryRequest) {
  return sendMessage('problems.getLibrary', request)
}

export function getProblemForEditViaRuntime(
  request: ProblemsGetProblemForEditRequest,
) {
  return sendMessage('problems.getProblemForEdit', request)
}

export function createProblemViaRuntime(request: ProblemsCreateProblemRequest) {
  return sendMessage('problems.createProblem', request)
}

export function updateProblemViaRuntime(request: ProblemsUpdateProblemRequest) {
  return sendMessage('problems.updateProblem', request)
}

export function deleteProblemViaRuntime(request: ProblemsDeleteProblemRequest) {
  return sendMessage('problems.deleteProblem', request)
}

export function bulkUpdateProblemsViaRuntime(
  request: ProblemsBulkUpdateProblemsRequest,
) {
  return sendMessage('problems.bulkUpdateProblems', request)
}

export function bulkDeleteProblemsViaRuntime(
  request: ProblemsBulkDeleteRequest,
) {
  return sendMessage('problems.bulkDelete', request)
}

export function useProblemLibrary(request: ProblemsGetLibraryRequest) {
  return useQuery({
    queryKey: problemsQueryKeys.library(request.at),
    queryFn: () => getProblemLibraryViaRuntime(request),
  })
}

export function useProblemForEdit(request: ProblemsGetProblemForEditRequest) {
  return useQuery({
    queryKey: problemsQueryKeys.edit(request.problemSlug),
    queryFn: () => getProblemForEditViaRuntime(request),
  })
}

export function useUpsertProblemFromPage() {
  return useMutation({
    mutationFn: upsertProblemFromPageViaRuntime,
  })
}

export function useCreateProblem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createProblemViaRuntime,
    onSuccess: () => {
      invalidateTaggedQueries(queryClient, ['problems'])
    },
  })
}

export function useUpdateProblem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateProblemViaRuntime,
    onSuccess: () => {
      invalidateTaggedQueries(queryClient, ['problems'])
    },
  })
}

export function useDeleteProblem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteProblemViaRuntime,
    onSuccess: () => {
      invalidateTaggedQueries(queryClient, ['problems'])
    },
  })
}

export function useBulkUpdateProblems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: bulkUpdateProblemsViaRuntime,
    onSuccess: () => {
      invalidateTaggedQueries(queryClient, ['problems'])
    },
  })
}

export function useBulkDeleteProblems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: bulkDeleteProblemsViaRuntime,
    onSuccess: () => {
      invalidateTaggedQueries(queryClient, ['problems'])
    },
  })
}
