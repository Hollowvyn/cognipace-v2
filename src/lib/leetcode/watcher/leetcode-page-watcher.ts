import { parseLeetCodeProblemLocation } from '../domain/problem-url'
import type {
  LeetCodePageEvent,
  LeetCodeProblemContent,
  LeetCodeProblemLocation,
  LeetCodeSubmissionClick,
  LeetCodeSubmissionPollingDebug,
  LeetCodeSubmissionPollingPhase,
  LeetCodeSubmissionResult,
  LeetCodeSubmittedCodeSnapshot,
} from '../domain/types'
import { readLeetCodeProblemContent } from '../content/problem-content-reader'
import { readLeetCodeCodeSnapshot } from '../editor/code-snapshot-reader'
import { readLeetCodeProblemMetadata } from '../metadata/metadata-reader'
import { readLeetCodePageSnapshot } from '../page/page-snapshot-reader'
import { readLeetCodeSubmissionAttempt } from '../submission/submission-attempt-reader'
import { readLeetCodeSubmissionResultFromApi } from '../submission/submission-result-api-source'
import {
  createLeetCodeSubmissionResultFingerprint,
  readLeetCodeSubmissionResult,
} from '../submission/submission-result-reader'
import { createLeetCodeHydrationScheduler } from './hydration-scheduler'
import { createLeetCodeNavigationObserver } from './navigation-observer'
import { readLeetCodeSubmissionClickFromMouseEvent } from './submit-click-observer'

export type LeetCodePageWatcher = {
  start: () => void
  stop: () => void
  refresh: () => void
}

type ActiveSubmissionResultWatch = {
  click: LeetCodeSubmissionClick
  submittedCodeSnapshot: LeetCodeSubmittedCodeSnapshot
  location: LeetCodeProblemLocation
  token: number
  expiresAt: number
  submissionId: string | null
  checkState: string | null
  statusText: string | null
}

export function createLeetCodePageWatcher(options: {
  onEvent: (event: LeetCodePageEvent) => void
  windowRef?: Window | undefined
  documentRef?: Document | undefined
  fetch?: typeof fetch | undefined
  getCurrentUrl?: (() => string) | undefined
  now?: (() => number) | undefined
  hydrationDelays?: readonly number[] | undefined
  submissionResultReadDelays?: readonly number[] | undefined
  submissionResultWatchDurationMs?: number | undefined
  domSubmissionResultFallbackDelayMs?: number | undefined
  mutationRefreshDebounceMs?: number | undefined
  samePageSnapshotRefreshCooldownMs?: number | undefined
}): LeetCodePageWatcher {
  const windowRef = options.windowRef ?? window
  const documentRef = options.documentRef ?? windowRef.document
  const now = options.now ?? Date.now
  const fetchLeetCode =
    options.fetch ??
    windowRef.fetch?.bind(windowRef) ??
    globalThis.fetch?.bind(globalThis)
  const submissionResultWatchDurationMs =
    options.submissionResultWatchDurationMs ?? 45000
  const hydrationDelays = options.hydrationDelays ?? [0, 500, 1500, 3000]
  const submissionResultReadDelays = options.submissionResultReadDelays ?? [
    500,
    1500,
    3000,
    5000,
    7000,
    9000,
    11000,
    13000,
    15000,
    17000,
    19000,
    22000,
    26000,
    30000,
    35000,
    40000,
    submissionResultWatchDurationMs,
  ]
  const domSubmissionResultFallbackDelayMs =
    options.domSubmissionResultFallbackDelayMs ??
    submissionResultWatchDurationMs
  const mutationRefreshDebounceMs = options.mutationRefreshDebounceMs ?? 500
  const samePageSnapshotRefreshCooldownMs =
    options.samePageSnapshotRefreshCooldownMs ?? 4000
  const getCurrentUrl = options.getCurrentUrl ?? (() => windowRef.location.href)
  const hydrationScheduler = createLeetCodeHydrationScheduler({
    windowRef,
    hydrationDelays,
    refreshProblemSnapshot,
  })
  const navigationObserver = createLeetCodeNavigationObserver({
    windowRef,
    onNavigate: handleLeetCodeNavigation,
  })

  let activeLocation: LeetCodeProblemLocation | null = null
  let activeToken = 0
  let readySlug: string | null = null
  let mutationObserver: MutationObserver | null = null
  let mutationRefreshTimer: number | null = null
  let samePageSnapshotRefreshTimer: number | null = null
  let submissionResultReadTimers: number[] = []
  let latestProblemContentFingerprint: string | null = null
  let latestSubmissionResultFingerprint: string | null = null
  let activeSubmissionResultWatch: ActiveSubmissionResultWatch | null = null
  let lastSnapshotRefreshAt = Number.NEGATIVE_INFINITY

  function start() {
    navigationObserver.start()
    documentRef.addEventListener('click', handleClick, true)
    observeMutations()
    activateFromCurrentUrl()
  }

  function stop() {
    hydrationScheduler.clearScheduledRefreshes()
    clearScheduledSubmissionResultReads()
    activeSubmissionResultWatch = null
    mutationObserver?.disconnect()
    mutationObserver = null
    documentRef.removeEventListener('click', handleClick, true)
    navigationObserver.stop()

    if (mutationRefreshTimer !== null) {
      windowRef.clearTimeout(mutationRefreshTimer)
      mutationRefreshTimer = null
    }

    if (samePageSnapshotRefreshTimer !== null) {
      windowRef.clearTimeout(samePageSnapshotRefreshTimer)
      samePageSnapshotRefreshTimer = null
    }
  }

  function refresh() {
    activateFromCurrentUrl({ forceSamePageSnapshotRefresh: true })
  }

  function activateFromCurrentUrl(
    settings: { forceSamePageSnapshotRefresh?: boolean } = {},
  ) {
    const location = parseLeetCodeProblemLocation(getCurrentUrl())

    if (!location) {
      return
    }

    if (activeLocation?.slug === location.slug) {
      if (settings.forceSamePageSnapshotRefresh) {
        scheduleSamePageSnapshotRefresh(location, 0)
      }
      return
    }

    const previousLocation = activeLocation
    activeLocation = location
    activeToken += 1
    readySlug = null
    latestProblemContentFingerprint = null
    latestSubmissionResultFingerprint = null
    activeSubmissionResultWatch = null
    lastSnapshotRefreshAt = Number.NEGATIVE_INFINITY
    hydrationScheduler.clearScheduledRefreshes()
    clearScheduledSubmissionResultReads()

    options.onEvent({
      type: 'page-changed',
      location,
      previousLocation,
      changedAt: now(),
    })
    hydrationScheduler.scheduleHydrationRefreshes(activeToken, location)
  }

  async function refreshProblemSnapshot(
    token: number,
    location: LeetCodeProblemLocation,
  ) {
    try {
      lastSnapshotRefreshAt = now()
      const pageSnapshot = readLeetCodePageSnapshot(documentRef, {
        location,
        now,
      })
      const metadataReadResult = await readLeetCodeProblemMetadata(location, {
        root: documentRef,
        document: documentRef,
        fetch: options.fetch,
        now,
      })

      if (isStaleSnapshotRefresh(token, location)) {
        return
      }

      if (!metadataReadResult.ok) {
        emitWatcherError(location, metadataReadResult.error)
        return
      }

      const problemMetadata = metadataReadResult.metadata

      if (readySlug !== location.slug) {
        readySlug = location.slug
        options.onEvent({
          type: 'page-ready',
          location,
          snapshot: pageSnapshot,
          metadata: problemMetadata,
          pageReadyAt: now(),
        })
      }

      options.onEvent({
        type: 'metadata-updated',
        location,
        metadata: problemMetadata,
      })

      const contentReadResult = await readLeetCodeProblemContent(location, {
        root: documentRef,
        document: documentRef,
        fetch: options.fetch,
        now,
      })

      if (isStaleSnapshotRefresh(token, location)) {
        return
      }

      if (contentReadResult.ok) {
        emitProblemContentIfUseful(location, contentReadResult.content)
      } else {
        emitWatcherError(location, contentReadResult.error)
      }

      const codeSnapshot = readLeetCodeCodeSnapshot(documentRef, now)

      if (codeSnapshot.source !== 'none') {
        options.onEvent({
          type: 'code-updated',
          location,
          snapshot: codeSnapshot,
        })
      }
    } catch (error) {
      emitWatcherError(
        location,
        error instanceof Error ? error : new Error(String(error)),
      )
    }
  }

  function handleLeetCodeNavigation() {
    activateFromCurrentUrl()
  }

  function handleLeetCodePageMutation() {
    const location = parseLeetCodeProblemLocation(getCurrentUrl())

    if (!location) {
      return
    }

    if (activeLocation?.slug !== location.slug) {
      activateFromCurrentUrl()
      return
    }

    if (isWatchingSubmissionResultForLocation(location)) {
      readActiveSubmissionResultAfterMutation(location)
      return
    }

    scheduleThrottledSamePageSnapshotRefresh(location)
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
    const attempt = readLeetCodeSubmissionAttempt({
      click,
      editorRoot: documentRef,
    })

    options.onEvent({
      type: 'submission-started',
      attempt,
    })
    scheduleSubmissionResultReads(
      click,
      attempt.submittedCodeSnapshot,
      activeToken,
    )
  }

  function scheduleSubmissionResultReads(
    click: LeetCodeSubmissionClick,
    submittedCodeSnapshot: LeetCodeSubmittedCodeSnapshot,
    token: number,
  ) {
    clearScheduledSubmissionResultReads()
    latestSubmissionResultFingerprint = null
    activeSubmissionResultWatch = {
      click,
      submittedCodeSnapshot,
      location: click.location,
      token,
      expiresAt: now() + submissionResultWatchDurationMs,
      submissionId: null,
      checkState: null,
      statusText: null,
    }

    submissionResultReadTimers = submissionResultReadDelays.map((delayMs) => {
      const timer = windowRef.setTimeout(() => {
        submissionResultReadTimers = submissionResultReadTimers.filter(
          (scheduledTimer) => scheduledTimer !== timer,
        )
        void readAndEmitSubmissionResult(token, click.location)
      }, delayMs)

      return timer
    })
  }

  function clearScheduledSubmissionResultReads() {
    for (const timer of submissionResultReadTimers) {
      windowRef.clearTimeout(timer)
    }

    submissionResultReadTimers = []
  }

  function readActiveSubmissionResultAfterMutation(
    location: LeetCodeProblemLocation,
  ) {
    if (
      !activeSubmissionResultWatch ||
      activeSubmissionResultWatch.location.slug !== location.slug
    ) {
      return
    }

    if (now() > activeSubmissionResultWatch.expiresAt) {
      emitSubmissionPollingDebugForWatch(
        activeSubmissionResultWatch,
        'timed-out',
      )
      completeSubmissionResultWatch(activeSubmissionResultWatch)
      return
    }

    void readAndEmitSubmissionResult(
      activeSubmissionResultWatch.token,
      activeSubmissionResultWatch.location,
    )
  }

  function isWatchingSubmissionResultForLocation(
    location: LeetCodeProblemLocation,
  ) {
    return activeSubmissionResultWatch?.location.slug === location.slug
  }

  async function readAndEmitSubmissionResult(
    token: number,
    location: LeetCodeProblemLocation,
  ) {
    if (isStaleSnapshotRefresh(token, location)) {
      return
    }

    const submissionResultWatch = activeSubmissionResultWatch
    const apiResult = submissionResultWatch
      ? await readLeetCodeSubmissionResultFromApi({
          location,
          click: submissionResultWatch.click,
          submittedCodeSnapshot: submissionResultWatch.submittedCodeSnapshot,
          fetch: fetchLeetCode,
          document: documentRef,
          now,
          onDebug: (debug) => {
            updateActiveSubmissionResultWatchDebug(submissionResultWatch, debug)
            emitSubmissionPollingDebug(location, debug)
          },
        })
      : null

    if (isStaleSnapshotRefresh(token, location)) {
      return
    }

    if (
      submissionResultWatch &&
      activeSubmissionResultWatch !== submissionResultWatch
    ) {
      return
    }

    if (apiResult) {
      emitSubmissionResult(apiResult)
      completeSubmissionResultWatch(submissionResultWatch)
      return
    }

    if (!canReadDomSubmissionResultFallback(submissionResultWatch)) {
      return
    }

    if (submissionResultWatch) {
      emitSubmissionPollingDebugForWatch(
        submissionResultWatch,
        'dom-fallback-used',
      )
    } else {
      emitSubmissionPollingDebug(location, {
        phase: 'dom-fallback-used',
        submissionId: null,
        checkState: null,
        statusText: null,
        checkedAt: now(),
      })
    }

    const result = readLeetCodeSubmissionResult(documentRef, {
      location,
      now,
    })

    if (!result) {
      if (submissionResultWatch && now() >= submissionResultWatch.expiresAt) {
        emitSubmissionPollingDebugForWatch(submissionResultWatch, 'timed-out')
        completeSubmissionResultWatch(submissionResultWatch)
      }
      return
    }

    emitSubmissionResult(result)

    if (submissionResultWatch) {
      completeSubmissionResultWatch(submissionResultWatch)
    }
  }

  function canReadDomSubmissionResultFallback(
    submissionResultWatch: ActiveSubmissionResultWatch | null,
  ) {
    if (!submissionResultWatch) {
      return true
    }

    return (
      now() - submissionResultWatch.click.clickedAt >=
      domSubmissionResultFallbackDelayMs
    )
  }

  function updateActiveSubmissionResultWatchDebug(
    submissionResultWatch: ActiveSubmissionResultWatch,
    debug: LeetCodeSubmissionPollingDebug,
  ) {
    submissionResultWatch.submissionId =
      debug.submissionId ?? submissionResultWatch.submissionId
    submissionResultWatch.checkState =
      debug.checkState ?? submissionResultWatch.checkState
    submissionResultWatch.statusText =
      debug.statusText ?? submissionResultWatch.statusText
  }

  function emitSubmissionPollingDebugForWatch(
    submissionResultWatch: ActiveSubmissionResultWatch,
    phase: LeetCodeSubmissionPollingPhase,
  ) {
    emitSubmissionPollingDebug(submissionResultWatch.location, {
      phase,
      submissionId: submissionResultWatch.submissionId,
      checkState: submissionResultWatch.checkState,
      statusText: submissionResultWatch.statusText,
      checkedAt: now(),
    })
  }

  function emitSubmissionPollingDebug(
    location: LeetCodeProblemLocation,
    debug: LeetCodeSubmissionPollingDebug,
  ) {
    options.onEvent({
      type: 'submission-polling-updated',
      location,
      debug,
    })
  }

  function emitSubmissionResult(result: LeetCodeSubmissionResult) {
    const resultFingerprint = createLeetCodeSubmissionResultFingerprint(result)

    if (latestSubmissionResultFingerprint === resultFingerprint) {
      return
    }

    latestSubmissionResultFingerprint = resultFingerprint
    options.onEvent({
      type: 'submission-result-updated',
      result,
    })
  }

  function emitProblemContentIfUseful(
    location: LeetCodeProblemLocation,
    content: LeetCodeProblemContent,
  ) {
    if (!isUsefulProblemContent(content)) {
      return
    }

    if (latestProblemContentFingerprint === content.contentFingerprint) {
      return
    }

    latestProblemContentFingerprint = content.contentFingerprint
    options.onEvent({
      type: 'problem-content-updated',
      location,
      content,
    })
  }

  function isUsefulProblemContent(content: LeetCodeProblemContent) {
    return (
      content.statement.length > 0 ||
      content.examples.length > 0 ||
      content.constraints.length > 0 ||
      content.hints.length > 0
    )
  }

  function completeSubmissionResultWatch(
    submissionResultWatch: ActiveSubmissionResultWatch | null,
  ) {
    if (
      submissionResultWatch &&
      activeSubmissionResultWatch !== submissionResultWatch
    ) {
      return
    }

    activeSubmissionResultWatch = null
    clearScheduledSubmissionResultReads()
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
        handleLeetCodePageMutation()
      }, mutationRefreshDebounceMs)
    })
    mutationObserver = observer
    observer.observe(documentRef.body, {
      childList: true,
      subtree: true,
    })
  }

  function scheduleThrottledSamePageSnapshotRefresh(
    location: LeetCodeProblemLocation,
  ) {
    const millisecondsSinceLastSnapshotRefresh = now() - lastSnapshotRefreshAt
    const refreshDelay = Math.max(
      0,
      samePageSnapshotRefreshCooldownMs - millisecondsSinceLastSnapshotRefresh,
    )

    scheduleSamePageSnapshotRefresh(location, refreshDelay)
  }

  function scheduleSamePageSnapshotRefresh(
    location: LeetCodeProblemLocation,
    delayMs: number,
  ) {
    if (samePageSnapshotRefreshTimer !== null) {
      windowRef.clearTimeout(samePageSnapshotRefreshTimer)
    }

    samePageSnapshotRefreshTimer = windowRef.setTimeout(() => {
      samePageSnapshotRefreshTimer = null
      void refreshProblemSnapshot(activeToken, location)
    }, delayMs)
  }

  function isStaleSnapshotRefresh(
    token: number,
    location: LeetCodeProblemLocation,
  ) {
    return activeToken !== token || activeLocation?.slug !== location.slug
  }

  function emitWatcherError(
    location: LeetCodeProblemLocation | null,
    error: Error,
  ) {
    options.onEvent({
      type: 'watcher-error',
      location,
      error,
      occurredAt: now(),
    })
  }

  return { start, stop, refresh }
}
