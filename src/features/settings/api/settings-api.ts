import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { sendMessage, type SettingsUpdateRequest } from '@/extension/messaging'

const settingsRelatedQueryKeys = [
  ['settings'],
  ['today-queue'],
  ['practice-details'],
  ['app-shell-data'],
] as const

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
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
      for (const queryKey of settingsRelatedQueryKeys) {
        void queryClient.invalidateQueries({ queryKey })
      }
    },
  })
}
