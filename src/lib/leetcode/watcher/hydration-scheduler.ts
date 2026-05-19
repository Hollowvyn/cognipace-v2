import type { LeetCodeProblemLocation } from '../domain/types'

export type LeetCodeHydrationScheduler = {
  scheduleHydrationRefreshes: (
    token: number,
    location: LeetCodeProblemLocation,
  ) => void
  clearScheduledRefreshes: () => void
}

export function createLeetCodeHydrationScheduler(options: {
  windowRef: Window
  hydrationDelays: readonly number[]
  refreshProblemSnapshot: (
    token: number,
    location: LeetCodeProblemLocation,
  ) => Promise<void>
}): LeetCodeHydrationScheduler {
  const scheduledRefreshTimerIds = new Set<number>()

  function scheduleHydrationRefreshes(
    token: number,
    location: LeetCodeProblemLocation,
  ) {
    for (const delay of options.hydrationDelays) {
      const timeoutId = options.windowRef.setTimeout(() => {
        scheduledRefreshTimerIds.delete(timeoutId)
        void options.refreshProblemSnapshot(token, location)
      }, delay)

      scheduledRefreshTimerIds.add(timeoutId)
    }
  }

  function clearScheduledRefreshes() {
    for (const timeoutId of scheduledRefreshTimerIds) {
      options.windowRef.clearTimeout(timeoutId)
    }

    scheduledRefreshTimerIds.clear()
  }

  return {
    scheduleHydrationRefreshes,
    clearScheduledRefreshes,
  }
}
