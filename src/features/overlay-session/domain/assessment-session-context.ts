import type { AssessmentPracticeContext } from '@/features/assessment'
import type { SerializedPracticeDetails } from '@/features/practice'
import type { ReviewRating } from '@/lib/fsrs'

export const overlaySessionKinds = ['first-solve', 'recall-review'] as const
export const overlaySubmissionSources = [
  'manual-overlay',
  'collapsed-quick',
  'leetcode-watcher',
] as const

export type OverlaySessionKind = (typeof overlaySessionKinds)[number]
export type OverlaySubmissionSource = (typeof overlaySubmissionSources)[number]

/**
 * Transient context describing the in-progress overlay review. Derived from the
 * already-persisted practice details plus live session signals (timer, draft);
 * it is never written back to practice history and never persisted.
 */
export type OverlayAssessmentSessionContext = {
  sessionKind: OverlaySessionKind
  submissionSource: OverlaySubmissionSource
  timerUsed: boolean
  previousRating: ReviewRating | null
  bestElapsedSeconds: number | null
  latestAttemptId: string | null
  currentDraftHasChanges: boolean
}

type DeriveOverlayAssessmentSessionContextInput = {
  practice: SerializedPracticeDetails | null
  submissionSource: OverlaySubmissionSource
  timerUsed: boolean
  currentDraftHasChanges: boolean
}

/**
 * Builds the transient session context from persisted practice details and the
 * live session signals supplied by the overlay. Pure: callers pass already-read
 * values so this stays free of React, runtime messaging, DB, and DOM reads.
 */
export function deriveOverlayAssessmentSessionContext({
  practice,
  submissionSource,
  timerUsed,
  currentDraftHasChanges,
}: DeriveOverlayAssessmentSessionContextInput): OverlayAssessmentSessionContext {
  const state = practice?.practice ?? null
  const latestAttempt = practice?.latestAttempt ?? null
  const hasPriorReview =
    (practice?.summary.reviewCount ?? 0) > 0 || latestAttempt !== null

  return {
    sessionKind: hasPriorReview ? 'recall-review' : 'first-solve',
    submissionSource,
    timerUsed,
    previousRating: state?.lastRating ?? latestAttempt?.rating ?? null,
    bestElapsedSeconds: state?.bestElapsedSeconds ?? null,
    latestAttemptId: latestAttempt?.id ?? null,
    currentDraftHasChanges,
  }
}

/** Narrows the session context to the read-only signals the policy consumes. */
export function toAssessmentPracticeContext(
  context: OverlayAssessmentSessionContext,
): AssessmentPracticeContext {
  return {
    reviewMode:
      context.sessionKind === 'recall-review' ? 'recall' : 'first-solve',
    previousRating: context.previousRating,
    previousBestSeconds: context.bestElapsedSeconds,
  }
}
