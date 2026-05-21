import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { evaluateLeetCodeAssessment } from '@/features/assessment'
import {
  getOverlayAppShellDataViaRuntime,
  type OverlayAppShellData,
} from '@/features/app-shell'
import { createLeetCodeCaptureRemoteClient } from '@/features/leetcode-capture'
import {
  invalidatePracticeRelatedQueries,
  saveReviewResultViaRuntime,
} from '@/features/practice'
import { upsertProblemFromPageViaRuntime } from '@/features/problems'
import type { ReviewRating } from '@/lib/fsrs'
import {
  createEmptyLeetCodeCaptureState,
  createLeetCodeProblemMetadataFingerprint,
  createLeetCodePageWatcher,
  parseLeetCodeProblemLocation,
  reduceLeetCodeCaptureState,
  type LeetCodePageEvent,
  type LeetCodeProblemLocation,
  type LeetCodeProblemMetadata,
} from '@/lib/leetcode'

export type OverlaySyncStatus =
  | 'booting'
  | 'reading-page'
  | 'syncing-problem'
  | 'ready'
  | 'saving-review'
  | 'saved-review'
  | 'error'

type LeetCodeOverlayContext = OverlayAppShellData['overlay']

export type LeetCodeOverlaySession = {
  location: LeetCodeProblemLocation | null
  metadata: LeetCodeProblemMetadata | null
  context: LeetCodeOverlayContext | null
  status: OverlaySyncStatus
  feedback: string | null
  elapsedSeconds: number
  saveReview: (rating: ReviewRating) => Promise<void>
}

export function useLeetCodeOverlaySession(): LeetCodeOverlaySession {
  const queryClient = useQueryClient()
  const initialLocation = parseLeetCodeProblemLocation(window.location.href)
  const [captureState, setCaptureState] = useState(() =>
    createEmptyLeetCodeCaptureState(initialLocation),
  )
  const [context, setContext] = useState<LeetCodeOverlayContext | null>(null)
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
  const latestContextRef = useRef<LeetCodeOverlayContext | null>(null)
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
        const nextShellData = await getOverlayAppShellDataViaRuntime(
          nextMetadata.location.slug,
        )

        if (syncTokenRef.current !== syncToken) {
          return
        }

        setContext(nextShellData.overlay)
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
        case 'metadata-updated':
          syncProblemIfNeeded(event.metadata, syncTokenRef.current)
          return
        case 'problem-content-updated':
        case 'submit-clicked':
        case 'submission-started':
        case 'submission-polling-updated':
        case 'submission-result-updated':
          return
        case 'watcher-error':
          if (latestContextRef.current) {
            return
          }

          setStatus('error')
          setFeedback(event.error.message)
          return
      }
    }
  }, [syncProblemIfNeeded])

  async function saveReview(rating: ReviewRating) {
    const saveToken = syncTokenRef.current
    const currentContext = latestContextRef.current
    const problem = currentContext?.problem

    if (!currentContext || !problem) {
      setStatus('error')
      setFeedback('CogniPace is still syncing this problem.')
      return
    }

    const elapsedSeconds = latestElapsedSecondsRef.current
    const decision = evaluateLeetCodeAssessment(
      rating === 'again'
        ? {
            intent: 'fail',
            difficulty: problem.difficulty,
            timing: currentContext.timing,
            elapsedSeconds,
          }
        : {
            intent: 'selected-rating',
            difficulty: problem.difficulty,
            timing: currentContext.timing,
            selectedRating: rating,
            elapsedSeconds,
          },
    )

    if (decision.status === 'blocked') {
      setStatus('error')
      setFeedback('Solve time is required before saving this review.')
      return
    }

    setStatus('saving-review')
    setFeedback(null)

    try {
      await saveReviewResultViaRuntime({
        surface: 'content-script',
        problemId: problem.id,
        rating: decision.rating,
        reviewMode: 'leetcode',
        elapsedSeconds: decision.elapsedSeconds,
        isCorrect: decision.isCorrect,
      })

      if (syncTokenRef.current !== saveToken) {
        return
      }

      invalidatePracticeRelatedQueries(queryClient)

      const nextShellData = await getOverlayAppShellDataViaRuntime(problem.slug)

      if (syncTokenRef.current !== saveToken) {
        return
      }

      setContext(nextShellData.overlay)
      setStatus('saved-review')
      setFeedback(formatAssessmentFeedback(decision.lockReason))
    } catch (error) {
      if (syncTokenRef.current !== saveToken) {
        return
      }

      setStatus('error')
      setFeedback(error instanceof Error ? error.message : String(error))
    }
  }

  return {
    location: captureState.location,
    metadata: captureState.metadata,
    context,
    status,
    feedback,
    elapsedSeconds,
    saveReview,
  }
}

function formatAssessmentFeedback(
  lockReason: Extract<
    ReturnType<typeof evaluateLeetCodeAssessment>,
    { status: 'accepted' }
  >['lockReason'],
) {
  if (lockReason === 'hard-mode-overtime') {
    return 'Over the solve-time target. Saved as Again.'
  }

  return 'Review saved. FSRS schedule updated.'
}
