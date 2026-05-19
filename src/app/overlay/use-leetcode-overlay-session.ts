import { useCallback, useEffect, useRef, useState } from 'react'

import { saveReviewResultViaRuntime } from '@/features/practice'
import {
  getProblemContextViaRuntime,
  upsertProblemFromPageViaRuntime,
  type RuntimeProblemContext,
} from '@/features/problems'
import type { ReviewRating } from '@/lib/fsrs'
import {
  createLeetCodeProblemMetadataFingerprint,
  createLeetCodePageWatcher,
  parseLeetCodeProblemLocation,
  type LeetCodeCodeSnapshot,
  type LeetCodePageEvent,
  type LeetCodeProblemLocation,
  type LeetCodeProblemMetadata,
  type LeetCodeSubmissionClick,
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
  context: RuntimeProblemContext
  codeSnapshot: LeetCodeCodeSnapshot | null
  lastSubmissionClick: LeetCodeSubmissionClick | null
  status: OverlaySyncStatus
  feedback: string | null
  elapsedSeconds: number
  saveReview: (rating: ReviewRating) => Promise<void>
}

export function useLeetCodeOverlaySession(): LeetCodeOverlaySession {
  const initialLocation = parseLeetCodeProblemLocation(window.location.href)
  const [location, setLocation] = useState<LeetCodeProblemLocation | null>(
    initialLocation,
  )
  const [metadata, setMetadata] = useState<LeetCodeProblemMetadata | null>(null)
  const [context, setContext] = useState<RuntimeProblemContext>(null)
  const [codeSnapshot, setCodeSnapshot] = useState<LeetCodeCodeSnapshot | null>(
    null,
  )
  const [lastSubmissionClick, setLastSubmissionClick] =
    useState<LeetCodeSubmissionClick | null>(null)
  const [pageReadyAt, setPageReadyAt] = useState<number | null>(null)
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
  }, [pageReadyAt])

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
      onEvent: handlePageEvent,
    })

    watcher.start()

    return () => watcher.stop()

    function handlePageEvent(event: LeetCodePageEvent) {
      switch (event.type) {
        case 'page-changed':
          syncTokenRef.current += 1
          setLocation(event.location)
          setMetadata(null)
          setContext(null)
          setCodeSnapshot(null)
          setLastSubmissionClick(null)
          setPageReadyAt(null)
          setElapsedSeconds(0)
          requestedMetadataFingerprintRef.current = null
          syncedMetadataFingerprintRef.current = null
          setStatus('reading-page')
          setFeedback(null)
          return
        case 'page-ready':
          setPageReadyAt(event.pageReadyAt)
          setMetadata(event.metadata)
          syncProblemIfNeeded(event.metadata, syncTokenRef.current)
          return
        case 'metadata-updated':
          setMetadata(event.metadata)
          syncProblemIfNeeded(event.metadata, syncTokenRef.current)
          return
        case 'code-updated':
          setCodeSnapshot(event.snapshot)
          return
        case 'submit-clicked':
          setLastSubmissionClick(event.click)
          setFeedback(
            'LeetCode submit detected. CogniPace is still waiting for your rating.',
          )
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
    location,
    metadata,
    context,
    codeSnapshot,
    lastSubmissionClick,
    status,
    feedback,
    elapsedSeconds,
    saveReview,
  }
}
