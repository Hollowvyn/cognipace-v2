import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { sendMessage } from '@/extension/messaging'
import { queryKeys } from '@/platform/query/query-keys'

import type { AiProviderSecretPresence } from '../domain/genai-secrets-types'
import type { GenAiProviderId } from '../domain/genai-types'

type GenAiHookSurface = 'popup' | 'dashboard'

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
  baseUrl?: string
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
          ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
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
