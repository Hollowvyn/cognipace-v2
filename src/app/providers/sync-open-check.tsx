import { useEffect } from 'react'

import type { UiSurface } from '@/extension/messaging'
import { requestOpenCheckViaRuntime } from '@/features/sync'

type SyncOpenCheckProps = {
  surface: UiSurface
}

export function SyncOpenCheck({ surface }: SyncOpenCheckProps) {
  useEffect(() => {
    let active = true
    const timeoutId = globalThis.setTimeout(() => {
      void requestOpenCheckViaRuntime(surface).catch(() => {
        if (!active) {
          return
        }
        // Background sync status records failures; opening UI should continue.
      })
    }, 0)

    return () => {
      active = false
      globalThis.clearTimeout(timeoutId)
    }
  }, [surface])

  return null
}
