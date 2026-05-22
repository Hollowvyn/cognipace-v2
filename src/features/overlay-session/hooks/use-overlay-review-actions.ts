import {
  evaluateLeetCodeAssessment,
  type LeetCodeAssessmentDecision,
} from '@/features/assessment'
import {
  overrideLastReviewResultViaRuntime,
  saveReviewResultViaRuntime,
  updateCurrentPracticeLogViaRuntime,
} from '@/features/practice'
import type { ReviewRating } from '@/lib/fsrs'

import {
  createOverlayDraftFromLog,
  hasSubmittedSessionChanges,
  hasUnpersistedDraftChanges,
  toPracticeLogPatch,
  type OverlayFeedback,
  type OverlaySessionState,
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
  updateReview: () => Promise<void>
  restartLocalSession: () => void
  selectRating: (rating: ReviewRating) => void
  openSettings: () => void
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
      await updateCurrentPracticeLogViaRuntime({
        surface: 'content-script',
        problemId: problem.id,
        log: toPracticeLogPatch(currentOverlay.draft),
      })

      if (syncTokenRef.current !== draftToken) {
        return
      }

      dispatch({ type: 'draft-persisted', draft: currentOverlay.draft })
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
    })

    if (decision.status === 'blocked') {
      setOverlayError('Review can be submitted without solve time.')
      return
    }

    await saveAcceptedReview(decision)
  }

  async function saveAcceptedReview(decision: AcceptedAssessmentDecision) {
    const saveToken = syncTokenRef.current
    const currentContext = contextRef.current
    const problem = currentContext?.problem
    const currentOverlay = overlayRef.current

    if (!currentContext || !problem || currentOverlay.submittedSession) {
      return
    }

    dispatch({ type: 'save-started' })

    try {
      await saveReviewResultViaRuntime({
        surface: 'content-script',
        problemId: problem.id,
        rating: decision.rating,
        reviewMode: 'leetcode',
        elapsedSeconds: decision.elapsedSeconds,
        isCorrect: decision.isCorrect,
        log: toPracticeLogPatch(currentOverlay.draft),
      })

      if (syncTokenRef.current !== saveToken) {
        return
      }

      const snapshot = createSubmittedSnapshot(decision, currentOverlay.draft)
      timer.lockAt(decision.elapsedSeconds)
      dispatch({
        type: 'submit-succeeded',
        snapshot,
        nextStep: currentContext.nextStep,
        feedback: formatAssessmentFeedback(decision),
      })
      await refreshNextStep(problem.slug, saveToken)
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
      await overrideLastReviewResultViaRuntime({
        surface: 'content-script',
        problemId: problem.id,
        rating,
        elapsedSeconds: submittedSession.elapsedSeconds,
        isCorrect: rating !== 'again',
        log: toPracticeLogPatch(currentOverlay.draft),
      })

      if (syncTokenRef.current !== saveToken) {
        return
      }

      dispatch({
        type: 'update-succeeded',
        snapshot: {
          ...submittedSession,
          rating,
          draft: currentOverlay.draft,
          isCorrect: rating !== 'again',
        },
        nextStep: currentOverlay.nextStep.value,
        feedback: {
          tone: 'success',
          message: 'Latest review updated.',
        },
      })
      await refreshNextStep(problem.slug, saveToken)
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

  return {
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
    selectRating,
    startTimer: timer.start,
    submitReview,
    updateReview,
  }
}

function createSubmittedSnapshot(
  decision: AcceptedAssessmentDecision,
  draft: OverlaySubmittedSession['draft'],
): OverlaySubmittedSession {
  return {
    rating: decision.rating,
    draft,
    elapsedSeconds: decision.elapsedSeconds,
    isCorrect: decision.isCorrect,
    lockReason: decision.lockReason,
  }
}

function formatAssessmentFeedback(
  decision: AcceptedAssessmentDecision,
): OverlayFeedback {
  if (decision.lockReason === 'hard-mode-overtime') {
    return {
      tone: 'warning',
      message: 'Hard Mode overtime saved this attempt as Again.',
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
