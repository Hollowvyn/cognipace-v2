import type { LeetCodeProblemLocation } from '../domain/types'

export type LeetCodeHydrationScheduler = {
  scheduleRefreshes: (token: number, location: LeetCodeProblemLocation) => void
  clearScheduledRefreshes: () => void
}

export function createLeetCodeHydrationScheduler(options: {
  windowRef: Window
  hydrationDelays: readonly number[]
  refreshSnapshot: (
    token: number,
    location: LeetCodeProblemLocation,
  ) => Promise<void>
}): LeetCodeHydrationScheduler {
  const timeoutIds = new Set<number>()

  function scheduleRefreshes(token: number, location: LeetCodeProblemLocation) {
    for (const delay of options.hydrationDelays) {
      const timeoutId = options.windowRef.setTimeout(() => {
        timeoutIds.delete(timeoutId)
        void options.refreshSnapshot(token, location)
      }, delay)

      timeoutIds.add(timeoutId)
    }
  }

  function clearScheduledRefreshes() {
    for (const timeoutId of timeoutIds) {
      options.windowRef.clearTimeout(timeoutId)
    }

    timeoutIds.clear()
  }

  return {
    scheduleRefreshes,
    clearScheduledRefreshes,
  }
}
