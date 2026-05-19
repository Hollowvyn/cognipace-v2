import type {
  LeetCodePageEvent,
  LeetCodeProblemLocation,
  LeetCodeSubmissionClick,
  LeetCodeSubmissionPollingDebug,
  LeetCodeSubmissionPollingPhase,
  LeetCodeSubmissionResult,
  LeetCodeSubmittedCodeSnapshot,
} from '../domain/types'
import { readLeetCodeSubmissionResultFromApi } from '../submission/submission-result-api-source'
import {
  createLeetCodeSubmissionResultFingerprint,
  readLeetCodeSubmissionResult,
} from '../submission/submission-result-reader'

export type LeetCodeSubmissionResultWatch = {
  start: (
    click: LeetCodeSubmissionClick,
    submittedCodeSnapshot: LeetCodeSubmittedCodeSnapshot,
    token: number,
  ) => void
  clear: () => void
  readAfterMutation: (location: LeetCodeProblemLocation) => void
  isWatchingLocation: (location: LeetCodeProblemLocation) => boolean
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

export function createLeetCodeSubmissionResultWatch(options: {
  windowRef: Window
  documentRef: Document
  onEvent: (event: LeetCodePageEvent) => void
  isStaleRead: (token: number, location: LeetCodeProblemLocation) => boolean
  fetch?: typeof fetch | undefined
  now: () => number
  submissionResultReadDelays: readonly number[]
  submissionResultWatchDurationMs: number
  domSubmissionResultFallbackDelayMs: number
}): LeetCodeSubmissionResultWatch {
  let activeSubmissionResultWatch: ActiveSubmissionResultWatch | null = null
  let submissionResultReadTimers: number[] = []
  let latestSubmissionResultFingerprint: string | null = null

  function start(
    click: LeetCodeSubmissionClick,
    submittedCodeSnapshot: LeetCodeSubmittedCodeSnapshot,
    token: number,
  ) {
    clear()
    latestSubmissionResultFingerprint = null
    activeSubmissionResultWatch = {
      click,
      submittedCodeSnapshot,
      location: click.location,
      token,
      expiresAt: options.now() + options.submissionResultWatchDurationMs,
      submissionId: null,
      checkState: null,
      statusText: null,
    }

    submissionResultReadTimers = options.submissionResultReadDelays.map(
      (delayMs) => {
        const timer = options.windowRef.setTimeout(() => {
          submissionResultReadTimers = submissionResultReadTimers.filter(
            (scheduledTimer) => scheduledTimer !== timer,
          )
          void readAndEmitSubmissionResult(token, click.location)
        }, delayMs)

        return timer
      },
    )
  }

  function clear() {
    for (const timer of submissionResultReadTimers) {
      options.windowRef.clearTimeout(timer)
    }

    submissionResultReadTimers = []
    activeSubmissionResultWatch = null
  }

  function readAfterMutation(location: LeetCodeProblemLocation) {
    if (
      !activeSubmissionResultWatch ||
      activeSubmissionResultWatch.location.slug !== location.slug
    ) {
      return
    }

    if (options.now() > activeSubmissionResultWatch.expiresAt) {
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

  function isWatchingLocation(location: LeetCodeProblemLocation) {
    return activeSubmissionResultWatch?.location.slug === location.slug
  }

  async function readAndEmitSubmissionResult(
    token: number,
    location: LeetCodeProblemLocation,
  ) {
    if (options.isStaleRead(token, location)) {
      return
    }

    const submissionResultWatch = activeSubmissionResultWatch
    const apiResult = submissionResultWatch
      ? await readLeetCodeSubmissionResultFromApi({
          location,
          click: submissionResultWatch.click,
          submittedCodeSnapshot: submissionResultWatch.submittedCodeSnapshot,
          fetch: options.fetch,
          document: options.documentRef,
          now: options.now,
          onDebug: (debug) => {
            updateActiveSubmissionResultWatchDebug(submissionResultWatch, debug)
            emitSubmissionPollingDebug(location, debug)
          },
        })
      : null

    if (options.isStaleRead(token, location)) {
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
        checkedAt: options.now(),
      })
    }

    const result = readLeetCodeSubmissionResult(options.documentRef, {
      location,
      now: options.now,
    })

    if (!result) {
      if (
        submissionResultWatch &&
        options.now() >= submissionResultWatch.expiresAt
      ) {
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
      options.now() - submissionResultWatch.click.clickedAt >=
      options.domSubmissionResultFallbackDelayMs
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
      checkedAt: options.now(),
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

  function completeSubmissionResultWatch(
    submissionResultWatch: ActiveSubmissionResultWatch | null,
  ) {
    if (
      submissionResultWatch &&
      activeSubmissionResultWatch !== submissionResultWatch
    ) {
      return
    }

    clear()
  }

  return {
    start,
    clear,
    readAfterMutation,
    isWatchingLocation,
  }
}
