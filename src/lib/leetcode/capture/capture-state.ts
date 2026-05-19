import type {
  LeetCodeCodeSnapshot,
  LeetCodePageEvent,
  LeetCodeProblemContent,
  LeetCodeProblemLocation,
  LeetCodeProblemMetadata,
  LeetCodeSubmittedCodeSnapshot,
  LeetCodeSubmissionAttempt,
  LeetCodeSubmissionClick,
  LeetCodeSubmissionPollingDebug,
  LeetCodeSubmissionResult,
} from '../domain/types'

export interface LeetCodeCaptureState {
  location: LeetCodeProblemLocation | null
  metadata: LeetCodeProblemMetadata | null
  problemContent: LeetCodeProblemContent | null
  codeSnapshot: LeetCodeCodeSnapshot | null
  submissionClick: LeetCodeSubmissionClick | null
  submissionAttempt: LeetCodeSubmissionAttempt | null
  submissionPollingDebug: LeetCodeSubmissionPollingDebug | null
  submissionResult: LeetCodeSubmissionResult | null
  pageReadyAt: number | null
  lastUpdatedAt: number | null
}

export interface LeetCodeReviewContext {
  location: LeetCodeProblemLocation
  problem: LeetCodeProblemMetadata
  content: LeetCodeProblemContent
  currentCode: LeetCodeCodeSnapshot | null
  submittedCode: LeetCodeSubmittedCodeSnapshot | null
  submissionResult: LeetCodeSubmissionResult | null
  capturedAt: number
}

export function createEmptyLeetCodeCaptureState(
  initialLocation: LeetCodeProblemLocation | null = null,
): LeetCodeCaptureState {
  return {
    location: initialLocation,
    metadata: null,
    problemContent: null,
    codeSnapshot: null,
    submissionClick: null,
    submissionAttempt: null,
    submissionPollingDebug: null,
    submissionResult: null,
    pageReadyAt: null,
    lastUpdatedAt: null,
  }
}

export function reduceLeetCodeCaptureState(
  state: LeetCodeCaptureState,
  event: LeetCodePageEvent,
): LeetCodeCaptureState {
  switch (event.type) {
    case 'page-changed':
      return {
        ...createEmptyLeetCodeCaptureState(event.location),
        lastUpdatedAt: event.changedAt,
      }
    case 'page-ready':
      return {
        ...state,
        location: event.location,
        metadata: event.metadata,
        pageReadyAt: event.pageReadyAt,
        lastUpdatedAt: event.pageReadyAt,
      }
    case 'metadata-updated':
      return {
        ...state,
        location: event.location,
        metadata: event.metadata,
        lastUpdatedAt: event.metadata.capturedAt,
      }
    case 'problem-content-updated':
      return {
        ...state,
        location: event.location,
        problemContent: event.content,
        lastUpdatedAt: event.content.capturedAt,
      }
    case 'code-updated':
      return {
        ...state,
        location: event.location,
        codeSnapshot: event.snapshot,
        lastUpdatedAt: event.snapshot.capturedAt,
      }
    case 'submit-clicked':
      return {
        ...state,
        location: event.click.location,
        submissionClick: event.click,
        lastUpdatedAt: event.click.clickedAt,
      }
    case 'submission-started':
      return {
        ...state,
        location: event.attempt.location,
        submissionAttempt: event.attempt,
        submissionPollingDebug: null,
        submissionResult: null,
        codeSnapshot: event.attempt.submittedCodeSnapshot,
        lastUpdatedAt: event.attempt.clickedAt,
      }
    case 'submission-polling-updated':
      return {
        ...state,
        location: event.location,
        submissionPollingDebug: event.debug,
        lastUpdatedAt: event.debug.checkedAt,
      }
    case 'submission-result-updated':
      return {
        ...state,
        location: event.result.location,
        submissionResult: event.result,
        lastUpdatedAt: event.result.checkedAt,
      }
    case 'watcher-error':
      return {
        ...state,
        location: event.location ?? state.location,
        lastUpdatedAt: event.occurredAt,
      }
    default:
      return assertUnhandledLeetCodePageEvent(event)
  }
}

export function createLeetCodeReviewContext(
  state: LeetCodeCaptureState,
): LeetCodeReviewContext | null {
  if (!state.metadata || !state.problemContent) {
    return null
  }

  return {
    location: state.metadata.location,
    problem: state.metadata,
    content: state.problemContent,
    currentCode: state.codeSnapshot,
    submittedCode:
      state.submissionAttempt?.submittedCodeSnapshot ??
      state.submissionResult?.resultCodeSnapshot ??
      null,
    submissionResult: state.submissionResult,
    capturedAt:
      state.lastUpdatedAt ??
      Math.max(state.metadata.capturedAt, state.problemContent.capturedAt),
  }
}

function assertUnhandledLeetCodePageEvent(event: never): never {
  throw new Error(`Unhandled LeetCode page event: ${JSON.stringify(event)}`)
}
