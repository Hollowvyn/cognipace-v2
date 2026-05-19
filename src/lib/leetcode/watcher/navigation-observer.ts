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
    patchBrowserHistoryForLeetCodeSpaNavigation()
    options.windowRef.addEventListener('popstate', options.onNavigate)
  }

  function stop() {
    options.windowRef.removeEventListener('popstate', options.onNavigate)
    restoreBrowserHistory()
  }

  function patchBrowserHistoryForLeetCodeSpaNavigation() {
    const historyRef = options.windowRef.history

    if (originalPushState || originalReplaceState) {
      return
    }

    originalPushState = historyRef.pushState.bind(historyRef)
    originalReplaceState = historyRef.replaceState.bind(historyRef)

    historyRef.pushState = ((
      stateData: unknown,
      unused: string,
      url?: string | URL | null,
    ) => {
      originalPushState?.(stateData, unused, url)
      options.windowRef.setTimeout(options.onNavigate, 0)
    }) as History['pushState']

    historyRef.replaceState = ((
      stateData: unknown,
      unused: string,
      url?: string | URL | null,
    ) => {
      originalReplaceState?.(stateData, unused, url)
      options.windowRef.setTimeout(options.onNavigate, 0)
    }) as History['replaceState']
  }

  function restoreBrowserHistory() {
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
