export const leetcodeDifficulties = [
  'Easy',
  'Medium',
  'Hard',
  'Unknown',
] as const

export type LeetCodeDifficulty = (typeof leetcodeDifficulties)[number]

export type LeetCodeMetadataSource = 'graphql' | 'dom' | 'fallback'

export type LeetCodeMetadataConfidence = 'high' | 'medium' | 'low'

export type LeetCodeProblemContentSource = 'graphql' | 'dom' | 'fallback'

export type LeetCodeProblemContentConfidence = 'high' | 'medium' | 'low'

export type LeetCodeCodeSnapshotSource =
  | 'api'
  | 'monaco'
  | 'textarea'
  | 'code-block'
  | 'none'

export type LeetCodeSubmissionResultSource = 'api' | 'dom'

export type LeetCodeSubmissionPollingPhase =
  | 'finding-submission'
  | 'submission-found'
  | 'submission-not-found'
  | 'checking-result'
  | 'api-result-found'
  | 'graphql-details-found'
  | 'graphql-details-missing'
  | 'dom-fallback-used'
  | 'timed-out'

export type LeetCodeSubmissionStatus =
  | 'accepted'
  | 'wrong-answer'
  | 'runtime-error'
  | 'compile-error'
  | 'time-limit-exceeded'
  | 'memory-limit-exceeded'
  | 'output-limit-exceeded'
  | 'unknown'

export interface LeetCodeProblemLocation {
  slug: string
  url: string
  host: string
}

export interface LeetCodeTopic {
  name: string
  slug: string | null
}

export interface LeetCodeExample {
  label: string
  input: string | null
  output: string | null
  explanation: string | null
  rawText: string
}

export interface LeetCodePageSnapshot {
  location: LeetCodeProblemLocation
  title: string | null
  frontendId: string | null
  difficulty: LeetCodeDifficulty
  isPremium: boolean | null
  topics: LeetCodeTopic[]
  isReady: boolean
  capturedAt: number
}

export interface LeetCodeProblemMetadata {
  location: LeetCodeProblemLocation
  title: string
  frontendId: string | null
  difficulty: LeetCodeDifficulty
  isPremium: boolean | null
  topics: LeetCodeTopic[]
  source: LeetCodeMetadataSource
  confidence: LeetCodeMetadataConfidence
  capturedAt: number
}

export interface LeetCodeProblemContent {
  location: LeetCodeProblemLocation
  statement: string
  examples: LeetCodeExample[]
  constraints: string[]
  hints: string[]
  source: LeetCodeProblemContentSource
  confidence: LeetCodeProblemContentConfidence
  capturedAt: number
  contentFingerprint: string
}

export interface LeetCodeCodeSnapshot {
  code: string | null
  language: string | null
  source: LeetCodeCodeSnapshotSource
  capturedAt: number
}

export interface LeetCodeSubmissionClick {
  location: LeetCodeProblemLocation
  clickedAt: number
  buttonText: string
}

export type LeetCodeSubmittedCodeSnapshot = LeetCodeCodeSnapshot

export interface LeetCodeSubmissionAttempt {
  location: LeetCodeProblemLocation
  clickedAt: number
  submitButtonText: string
  submittedCodeSnapshot: LeetCodeSubmittedCodeSnapshot
}

export interface LeetCodeSubmissionResult {
  location: LeetCodeProblemLocation
  submissionId: string | null
  source: LeetCodeSubmissionResultSource
  status: LeetCodeSubmissionStatus
  statusText: string
  checkedAt: number
  runtime: string | null
  memory: string | null
  passedTestCount: number | null
  totalTestCount: number | null
  failingTestcase: string | null
  errorMessage: string | null
  compileError: string | null
  runtimeError: string | null
  lastTestcase: string | null
  codeOutput: string | null
  expectedOutput: string | null
  stdOutput: string | null
  resultCodeSnapshot: LeetCodeSubmittedCodeSnapshot
}

export interface LeetCodeSubmissionPollingDebug {
  phase: LeetCodeSubmissionPollingPhase
  submissionId: string | null
  checkState: string | null
  statusText: string | null
  checkedAt: number
}

export type LeetCodePageEvent =
  | {
      type: 'page-changed'
      location: LeetCodeProblemLocation
      previousLocation: LeetCodeProblemLocation | null
      changedAt: number
    }
  | {
      type: 'page-ready'
      location: LeetCodeProblemLocation
      snapshot: LeetCodePageSnapshot
      metadata: LeetCodeProblemMetadata
      pageReadyAt: number
    }
  | {
      type: 'metadata-updated'
      location: LeetCodeProblemLocation
      metadata: LeetCodeProblemMetadata
    }
  | {
      type: 'problem-content-updated'
      location: LeetCodeProblemLocation
      content: LeetCodeProblemContent
    }
  | {
      type: 'code-updated'
      location: LeetCodeProblemLocation
      snapshot: LeetCodeCodeSnapshot
    }
  | {
      type: 'submit-clicked'
      click: LeetCodeSubmissionClick
    }
  | {
      type: 'submission-started'
      attempt: LeetCodeSubmissionAttempt
    }
  | {
      type: 'submission-polling-updated'
      location: LeetCodeProblemLocation
      debug: LeetCodeSubmissionPollingDebug
    }
  | {
      type: 'submission-result-updated'
      result: LeetCodeSubmissionResult
    }
  | {
      type: 'watcher-error'
      location: LeetCodeProblemLocation | null
      error: Error
      occurredAt: number
    }

export type LeetCodeMetadataResult =
  | {
      ok: true
      metadata: LeetCodeProblemMetadata
    }
  | {
      ok: false
      error: Error
    }

export type LeetCodeProblemContentResult =
  | {
      ok: true
      content: LeetCodeProblemContent
    }
  | {
      ok: false
      error: Error
    }
