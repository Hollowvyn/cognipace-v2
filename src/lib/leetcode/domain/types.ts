export const leetcodeDifficulties = [
  'Easy',
  'Medium',
  'Hard',
  'Unknown',
] as const

export type LeetCodeDifficulty = (typeof leetcodeDifficulties)[number]

export type LeetCodeMetadataSource = 'graphql' | 'dom' | 'fallback'

export type LeetCodeMetadataConfidence = 'high' | 'medium' | 'low'

export type LeetCodeCodeSnapshotSource =
  | 'api'
  | 'monaco'
  | 'textarea'
  | 'code-block'
  | 'none'

export type LeetCodeSubmissionResultSource = 'api' | 'dom'

export type LeetCodeSubmissionStatus =
  | 'accepted'
  | 'wrong-answer'
  | 'runtime-error'
  | 'compile-error'
  | 'time-limit-exceeded'
  | 'memory-limit-exceeded'
  | 'output-limit-exceeded'
  | 'unknown'

export type LeetCodeProblemLocation = {
  slug: string
  url: string
  host: string
}

export type LeetCodeTopic = {
  name: string
  slug: string | null
}

export type LeetCodePageSnapshot = {
  location: LeetCodeProblemLocation
  title: string | null
  frontendId: string | null
  difficulty: LeetCodeDifficulty
  isPremium: boolean | null
  topics: LeetCodeTopic[]
  isReady: boolean
  capturedAt: number
}

export type LeetCodeProblemMetadata = {
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

export type LeetCodeCodeSnapshot = {
  code: string | null
  language: string | null
  source: LeetCodeCodeSnapshotSource
  capturedAt: number
}

export type LeetCodeSubmissionClick = {
  location: LeetCodeProblemLocation
  clickedAt: number
  buttonText: string
}

export type LeetCodeSubmittedCodeSnapshot = LeetCodeCodeSnapshot

export type LeetCodeSubmissionAttempt = {
  location: LeetCodeProblemLocation
  clickedAt: number
  submitButtonText: string
  submittedCodeSnapshot: LeetCodeSubmittedCodeSnapshot
}

export type LeetCodeSubmissionResult = {
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
  resultCodeSnapshot: LeetCodeSubmittedCodeSnapshot
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
