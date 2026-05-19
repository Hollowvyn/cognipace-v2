import { useCallback, useEffect, useRef, useState } from 'react'

import { saveReviewResultViaRuntime } from '@/features/practice'
import { createLeetCodeCaptureRemoteClient } from '@/features/leetcode-capture'
import {
  getProblemContextViaRuntime,
  upsertProblemFromPageViaRuntime,
  type RuntimeProblemContext,
} from '@/features/problems'
import type { ReviewRating } from '@/lib/fsrs'
import {
  createEmptyLeetCodeCaptureState,
  createLeetCodeProblemMetadataFingerprint,
  createLeetCodePageWatcher,
  parseLeetCodeProblemLocation,
  reduceLeetCodeCaptureState,
  type LeetCodeCodeSnapshot,
  type LeetCodePageEvent,
  type LeetCodeProblemContent,
  type LeetCodeProblemLocation,
  type LeetCodeProblemMetadata,
  type LeetCodeSubmissionAttempt,
  type LeetCodeSubmissionClick,
  type LeetCodeSubmissionPollingDebug,
  type LeetCodeSubmissionResult,
} from '@/lib/leetcode'

export type OverlaySyncStatus =
  | 'booting'
  | 'reading-page'
  | 'syncing-problem'
  | 'ready'
  | 'saving-review'
  | 'saved-review'
  | 'error'

export type LeetCodeOverlaySession = {
  location: LeetCodeProblemLocation | null
  metadata: LeetCodeProblemMetadata | null
  problemContent: LeetCodeProblemContent | null
  context: RuntimeProblemContext
  codeSnapshot: LeetCodeCodeSnapshot | null
  lastSubmissionClick: LeetCodeSubmissionClick | null
  lastSubmissionAttempt: LeetCodeSubmissionAttempt | null
  lastSubmissionPollingDebug: LeetCodeSubmissionPollingDebug | null
  lastSubmissionResult: LeetCodeSubmissionResult | null
  status: OverlaySyncStatus
  feedback: string | null
  elapsedSeconds: number
  saveReview: (rating: ReviewRating) => Promise<void>
}

export function useLeetCodeOverlaySession(): LeetCodeOverlaySession {
  const initialLocation = parseLeetCodeProblemLocation(window.location.href)
  const [captureState, setCaptureState] = useState(() =>
    createEmptyLeetCodeCaptureState(initialLocation),
  )
  const [context, setContext] = useState<RuntimeProblemContext>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [status, setStatus] = useState<OverlaySyncStatus>(
    initialLocation ? 'booting' : 'error',
  )
  const [feedback, setFeedback] = useState<string | null>(
    initialLocation ? null : 'CogniPace only runs on LeetCode problem pages.',
  )
  const syncTokenRef = useRef(0)
  const requestedMetadataFingerprintRef = useRef<string | null>(null)
  const syncedMetadataFingerprintRef = useRef<string | null>(null)
  const latestContextRef = useRef<RuntimeProblemContext>(null)
  const latestElapsedSecondsRef = useRef(0)

  useEffect(() => {
    latestContextRef.current = context
  }, [context])

  useEffect(() => {
    latestElapsedSecondsRef.current = elapsedSeconds
  }, [elapsedSeconds])

  useEffect(() => {
    const pageReadyAt = captureState.pageReadyAt

    if (!pageReadyAt) {
      return
    }

    const updateElapsedSeconds = () => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - pageReadyAt) / 1000)),
      )
    }
    const intervalId = window.setInterval(updateElapsedSeconds, 1000)

    updateElapsedSeconds()

    return () => window.clearInterval(intervalId)
  }, [captureState.pageReadyAt])

  const syncProblem = useCallback(
    async (
      nextMetadata: LeetCodeProblemMetadata,
      syncToken: number,
      fingerprint: string,
    ) => {
      setStatus('syncing-problem')

      try {
        await upsertProblemFromPageViaRuntime({
          surface: 'content-script',
          url: nextMetadata.location.url,
          slug: nextMetadata.location.slug,
          title: nextMetadata.title,
          difficulty: nextMetadata.difficulty,
          isPremium: nextMetadata.isPremium,
          externalId: nextMetadata.frontendId,
        })
        const nextContext = await getProblemContextViaRuntime({
          surface: 'content-script',
          slug: nextMetadata.location.slug,
        })

        if (syncTokenRef.current !== syncToken) {
          return
        }

        setContext(nextContext)
        syncedMetadataFingerprintRef.current = fingerprint
        setStatus('ready')
        setFeedback(null)
      } catch (error) {
        if (syncTokenRef.current !== syncToken) {
          return
        }

        if (requestedMetadataFingerprintRef.current === fingerprint) {
          requestedMetadataFingerprintRef.current = null
        }

        setStatus('error')
        setFeedback(error instanceof Error ? error.message : String(error))
      }
    },
    [],
  )

  const syncProblemIfNeeded = useCallback(
    (nextMetadata: LeetCodeProblemMetadata, syncToken: number) => {
      const fingerprint = createLeetCodeProblemMetadataFingerprint(nextMetadata)

      if (
        requestedMetadataFingerprintRef.current === fingerprint ||
        syncedMetadataFingerprintRef.current === fingerprint
      ) {
        return
      }

      requestedMetadataFingerprintRef.current = fingerprint
      void syncProblem(nextMetadata, syncToken, fingerprint)
    },
    [syncProblem],
  )

  useEffect(() => {
    const watcher = createLeetCodePageWatcher({
      remoteClient: createLeetCodeCaptureRemoteClient(),
      onEvent: handlePageEvent,
    })

    watcher.start()

    return () => watcher.stop()

    function handlePageEvent(event: LeetCodePageEvent) {
      setCaptureState((currentCaptureState) =>
        reduceLeetCodeCaptureState(currentCaptureState, event),
      )

      switch (event.type) {
        case 'page-changed':
          syncTokenRef.current += 1
          setContext(null)
          setElapsedSeconds(0)
          requestedMetadataFingerprintRef.current = null
          syncedMetadataFingerprintRef.current = null
          setStatus('reading-page')
          setFeedback(null)
          return
        case 'page-ready':
          syncProblemIfNeeded(event.metadata, syncTokenRef.current)
          return
        case 'metadata-updated':
          syncProblemIfNeeded(event.metadata, syncTokenRef.current)
          return
        case 'problem-content-updated':
          return
        case 'submit-clicked':
          setFeedback(
            'LeetCode submit detected. CogniPace is still waiting for your rating.',
          )
          return
        case 'submission-started':
          setFeedback('Submitted code snapshot captured.')
          return
        case 'submission-polling-updated':
          return
        case 'submission-result-updated':
          setFeedback(`Submission result captured: ${event.result.statusText}.`)
          return
        case 'watcher-error':
          setStatus('error')
          setFeedback(event.error.message)
          return
      }
    }
  }, [syncProblemIfNeeded])

  async function saveReview(rating: ReviewRating) {
    const currentContext = latestContextRef.current
    const problemId = currentContext?.problem.id

    if (!problemId) {
      setStatus('error')
      setFeedback('CogniPace is still syncing this problem.')
      return
    }

    setStatus('saving-review')
    setFeedback(null)

    try {
      await saveReviewResultViaRuntime({
        surface: 'content-script',
        problemId,
        rating,
        reviewMode: 'leetcode',
        elapsedSeconds:
          latestElapsedSecondsRef.current > 0
            ? latestElapsedSecondsRef.current
            : null,
        isCorrect: rating !== 'again',
      })
      const nextContext = await getProblemContextViaRuntime({
        surface: 'content-script',
        slug: currentContext.problem.slug,
      })

      setContext(nextContext)
      setStatus('saved-review')
      setFeedback('Review saved. FSRS schedule updated.')
    } catch (error) {
      setStatus('error')
      setFeedback(error instanceof Error ? error.message : String(error))
    }
  }

  return {
    location: captureState.location,
    metadata: captureState.metadata,
    problemContent: captureState.problemContent,
    context,
    codeSnapshot: captureState.codeSnapshot,
    lastSubmissionClick: captureState.submissionClick,
    lastSubmissionAttempt: captureState.submissionAttempt,
    lastSubmissionPollingDebug: captureState.submissionPollingDebug,
    lastSubmissionResult: captureState.submissionResult,
    status,
    feedback,
    elapsedSeconds,
    saveReview,
  }
}
