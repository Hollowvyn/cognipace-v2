import { useCallback, useEffect, useRef, useState } from 'react'

import {
  getOverlayAppShellDataViaRuntime,
  type OverlayAppShellData,
} from '@/features/app-shell'
import { createLeetCodeCaptureRemoteClient } from '@/features/leetcode-capture'
import { upsertProblemFromPageViaRuntime } from '@/features/problems'
import {
  createEmptyLeetCodeCaptureState,
  createLeetCodeProblemMetadataFingerprint,
  createLeetCodePageWatcher,
  parseLeetCodeProblemLocation,
  reduceLeetCodeCaptureState,
  type LeetCodePageEvent,
} from '@/lib/leetcode'

export type OverlaySyncStatus =
  | 'booting'
  | 'reading-page'
  | 'syncing-problem'
  | 'ready'
  | 'error'

export type LeetCodeOverlayContext = OverlayAppShellData['overlay']

type UseLeetCodePageSyncOptions = {
  activeProblemId: string | null
  onPageChanged: () => void
  onProblemLoaded: (context: LeetCodeOverlayContext) => void
}

export function useLeetCodePageSync({
  activeProblemId,
  onPageChanged,
  onProblemLoaded,
}: UseLeetCodePageSyncOptions) {
  const initialLocation = parseLeetCodeProblemLocation(window.location.href)
  const [captureState, setCaptureState] = useState(() =>
    createEmptyLeetCodeCaptureState(initialLocation),
  )
  const [context, setContext] = useState<LeetCodeOverlayContext | null>(null)
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
  const activeProblemIdRef = useRef(activeProblemId)
  const onPageChangedRef = useRef(onPageChanged)

  useEffect(() => {
    activeProblemIdRef.current = activeProblemId
  }, [activeProblemId])

  useEffect(() => {
    latestContextRef.current = context
  }, [context])

  useEffect(() => {
    onPageChangedRef.current = onPageChanged
  }, [onPageChanged])

  const applySyncedContext = useCallback(
    (nextContext: LeetCodeOverlayContext) => {
      setContext(nextContext)

      const problem = nextContext.problem
      if (!problem || activeProblemIdRef.current === problem.id) {
        return
      }

      onProblemLoaded(nextContext)
    },
    [onProblemLoaded],
  )

  const syncProblem = useCallback(
    async (event: LeetCodePageEvent & { type: 'page-ready' | 'metadata-updated' }) => {
      const nextMetadata = event.metadata
      const fingerprint = createLeetCodeProblemMetadataFingerprint(nextMetadata)

      if (
        requestedMetadataFingerprintRef.current === fingerprint ||
        syncedMetadataFingerprintRef.current === fingerprint
      ) {
        return
      }

      const syncToken = syncTokenRef.current
      requestedMetadataFingerprintRef.current = fingerprint
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

        applySyncedContext(nextShellData.overlay)
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
    [applySyncedContext],
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
          onPageChangedRef.current()
          requestedMetadataFingerprintRef.current = null
          syncedMetadataFingerprintRef.current = null
          setStatus('reading-page')
          setFeedback(null)
          return
        case 'page-ready':
        case 'metadata-updated':
          void syncProblem(event)
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
  }, [syncProblem])

  const refreshContext = useCallback(
    async (problemSlug: string, expectedSyncToken: number) => {
      const nextShellData = await getOverlayAppShellDataViaRuntime(problemSlug)

      if (syncTokenRef.current !== expectedSyncToken) {
        return null
      }

      applySyncedContext(nextShellData.overlay)

      return nextShellData.overlay
    },
    [applySyncedContext],
  )

  return {
    context,
    feedback,
    latestContextRef,
    location: captureState.location,
    metadata: captureState.metadata,
    refreshContext,
    status,
    syncTokenRef,
  }
}
