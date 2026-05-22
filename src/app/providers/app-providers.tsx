import { QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

import { ErrorBoundary } from './error-boundary'
import { CacheInvalidationListener } from './cache-invalidation-listener'
import { createAppQueryClient } from './query-client'

type AppProvidersProps = {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(createAppQueryClient)

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <CacheInvalidationListener />
        {children}
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
