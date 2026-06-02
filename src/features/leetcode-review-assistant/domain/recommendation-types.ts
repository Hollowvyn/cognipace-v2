import type { LeetCodeAssessmentDecision } from '@/features/assessment'
import type {
  GenAiError,
  GenAiProviderConfig,
  GenAiProviderMetadata,
} from '@/features/genai'
import type { OverlayAssessmentSessionContext } from '@/features/overlay-session'
import type { ProblemDifficulty } from '@/features/problems'

export const PROMPT_VERSION = 'leetcode-assessment-v1' as const
export type PromptVersion = typeof PROMPT_VERSION

export type AssessmentRecommendationProblem = {
  slug: string
  title: string
  difficulty: ProblemDifficulty
  topics: ReadonlyArray<string>
  /** May be omitted or truncated; see STATEMENT_CHAR_LIMIT. */
  statement?: string
}

export type AssessmentRecommendationSubmission =
  | {
      status: 'accepted'
      code?: string
      language?: string
      runtime?: string
      memory?: string
      passedTestCount?: number
      totalTestCount?: number
    }
  | {
      status: 'failed'
      code?: string
      language?: string
      failingTestcase?: string
      expectedOutput?: string
      actualOutput?: string
      errorMessage?: string
      passedTestCount?: number
      totalTestCount?: number
    }
  | { status: 'no-submission' }

export type AssessmentRecommendationTiming = {
  elapsedSeconds: number | null
  targetSeconds: number
  timerUsed: boolean
}

export type RecommendAssessmentInput = {
  problem: AssessmentRecommendationProblem
  submission: AssessmentRecommendationSubmission
  timing: AssessmentRecommendationTiming
  deterministicDecision: LeetCodeAssessmentDecision
  sessionContext: OverlayAssessmentSessionContext
  providerConfig: GenAiProviderConfig
}

export const assessmentRecommendationRatings = [
  'again',
  'hard',
  'good',
  'easy',
] as const
export type AssessmentRecommendationRating =
  (typeof assessmentRecommendationRatings)[number]

export const assessmentRecommendationConfidenceLevels = [
  'low',
  'medium',
  'high',
] as const
export type AssessmentRecommendationConfidence =
  (typeof assessmentRecommendationConfidenceLevels)[number]

export type AssessmentRecommendation = {
  recommendedRating: AssessmentRecommendationRating
  confidence: AssessmentRecommendationConfidence
  summary: string
  primaryReason: string
  evidence: ReadonlyArray<string>
  complexity: {
    time: string
    space: string
    confidence: AssessmentRecommendationConfidence
  }
  improvementPoints: ReadonlyArray<string>
  edgeCaseNotes: ReadonlyArray<string>
  shouldUpdateRating: boolean
  promptVersion: PromptVersion
}

export type RecommendAssessmentOutput =
  | {
      status: 'ai'
      recommendation: AssessmentRecommendation
      providerMetadata: GenAiProviderMetadata
    }
  | {
      status: 'fallback'
      recommendation: AssessmentRecommendation
      error: {
        code: GenAiError
        message: string
      }
    }
