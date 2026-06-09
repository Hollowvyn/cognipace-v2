import { describe, expect, it } from 'vitest'

import type { OverlayNextStep } from '@/features/app-shell'

import { toPracticeLogPatch } from './overlay-draft'
import {
  hasSubmittedSessionChanges,
  hasUnpersistedDraftChanges,
  initialOverlaySessionState,
  overlaySessionReducer,
  type OverlaySessionState,
  type OverlaySubmittedSession,
} from './overlay-session-state'

describe('overlaySessionReducer', () => {
  it('loads a problem with the practice draft and selected rating', () => {
    const draft = {
      interviewPattern: 'Two pointers',
      languages: 'TypeScript',
      notes: 'Watch overflow.',
      spaceComplexity: 'O(1)',
      timeComplexity: 'O(n)',
    }

    const state = overlaySessionReducer(
      {
        ...initialOverlaySessionState,
        feedback: { tone: 'danger', message: 'Old page failed.' },
        reviewStatus: 'submitted-clean',
        visualMode: 'expanded',
      },
      {
        type: 'problem-loaded',
        problemSlug: 'two-sum',
        draft,
        selectedRating: 'hard',
      },
    )

    expect(state).toMatchObject({
      activeProblemSlug: 'two-sum',
      draft,
      persistedDraft: draft,
      feedback: null,
      reviewStatus: 'draft',
      selectedRating: 'hard',
      visualMode: 'collapsed',
    })
  })

  it('derives submitted dirty and clean status from rating and draft changes', () => {
    const submittedState = createSubmittedState()

    const changedRatingState = overlaySessionReducer(submittedState, {
      type: 'set-selected-rating',
      rating: 'hard',
    })

    expect(changedRatingState.reviewStatus).toBe('submitted-dirty')
    expect(hasSubmittedSessionChanges(changedRatingState)).toBe(true)

    const cleanState = overlaySessionReducer(changedRatingState, {
      type: 'set-selected-rating',
      rating: 'good',
    })

    expect(cleanState.reviewStatus).toBe('submitted-clean')
    expect(hasSubmittedSessionChanges(cleanState)).toBe(false)
  })

  it('ignores rating changes when the submitted rating is locked', () => {
    const state = createSubmittedState({
      lockReason: 'failed',
      rating: 'again',
    })

    const nextState = overlaySessionReducer(state, {
      type: 'set-selected-rating',
      rating: 'easy',
    })

    expect(nextState).toBe(state)
  })

  it('marks draft persistence independently from review submission', () => {
    const dirtyState = overlaySessionReducer(initialOverlaySessionState, {
      type: 'set-draft-field',
      field: 'notes',
      value: 'Carry this draft.',
    })

    expect(hasUnpersistedDraftChanges(dirtyState)).toBe(true)

    const persistedState = overlaySessionReducer(dirtyState, {
      type: 'draft-persisted',
      draft: dirtyState.draft,
    })

    expect(hasUnpersistedDraftChanges(persistedState)).toBe(false)
  })

  it('maps submit success into a locked submitted session with next step state', () => {
    const snapshot = createSubmittedSession({
      lockReason: 'hard-mode-overtime',
      rating: 'again',
    })
    const state = overlaySessionReducer(initialOverlaySessionState, {
      type: 'submit-succeeded',
      feedback: { tone: 'warning', message: 'Saved as Again.' },
      nextStep: nextProblem,
      snapshot,
    })

    expect(state).toMatchObject({
      visualMode: 'expanded',
      reviewStatus: 'submitted-clean',
      selectedRating: 'again',
      ratingLockReason: 'hard-mode-overtime',
      submittedSession: snapshot,
      nextStep: {
        status: 'ready',
        value: nextProblem,
      },
    })
  })

  it('restarts local session without carrying submitted state', () => {
    const restartDraft = {
      ...initialOverlaySessionState.draft,
      notes: 'Keep current persisted note.',
    }
    const state = overlaySessionReducer(createSubmittedState(), {
      type: 'restart-local-session',
      draft: restartDraft,
      selectedRating: 'hard',
    })

    expect(state).toMatchObject({
      reviewStatus: 'draft',
      draft: restartDraft,
      persistedDraft: restartDraft,
      selectedRating: 'hard',
      ratingLockReason: null,
      submittedSession: null,
      feedback: null,
      nextStep: {
        status: 'hidden',
        value: null,
      },
    })
  })

  it('R1: set-selected-rating flips userTouchedRating to true', () => {
    const state = overlaySessionReducer(initialOverlaySessionState, {
      type: 'set-selected-rating',
      rating: 'hard',
    })

    expect(state.userTouchedRating).toBe(true)
    expect(state.selectedRating).toBe('hard')
  })

  it('R2: ai-preselect-rating is a no-op when userTouchedRating is true', () => {
    const touchedState = overlaySessionReducer(initialOverlaySessionState, {
      type: 'set-selected-rating',
      rating: 'hard',
    })

    const nextState = overlaySessionReducer(touchedState, {
      type: 'ai-preselect-rating',
      rating: 'easy',
    })

    expect(nextState).toBe(touchedState)
  })

  it('R3: ai-preselect-rating is a no-op when ratingLockReason is set', () => {
    const lockedState = createSubmittedState({
      lockReason: 'hard-mode-overtime',
      rating: 'again',
    })

    const nextState = overlaySessionReducer(lockedState, {
      type: 'ai-preselect-rating',
      rating: 'good',
    })

    expect(nextState).toBe(lockedState)
  })

  it('R4: ai-preselect-rating applies when no lock and no user touch and rating differs', () => {
    const nextState = overlaySessionReducer(initialOverlaySessionState, {
      type: 'ai-preselect-rating',
      rating: 'hard',
    })

    expect(nextState.selectedRating).toBe('hard')
    expect(nextState.userTouchedRating).toBe(false)
  })

  it('R5: ai-preselect-rating is a no-op when the rating equals the current selection', () => {
    const nextState = overlaySessionReducer(initialOverlaySessionState, {
      type: 'ai-preselect-rating',
      rating: initialOverlaySessionState.selectedRating,
    })

    expect(nextState).toBe(initialOverlaySessionState)
  })

  it('R6: AI preselect into a different rating marks a submitted session dirty', () => {
    const submittedState = createSubmittedState()

    const nextState = overlaySessionReducer(submittedState, {
      type: 'ai-preselect-rating',
      rating: 'hard',
    })

    expect(nextState.selectedRating).toBe('hard')
    expect(nextState.reviewStatus).toBe('submitted-dirty')
    expect(nextState.userTouchedRating).toBe(false)
    expect(hasSubmittedSessionChanges(nextState)).toBe(true)
  })

  it('R7: userTouchedRating resets to false on session-reset actions', () => {
    const touchedState = overlaySessionReducer(initialOverlaySessionState, {
      type: 'set-selected-rating',
      rating: 'hard',
    })

    const afterProblemLoaded = overlaySessionReducer(touchedState, {
      type: 'problem-loaded',
      problemSlug: 'two-sum',
      draft: initialOverlaySessionState.draft,
      selectedRating: 'good',
    })
    expect(afterProblemLoaded.userTouchedRating).toBe(false)

    const afterPageChanged = overlaySessionReducer(touchedState, {
      type: 'page-changed',
    })
    expect(afterPageChanged.userTouchedRating).toBe(false)

    const afterRestart = overlaySessionReducer(touchedState, {
      type: 'restart-local-session',
      draft: initialOverlaySessionState.draft,
      selectedRating: 'good',
    })
    expect(afterRestart.userTouchedRating).toBe(false)

    const submittedTouchedState: OverlaySessionState = {
      ...createSubmittedState(),
      activeProblemSlug: 'two-sum',
      userTouchedRating: true,
    }
    const afterContextRefreshed = overlaySessionReducer(submittedTouchedState, {
      type: 'problem-context-refreshed',
      problemSlug: 'two-sum',
      draft: submittedTouchedState.draft,
      selectedRating: submittedTouchedState.selectedRating,
      submittedSession: submittedTouchedState.submittedSession,
    })
    expect(afterContextRefreshed.userTouchedRating).toBe(false)
  })

  it('normalizes empty structured log values for practice writes', () => {
    expect(
      toPracticeLogPatch({
        interviewPattern: '  Sliding window  ',
        languages: '',
        notes: '   ',
        spaceComplexity: ' O(1) ',
        timeComplexity: 'O(n)',
      }),
    ).toEqual({
      interviewPattern: 'Sliding window',
      languages: null,
      notes: null,
      spaceComplexity: 'O(1)',
      timeComplexity: 'O(n)',
    })
  })
})

function createSubmittedState(
  overrides: Partial<OverlaySubmittedSession> = {},
): OverlaySessionState {
  const snapshot = createSubmittedSession(overrides)

  return {
    ...initialOverlaySessionState,
    draft: snapshot.draft,
    persistedDraft: snapshot.draft,
    reviewStatus: 'submitted-clean',
    selectedRating: snapshot.rating,
    ratingLockReason: snapshot.lockReason,
    submittedSession: snapshot,
  }
}

function createSubmittedSession(
  overrides: Partial<OverlaySubmittedSession> = {},
): OverlaySubmittedSession {
  const draft = {
    ...initialOverlaySessionState.draft,
    notes: 'Saved note.',
  }

  return {
    draft,
    elapsedSeconds: 95,
    isCorrect: true,
    lockReason: null,
    rating: 'good',
    ...overrides,
  }
}

const nextProblem = {
  category: null,
  detail: 'Next in track - easy',
  dueAt: null,
  kind: 'track',
  problem: {
    difficulty: 'easy',
    isPremium: false,
    problemSlug: 'valid-parentheses',
    title: 'Valid Parentheses',
  },
  title: 'Valid Parentheses',
} satisfies OverlayNextStep
