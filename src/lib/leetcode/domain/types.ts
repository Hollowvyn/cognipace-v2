export const leetcodeDifficulties = [
  'Easy',
  'Medium',
  'Hard',
  'Unknown',
] as const

export type LeetCodeDifficulty = (typeof leetcodeDifficulties)[number]

export type LeetCodeMetadataSource = 'graphql' | 'dom' | 'fallback'

export type LeetCodeMetadataConfidence = 'high' | 'medium' | 'low'

export type LeetCodeCodeSnapshotSource = 'monaco' | 'textarea' | 'none'

export type LeetCodeSubmissionStatus =
  | 'accepted'
  | 'wrong-answer'
  | 'runtime-error'
  | 'compile-error'
  | 'time-limit-exceeded'
  | 'memory-limit-exceeded'
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

export type LeetCodeSubmissionResult = {
  location: LeetCodeProblemLocation
  submissionId: string | null
  status: LeetCodeSubmissionStatus
  statusText: string
  checkedAt: number
  failingTestcase: string | null
  runtimeError: string | null
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
