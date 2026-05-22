import { useMutation, useQuery } from '@tanstack/react-query'

import { sendMessage, type SettingsUpdateRequest } from '@/extension/messaging'
import { queryKeys } from '@/platform/query/query-keys'

export const settingsQueryKeys = queryKeys.settings

export function useSettings() {
  return useQuery({
    queryKey: settingsQueryKeys.all,
    queryFn: () =>
      sendMessage('settings.getSettings', { surface: 'dashboard' }),
  })
}

export function useUpdateSettings() {
  return useMutation({
    mutationFn: (request: SettingsUpdateRequest) =>
      sendMessage('settings.updateSettings', request),
  })
}
