import { parseLeetCodeProblemLocation } from '../domain/problem-url'
import type {
  LeetCodePageEvent,
  LeetCodeProblemLocation,
} from '../domain/types'
import { readLeetCodeCodeSnapshot } from '../editor/code-snapshot-reader'
import { readLeetCodeProblemMetadata } from '../metadata/metadata-reader'
import { readLeetCodePageSnapshot } from '../page/page-snapshot-reader'
import { createLeetCodeHydrationScheduler } from './hydration-scheduler'
import { createLeetCodeNavigationObserver } from './navigation-observer'
import { readLeetCodeSubmissionClickFromMouseEvent } from './submit-click-observer'

export type LeetCodePageWatcher = {
  start: () => void
  stop: () => void
  refresh: () => void
}

export function createLeetCodePageWatcher(options: {
  onEvent: (event: LeetCodePageEvent) => void
  windowRef?: Window | undefined
  documentRef?: Document | undefined
  fetch?: typeof fetch | undefined
  getCurrentUrl?: (() => string) | undefined
  now?: (() => number) | undefined
  hydrationDelays?: readonly number[] | undefined
}): LeetCodePageWatcher {
  const windowRef = options.windowRef ?? window
  const documentRef = options.documentRef ?? windowRef.document
  const now = options.now ?? Date.now
  const hydrationDelays = options.hydrationDelays ?? [0, 500, 1500, 3000]
  const getCurrentUrl = options.getCurrentUrl ?? (() => windowRef.location.href)
  const hydrationScheduler = createLeetCodeHydrationScheduler({
    windowRef,
    hydrationDelays,
    refreshSnapshot,
  })
  const navigationObserver = createLeetCodeNavigationObserver({
    windowRef,
    onNavigate: handleNavigation,
  })

  let activeLocation: LeetCodeProblemLocation | null = null
  let activeToken = 0
  let readySlug: string | null = null
  let mutationObserver: MutationObserver | null = null
  let mutationRefreshTimer: number | null = null

  function start() {
    navigationObserver.start()
    documentRef.addEventListener('click', handleClick, true)
    observeMutations()
    activateFromCurrentUrl()
  }

  function stop() {
    hydrationScheduler.clearScheduledRefreshes()
    mutationObserver?.disconnect()
    mutationObserver = null
    documentRef.removeEventListener('click', handleClick, true)
    navigationObserver.stop()

    if (mutationRefreshTimer !== null) {
      windowRef.clearTimeout(mutationRefreshTimer)
      mutationRefreshTimer = null
    }
  }

  function refresh() {
    activateFromCurrentUrl()
  }

  function activateFromCurrentUrl() {
    const location = parseLeetCodeProblemLocation(getCurrentUrl())

    if (!location) {
      return
    }

    if (activeLocation?.slug === location.slug) {
      hydrationScheduler.scheduleRefreshes(activeToken, location)
      return
    }

    const previousLocation = activeLocation
    activeLocation = location
    activeToken += 1
    readySlug = null
    hydrationScheduler.clearScheduledRefreshes()

    options.onEvent({
      type: 'page-changed',
      location,
      previousLocation,
      changedAt: now(),
    })
    hydrationScheduler.scheduleRefreshes(activeToken, location)
  }

  async function refreshSnapshot(
    token: number,
    location: LeetCodeProblemLocation,
  ) {
    try {
      const snapshot = readLeetCodePageSnapshot(documentRef, {
        location,
        now,
      })
      const metadataResult = await readLeetCodeProblemMetadata(location, {
        root: documentRef,
        document: documentRef,
        fetch: options.fetch,
        now,
      })

      if (isStale(token, location)) {
        return
      }

      if (!metadataResult.ok) {
        emitError(location, metadataResult.error)
        return
      }

      const metadata = metadataResult.metadata

      if (readySlug !== location.slug) {
        readySlug = location.slug
        options.onEvent({
          type: 'page-ready',
          location,
          snapshot,
          metadata,
          pageReadyAt: now(),
        })
      }

      options.onEvent({
        type: 'metadata-updated',
        location,
        metadata,
      })

      const codeSnapshot = readLeetCodeCodeSnapshot(documentRef, now)

      if (codeSnapshot.source !== 'none') {
        options.onEvent({
          type: 'code-updated',
          location,
          snapshot: codeSnapshot,
        })
      }
    } catch (error) {
      emitError(
        location,
        error instanceof Error ? error : new Error(String(error)),
      )
    }
  }

  function handleNavigation() {
    activateFromCurrentUrl()
  }

  function handleClick(event: MouseEvent) {
    const location = activeLocation

    if (!location) {
      return
    }

    const click = readLeetCodeSubmissionClickFromMouseEvent(event, {
      location,
      now,
    })

    if (!click) {
      return
    }

    options.onEvent({ type: 'submit-clicked', click })
  }

  function observeMutations() {
    if (!documentRef.body) {
      return
    }

    const MutationObserverCtor =
      documentRef.defaultView?.MutationObserver ?? globalThis.MutationObserver

    if (!MutationObserverCtor) {
      return
    }

    const observer = new MutationObserverCtor(() => {
      if (mutationRefreshTimer !== null) {
        windowRef.clearTimeout(mutationRefreshTimer)
      }

      mutationRefreshTimer = windowRef.setTimeout(() => {
        mutationRefreshTimer = null
        activateFromCurrentUrl()
      }, 250)
    })
    mutationObserver = observer
    observer.observe(documentRef.body, {
      childList: true,
      subtree: true,
    })
  }

  function isStale(token: number, location: LeetCodeProblemLocation) {
    return activeToken !== token || activeLocation?.slug !== location.slug
  }

  function emitError(location: LeetCodeProblemLocation | null, error: Error) {
    options.onEvent({
      type: 'watcher-error',
      location,
      error,
      occurredAt: now(),
    })
  }

  return { start, stop, refresh }
}
