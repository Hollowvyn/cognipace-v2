import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { sendMessage } from '@/extension/messaging'

import type {
  PracticeDetailsRequest,
  PracticeOverrideLastReviewResultRequest,
  PracticeResetScheduleRequest,
  PracticeSaveReviewResultRequest,
  PracticeSetSuspendedRequest,
  PracticeUpdateCurrentLogRequest,
} from './practice-contracts'

const practiceRelatedQueryKeys = [
  ['practice-details'],
  ['today-queue'],
  ['app-shell-data'],
  ['problem-context'],
] as const

export function saveReviewResultViaRuntime(
  request: PracticeSaveReviewResultRequest,
) {
  return sendMessage('practice.saveReviewResult', request)
}

export function getPracticeDetailsViaRuntime(request: PracticeDetailsRequest) {
  return sendMessage('practice.getDetails', request)
}

export function overrideLastReviewResultViaRuntime(
  request: PracticeOverrideLastReviewResultRequest,
) {
  return sendMessage('practice.overrideLastReviewResult', request)
}

export function setPracticeSuspendedViaRuntime(
  request: PracticeSetSuspendedRequest,
) {
  return sendMessage('practice.setSuspended', request)
}

export function resetPracticeScheduleViaRuntime(
  request: PracticeResetScheduleRequest,
) {
  return sendMessage('practice.resetSchedule', request)
}

export function updateCurrentPracticeLogViaRuntime(
  request: PracticeUpdateCurrentLogRequest,
) {
  return sendMessage('practice.updateCurrentLog', request)
}

export type RuntimePracticeDetails = Awaited<
  ReturnType<typeof getPracticeDetailsViaRuntime>
>

export function usePracticeDetails(request: PracticeDetailsRequest) {
  return useQuery({
    queryKey: ['practice-details', request.problemId, request.at ?? null],
    queryFn: () => getPracticeDetailsViaRuntime(request),
  })
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

export function useSetPracticeSuspended() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: setPracticeSuspendedViaRuntime,
    onSuccess: () => {
      invalidatePracticeRelatedQueries(queryClient)
    },
  })
}

export function useResetPracticeSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: resetPracticeScheduleViaRuntime,
    onSuccess: () => {
      invalidatePracticeRelatedQueries(queryClient)
    },
  })
}

export function useUpdateCurrentPracticeLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateCurrentPracticeLogViaRuntime,
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
