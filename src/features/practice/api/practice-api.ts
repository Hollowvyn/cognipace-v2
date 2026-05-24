import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { sendMessage } from '@/extension/messaging'
import { invalidateTaggedQueries } from '@/platform/query/cache-invalidation'
import { queryKeys } from '@/platform/query/query-keys'

import type {
  PracticeDetailsRequest,
  PracticeOverrideLastReviewResultRequest,
  PracticeResetScheduleRequest,
  PracticeSaveReviewResultRequest,
  PracticeSetSuspendedRequest,
  PracticeUpdateCurrentLogRequest,
} from './practice-contracts'

export const practiceQueryKeys = queryKeys.practice

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
    queryKey: practiceQueryKeys.details(request.problemSlug, request.at),
    queryFn: () => getPracticeDetailsViaRuntime(request),
  })
}

export function useSaveReviewResult() {
  return useMutation({
    mutationFn: saveReviewResultViaRuntime,
  })
}

export function useOverrideLastReviewResult() {
  return useMutation({
    mutationFn: overrideLastReviewResultViaRuntime,
  })
}

export function useSetPracticeSuspended() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: setPracticeSuspendedViaRuntime,
    onSuccess: () => {
      invalidateTaggedQueries(queryClient, ['practice', 'problems', 'tracks'])
    },
  })
}

export function useResetPracticeSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: resetPracticeScheduleViaRuntime,
    onSuccess: () => {
      invalidateTaggedQueries(queryClient, ['practice', 'problems', 'tracks'])
    },
  })
}

export function useUpdateCurrentPracticeLog() {
  return useMutation({
    mutationFn: updateCurrentPracticeLogViaRuntime,
  })
}
