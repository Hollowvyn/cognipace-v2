import { QueryClient } from '@tanstack/react-query'

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'offlineFirst',
        retry: 1,
        staleTime: 30_000,
      },
      mutations: {
        networkMode: 'offlineFirst',
      },
    },
  })
}
