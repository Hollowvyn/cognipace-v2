import { QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

import type { UiSurface } from '@/extension/messaging'

import { ErrorBoundary } from './error-boundary'
import { CacheInvalidationListener } from './cache-invalidation-listener'
import { createAppQueryClient } from './query-client'
import { SyncOpenCheck } from './sync-open-check'

type AppProvidersProps = {
  children: ReactNode
  surface: UiSurface
}

export function AppProviders({ children, surface }: AppProvidersProps) {
  const [queryClient] = useState(createAppQueryClient)

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <CacheInvalidationListener />
        <SyncOpenCheck surface={surface} />
        {children}
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
