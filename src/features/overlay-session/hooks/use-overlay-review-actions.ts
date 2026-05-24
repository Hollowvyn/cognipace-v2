import {
  evaluateLeetCodeAssessment,
  type LeetCodeAssessmentDecision,
} from '@/features/assessment'
import {
  overrideLastReviewResultViaRuntime,
  saveReviewResultViaRuntime,
  type SerializedPracticeDetails,
  updateCurrentPracticeLogViaRuntime,
} from '@/features/practice'
import type { ReviewRating } from '@/lib/fsrs'
import type { LeetCodeSubmissionResult } from '@/lib/leetcode'

import {
  createOverlayDraftFromLog,
  deriveOverlayAssessmentSessionContext,
  hasSubmittedSessionChanges,
  hasUnpersistedDraftChanges,
  toAssessmentPracticeContext,
  toPracticeLogPatch,
  type OverlayAssessmentSessionContext,
  type OverlayFeedback,
  type OverlaySessionState,
  type OverlaySubmissionSource,
  type OverlaySubmittedSession,
} from '../domain'
import type { OverlaySessionAction } from '../domain/overlay-session-state'
import type { OverlayTimerController } from './use-overlay-timer'
import type { LeetCodeOverlayContext } from './use-leetcode-page-sync'

type LatestRef<T> = {
  current: T
}

type AcceptedAssessmentDecision = Extract<
  LeetCodeAssessmentDecision,
  { status: 'accepted' }
>

type UseOverlayReviewActionsOptions = {
  contextRef: LatestRef<LeetCodeOverlayContext | null>
  dispatch: (action: OverlaySessionAction) => void
  overlayRef: LatestRef<OverlaySessionState>
  refreshContext: (
    problemSlug: string,
    expectedSyncToken: number,
  ) => Promise<LeetCodeOverlayContext | null>
  syncTokenRef: LatestRef<number>
  timer: OverlayTimerController
}

export type OverlayReviewActions = {
  collapse: () => void
  dock: () => void
  expand: () => void
  restore: () => void
  startTimer: () => void
  pauseTimer: () => void
  resetTimer: () => void
  prepareQuickSubmit: () => Promise<void>
  submitReview: () => Promise<void>
  failReview: () => Promise<void>
  saveLeetCodeSubmissionResult: (
    result: LeetCodeSubmissionResult,
  ) => Promise<boolean>
  updateReview: () => Promise<void>
  restartLocalSession: () => void
  selectRating: (rating: ReviewRating) => void
  openSettings: () => void
  buildAssessmentSessionContext: (
    submissionSource: OverlaySubmissionSource,
  ) => OverlayAssessmentSessionContext
}

export function useOverlayReviewActions({
  contextRef,
  dispatch,
  overlayRef,
  refreshContext,
  syncTokenRef,
  timer,
}: UseOverlayReviewActionsOptions): OverlayReviewActions {
  async function refreshNextStep(problemSlug: string, saveToken: number) {
    dispatch({ type: 'next-step-loading' })

    try {
      const nextContext = await refreshContext(problemSlug, saveToken)

      if (!nextContext) {
        return
      }

      dispatch({
        type: 'next-step-loaded',
        nextStep: nextContext.nextStep,
      })
    } catch (error) {
      if (syncTokenRef.current !== saveToken) {
        return
      }

      dispatch({
        type: 'next-step-error',
        message:
          error instanceof Error
            ? `Review saved. ${error.message}`
            : 'Review saved, but the next recommendation did not load.',
      })
    }
  }

  async function persistDraftIfNeeded() {
    const draftToken = syncTokenRef.current
    const currentContext = contextRef.current
    const currentOverlay = overlayRef.current
    const problem = currentContext?.problem

    if (
      !problem ||
      !hasUnpersistedDraftChanges(currentOverlay) ||
      currentOverlay.reviewStatus === 'saving' ||
      currentOverlay.reviewStatus === 'updating'
    ) {
      return
    }

    try {
      const details = await updateCurrentPracticeLogViaRuntime({
        surface: 'content-script',
        problemSlug: problem.problemSlug,
        log: toPracticeLogPatch(currentOverlay.draft),
      })

      if (syncTokenRef.current !== draftToken) {
        return
      }

      dispatch({
        type: 'draft-persisted',
        draft: createOverlayDraftFromLog(details.currentLog),
      })
    } catch (error) {
      if (syncTokenRef.current !== draftToken) {
        return
      }

      dispatch({
        type: 'set-feedback',
        feedback: {
          tone: 'danger',
          message: error instanceof Error ? error.message : String(error),
        },
      })
    }
  }

  function collapse() {
    dispatch({ type: 'set-visual-mode', visualMode: 'collapsed' })
    void persistDraftIfNeeded()
  }

  function dock() {
    dispatch({ type: 'set-visual-mode', visualMode: 'docked' })
    void persistDraftIfNeeded()
  }

  function expand() {
    dispatch({ type: 'set-visual-mode', visualMode: 'expanded' })
  }

  function restore() {
    dispatch({ type: 'set-visual-mode', visualMode: 'collapsed' })
  }

  async function prepareQuickSubmit() {
    const currentContext = contextRef.current
    const problem = currentContext?.problem

    if (!problem) {
      setOverlayError('CogniPace is still syncing this problem.')
      return
    }

    const decision = evaluateLeetCodeAssessment({
      intent: 'quick-submit',
      difficulty: problem.difficulty,
      timing: currentContext.timing,
      elapsedSeconds: timer.readElapsedSeconds(),
      context: toAssessmentPracticeContext(
        buildAssessmentSessionContext('collapsed-quick'),
      ),
    })

    if (decision.status === 'blocked') {
      setOverlayError('Review can be submitted without solve time.')
      return
    }

    await saveAcceptedReview(decision)
  }

  async function submitReview() {
    const currentContext = contextRef.current
    const problem = currentContext?.problem

    if (!currentContext || !problem) {
      setOverlayError('CogniPace is still syncing this problem.')
      return
    }

    const decision = evaluateLeetCodeAssessment({
      intent: 'selected-rating',
      difficulty: problem.difficulty,
      timing: currentContext.timing,
      selectedRating: overlayRef.current.selectedRating,
      elapsedSeconds: timer.readElapsedSeconds(),
      context: toAssessmentPracticeContext(
        buildAssessmentSessionContext('manual-overlay'),
      ),
    })

    if (decision.status === 'blocked') {
      setOverlayError('Review can be submitted without solve time.')
      return
    }

    await saveAcceptedReview(decision)
  }

  async function failReview() {
    const currentContext = contextRef.current
    const problem = currentContext?.problem

    if (!currentContext || !problem) {
      setOverlayError('CogniPace is still syncing this problem.')
      return
    }

    const decision = evaluateLeetCodeAssessment({
      intent: 'fail',
      difficulty: problem.difficulty,
      timing: currentContext.timing,
      elapsedSeconds: timer.readElapsedSeconds(),
      context: toAssessmentPracticeContext(
        buildAssessmentSessionContext('manual-overlay'),
      ),
    })

    if (decision.status === 'blocked') {
      setOverlayError('Review can be submitted without solve time.')
      return
    }

    await saveAcceptedReview(decision)
  }

  async function saveLeetCodeSubmissionResult(
    result: LeetCodeSubmissionResult,
  ) {
    const currentContext = contextRef.current
    const problem = currentContext?.problem

    if (!currentContext || !problem) {
      setOverlayError('CogniPace is still syncing this problem.')
      return false
    }

    const assessmentContext = toAssessmentPracticeContext(
      buildAssessmentSessionContext('leetcode-watcher'),
    )
    const decision = evaluateLeetCodeAssessment(
      result.status === 'accepted'
        ? {
            intent: 'leetcode-accepted',
            difficulty: problem.difficulty,
            timing: currentContext.timing,
            elapsedSeconds: timer.readElapsedSeconds(),
            context: assessmentContext,
          }
        : {
            intent: 'fail',
            difficulty: problem.difficulty,
            timing: currentContext.timing,
            elapsedSeconds: timer.readElapsedSeconds(),
            context: assessmentContext,
          },
    )

    if (decision.status === 'blocked') {
      setOverlayError('Review can be submitted without solve time.')
      return false
    }

    return saveAcceptedReview(decision)
  }

  async function saveAcceptedReview(decision: AcceptedAssessmentDecision) {
    const saveToken = syncTokenRef.current
    const currentContext = contextRef.current
    const problem = currentContext?.problem
    const currentOverlay = overlayRef.current

    if (!currentContext || !problem || currentOverlay.submittedSession) {
      return false
    }

    dispatch({ type: 'save-started' })

    try {
      const details = await saveReviewResultViaRuntime({
        surface: 'content-script',
        problemSlug: problem.problemSlug,
        rating: decision.rating,
        reviewMode: 'leetcode',
        elapsedSeconds: decision.elapsedSeconds,
        isCorrect: decision.isCorrect,
        log: toPracticeLogPatch(currentOverlay.draft),
      })

      if (syncTokenRef.current !== saveToken) {
        return false
      }

      const snapshot = createSubmittedSnapshotFromPracticeDetails(
        details,
        decision.lockReason,
      )
      timer.lockAt(snapshot.elapsedSeconds)
      dispatch({
        type: 'submit-succeeded',
        snapshot,
        nextStep: null,
        feedback: formatAssessmentFeedback(decision),
      })
      await refreshNextStep(problem.problemSlug, saveToken)
      return true
    } catch (error) {
      if (syncTokenRef.current !== saveToken) {
        return false
      }

      dispatch({
        type: 'mutation-failed',
        message: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  async function updateReview() {
    const saveToken = syncTokenRef.current
    const currentContext = contextRef.current
    const problem = currentContext?.problem
    const currentOverlay = overlayRef.current
    const submittedSession = currentOverlay.submittedSession

    if (
      !currentContext ||
      !problem ||
      !submittedSession ||
      !hasSubmittedSessionChanges(currentOverlay)
    ) {
      return
    }

    const rating = currentOverlay.ratingLockReason
      ? submittedSession.rating
      : currentOverlay.selectedRating

    dispatch({ type: 'update-started' })

    try {
      const details = await overrideLastReviewResultViaRuntime({
        surface: 'content-script',
        problemSlug: problem.problemSlug,
        rating,
        elapsedSeconds: submittedSession.elapsedSeconds,
        isCorrect: rating !== 'again',
        log: toPracticeLogPatch(currentOverlay.draft),
      })

      if (syncTokenRef.current !== saveToken) {
        return
      }

      const snapshot = createSubmittedSnapshotFromPracticeDetails(
        details,
        submittedSession.lockReason,
      )
      dispatch({
        type: 'update-succeeded',
        snapshot,
        nextStep: null,
        feedback: {
          tone: 'success',
          message: 'Latest review updated.',
        },
      })
      await refreshNextStep(problem.problemSlug, saveToken)
    } catch (error) {
      if (syncTokenRef.current !== saveToken) {
        return
      }

      dispatch({
        type: 'mutation-failed',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  function restartLocalSession() {
    timer.reset()
    const currentPractice = contextRef.current?.practice
    const nextDraft = createOverlayDraftFromLog(currentPractice?.currentLog)
    const selectedRating =
      currentPractice?.latestAttempt?.rating ??
      currentPractice?.practice?.lastRating ??
      'good'

    dispatch({
      type: 'restart-local-session',
      draft: nextDraft,
      selectedRating,
    })
  }

  function selectRating(rating: ReviewRating) {
    dispatch({ type: 'set-selected-rating', rating })
  }

  function openSettings() {
    dispatch({
      type: 'set-feedback',
      feedback: {
        tone: 'neutral',
        message: 'Settings are available from the CogniPace popup.',
      },
    })
  }

  function setOverlayError(message: string) {
    dispatch({
      type: 'set-feedback',
      feedback: {
        tone: 'danger',
        message,
      },
    })
  }

  function buildAssessmentSessionContext(
    submissionSource: OverlaySubmissionSource,
  ): OverlayAssessmentSessionContext {
    return deriveOverlayAssessmentSessionContext({
      practice: contextRef.current?.practice ?? null,
      submissionSource,
      timerUsed: timer.readElapsedSeconds() > 0,
      currentDraftHasChanges: hasUnpersistedDraftChanges(overlayRef.current),
    })
  }

  return {
    buildAssessmentSessionContext,
    collapse,
    dock,
    expand,
    failReview,
    openSettings,
    pauseTimer: timer.pause,
    prepareQuickSubmit,
    resetTimer: timer.reset,
    restartLocalSession,
    restore,
    saveLeetCodeSubmissionResult,
    selectRating,
    startTimer: timer.start,
    submitReview,
    updateReview,
  }
}

function createSubmittedSnapshotFromPracticeDetails(
  details: SerializedPracticeDetails,
  lockReason: OverlaySubmittedSession['lockReason'],
): OverlaySubmittedSession {
  const latestAttempt = details.latestAttempt

  if (!latestAttempt) {
    throw new Error('Saved review did not include the latest attempt.')
  }

  return {
    rating: latestAttempt.rating,
    draft: createOverlayDraftFromLog(latestAttempt.log),
    elapsedSeconds: latestAttempt.elapsedSeconds,
    isCorrect: latestAttempt.isCorrect ?? latestAttempt.rating !== 'again',
    lockReason,
  }
}

function formatAssessmentFeedback(
  decision: AcceptedAssessmentDecision,
): OverlayFeedback {
  if (decision.lockReason === 'hard-mode-overtime') {
    return {
      tone: 'warning',
      message: 'Strict timing saved this overtime attempt as Again.',
    }
  }

  if (decision.lockReason === 'failed') {
    return {
      tone: 'warning',
      message: 'Failed attempt saved as Again.',
    }
  }

  return {
    tone: 'success',
    message: 'Review saved.',
  }
}
