import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { sendMessage } from '@/extension/messaging'
import { queryKeys } from '@/platform/query/query-keys'

import type { AiProviderSecretPresence } from '../domain/genai-secrets-types'
import type { GenAiProviderActionResult } from '../domain/genai-connection-types'
import type { GenAiProviderId } from '../domain/genai-types'

type GenAiHookSurface = 'popup' | 'dashboard'

export function useGenAiProviderStatusQuery() {
  return useQuery({
    queryKey: queryKeys.genai.status(),
    queryFn: () =>
      sendMessage('genai.getProviderStatus', { surface: 'dashboard' }),
  })
}

function useGenAiProviderActionMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<GenAiProviderActionResult>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.genai.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.appShell.all })
    },
  })
}

export type SaveGenAiProviderModelMutationInput = {
  provider: GenAiProviderId
  model: string
}

export function useSaveGenAiProviderModelMutation() {
  return useGenAiProviderActionMutation(
    (input: SaveGenAiProviderModelMutationInput) =>
      sendMessage('genai.saveProviderModel', {
        surface: 'dashboard',
        provider: input.provider,
        model: input.model,
      }),
  )
}

export type SaveGenAiProviderSecretMutationInput = {
  provider: GenAiProviderId
  secret: {
    apiKey: string
  }
}

export function useSaveGenAiProviderSecretMutation() {
  return useGenAiProviderActionMutation(
    (input: SaveGenAiProviderSecretMutationInput) =>
      sendMessage('genai.saveProviderSecret', {
        surface: 'dashboard',
        provider: input.provider,
        secret: input.secret,
      }),
  )
}

export type TestGenAiProviderDraftMutationInput = {
  provider: GenAiProviderId
  model: string
  secret: {
    apiKey: string
  }
}

export function useTestGenAiProviderDraftMutation() {
  return useGenAiProviderActionMutation(
    (input: TestGenAiProviderDraftMutationInput) =>
      sendMessage('genai.testProviderDraft', {
        surface: 'dashboard',
        provider: input.provider,
        model: input.model,
        secret: input.secret,
      }),
  )
}

export type GenAiProviderMutationInput = {
  provider: GenAiProviderId
}

export function useVerifyGenAiProviderMutation() {
  return useGenAiProviderActionMutation((input: GenAiProviderMutationInput) =>
    sendMessage('genai.verifyProvider', {
      surface: 'dashboard',
      provider: input.provider,
    }),
  )
}

export function useSelectGenAiProviderMutation() {
  return useGenAiProviderActionMutation((input: GenAiProviderMutationInput) =>
    sendMessage('genai.selectProvider', {
      surface: 'dashboard',
      provider: input.provider,
    }),
  )
}

export function useClearGenAiProviderSecretMutation() {
  return useGenAiProviderActionMutation((input: GenAiProviderMutationInput) =>
    sendMessage('genai.clearProviderSecret', {
      surface: 'dashboard',
      provider: input.provider,
    }),
  )
}

export function useGenAiSecretPresenceQuery(
  surface: GenAiHookSurface = 'dashboard',
) {
  return useQuery({
    queryKey: queryKeys.genai.secretPresence(),
    queryFn: (): Promise<AiProviderSecretPresence> =>
      sendMessage('genai.getAiProviderSecretPresence', { surface }),
  })
}

export type SetAiProviderSecretHookInput = {
  provider: GenAiProviderId
  key: string
}

export function useSetAiProviderSecretMutation(
  surface: GenAiHookSurface = 'dashboard',
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SetAiProviderSecretHookInput) =>
      sendMessage('genai.setAiProviderSecret', {
        surface,
        provider: input.provider,
        secret: {
          apiKey: input.key,
        },
      }),
    onSuccess: (presence) => {
      queryClient.setQueryData(queryKeys.genai.secretPresence(), presence)
    },
  })
}

export type ClearAiProviderSecretHookInput = {
  provider: GenAiProviderId
}

export function useClearAiProviderSecretMutation(
  surface: GenAiHookSurface = 'dashboard',
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ClearAiProviderSecretHookInput) =>
      sendMessage('genai.clearAiProviderSecret', {
        surface,
        provider: input.provider,
      }),
    onSuccess: (presence) => {
      queryClient.setQueryData(queryKeys.genai.secretPresence(), presence)
    },
  })
}
