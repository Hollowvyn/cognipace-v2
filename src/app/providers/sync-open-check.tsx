import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import type { UiSurface } from '@/extension/messaging'
import { checkRemoteOnOpenViaRuntime } from '@/features/sync'
import {
  invalidateTaggedQueries,
  type CacheInvalidationTag,
} from '@/platform/query/cache-invalidation'
import { queryKeys } from '@/platform/query/query-keys'

const broadPullInvalidationTags = [
  'settings',
  'problems',
  'practice',
  'queue',
  'tracks',
  'app-shell',
] as const satisfies readonly CacheInvalidationTag[]

type SyncOpenCheckProps = {
  surface: UiSurface
}

export function SyncOpenCheck({ surface }: SyncOpenCheckProps) {
  const queryClient = useQueryClient()

  useEffect(() => {
    let active = true
    const timeoutId = globalThis.setTimeout(() => {
      void checkRemoteOnOpenViaRuntime(surface)
        .then((result) => {
          if (!active) {
            return
          }

          void queryClient.invalidateQueries({ queryKey: queryKeys.sync.all })

          if (result.direction === 'pull' && result.outcome === 'success') {
            invalidateTaggedQueries(queryClient, broadPullInvalidationTags)
          }
        })
        .catch(() => {
          // Background sync status records failures; opening UI should continue.
        })
    }, 0)

    return () => {
      active = false
      globalThis.clearTimeout(timeoutId)
    }
  }, [queryClient, surface])

  return null
}
