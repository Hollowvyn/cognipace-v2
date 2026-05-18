import { useQuery } from '@tanstack/react-query'

import { sendMessage, type AppShellRequest } from '@/extension/messaging'

export function useAppShellData(surface: AppShellRequest['surface']) {
  return useQuery({
    queryKey: ['app-shell-data', surface],
    queryFn: () => sendMessage('app.getShellData', { surface }),
  })
}
