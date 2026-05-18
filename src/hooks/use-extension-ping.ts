import { useQuery } from '@tanstack/react-query'

import { sendMessage, type ExtensionSurface } from '@/extension/messaging'

export function useExtensionPing(surface: ExtensionSurface) {
  return useQuery({
    queryKey: ['extension-ping', surface],
    queryFn: () => sendMessage('runtime.ping', { surface }),
    retry: false,
    staleTime: 30_000,
  })
}
