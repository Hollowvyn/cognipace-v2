import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { sendMessage } from '@/extension/messaging'
import { invalidateTaggedQueries } from '@/platform/query/cache-invalidation'
import { queryKeys } from '@/platform/query/query-keys'

import type {
  SettingsToggleStudyModeRequest,
  SettingsUpdateRequest,
} from './settings-contracts'

export const settingsQueryKeys = queryKeys.settings

export function useSettings() {
  return useQuery({
    queryKey: settingsQueryKeys.all,
    queryFn: () =>
      sendMessage('settings.getSettings', { surface: 'dashboard' }),
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: SettingsUpdateRequest) =>
      sendMessage('settings.updateSettings', request),
    onSuccess: () => {
      invalidateTaggedQueries(queryClient, ['settings'])
    },
  })
}

export function useToggleStudyMode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: SettingsToggleStudyModeRequest) =>
      sendMessage('settings.toggleStudyMode', request),
    onSuccess: () => {
      invalidateTaggedQueries(queryClient, ['settings'])
    },
  })
}
