export type LeetCodeNavigationObserver = {
  start: () => void
  stop: () => void
}

export function createLeetCodeNavigationObserver(options: {
  windowRef: Window
  onNavigate: () => void
}): LeetCodeNavigationObserver {
  let originalPushState: History['pushState'] | null = null
  let originalReplaceState: History['replaceState'] | null = null

  function start() {
    patchHistory()
    options.windowRef.addEventListener('popstate', options.onNavigate)
  }

  function stop() {
    options.windowRef.removeEventListener('popstate', options.onNavigate)
    restoreHistory()
  }

  function patchHistory() {
    const historyRef = options.windowRef.history

    if (originalPushState || originalReplaceState) {
      return
    }

    originalPushState = historyRef.pushState.bind(historyRef)
    originalReplaceState = historyRef.replaceState.bind(historyRef)

    historyRef.pushState = ((
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) => {
      originalPushState?.(data, unused, url)
      options.windowRef.setTimeout(options.onNavigate, 0)
    }) as History['pushState']

    historyRef.replaceState = ((
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) => {
      originalReplaceState?.(data, unused, url)
      options.windowRef.setTimeout(options.onNavigate, 0)
    }) as History['replaceState']
  }

  function restoreHistory() {
    if (originalPushState) {
      options.windowRef.history.pushState = originalPushState
      originalPushState = null
    }

    if (originalReplaceState) {
      options.windowRef.history.replaceState = originalReplaceState
      originalReplaceState = null
    }
  }

  return {
    start,
    stop,
  }
}
