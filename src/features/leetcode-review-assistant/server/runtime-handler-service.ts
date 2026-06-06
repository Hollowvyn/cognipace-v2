import { loadActiveProviderConfig } from '@/features/genai/server/genai-settings-service'
import type { Db } from '@/platform/db'

import type {
  RecommendLeetCodeAssessmentErrorCode,
  RecommendLeetCodeAssessmentRequest,
  RecommendLeetCodeAssessmentResponse,
} from '../api/runtime-contracts'
import type { RecommendAssessmentInput } from '../domain/recommendation-types'
import { recommendAssessment } from './recommendation-service'

const UNAVAILABLE_MESSAGE =
  'AI is not configured. Add a provider in settings to get recommendations.'

const ERROR_MESSAGE_BY_CODE: Record<
  RecommendLeetCodeAssessmentErrorCode,
  string
> = {
  auth: 'AI authentication failed. Check the API key in settings.',
  'rate-limit': 'AI is rate-limited. Try again in a moment.',
  network: 'AI request could not reach the provider.',
  timeout: 'AI request timed out.',
  'invalid-output': 'AI returned an unexpected response.',
  unknown: 'AI request failed.',
}

export async function recommendLeetCodeAssessmentInBackground(
  db: Db,
  request: RecommendLeetCodeAssessmentRequest,
): Promise<RecommendLeetCodeAssessmentResponse> {
  assertConsistentProblemSlug(request)

  const providerConfig = await loadActiveProviderConfig(db)
  if (providerConfig === null) {
    return {
      status: 'unavailable',
      message: UNAVAILABLE_MESSAGE,
      submissionFingerprint: request.submissionFingerprint,
    }
  }

  // The Zod-inferred request types are structurally compatible with the domain
  // types used by recommendAssessment; the cast bridges minor exactOptionalPropertyTypes
  // and discriminated-union literal differences that are validated by the schema at
  // the call site before this handler is invoked.
  const assessmentInput: RecommendAssessmentInput = {
    problem: request.problem as RecommendAssessmentInput['problem'],
    submission: request.submission as RecommendAssessmentInput['submission'],
    timing: request.timing,
    deterministicDecision: request.deterministicDecision as RecommendAssessmentInput['deterministicDecision'],
    sessionContext: request.sessionContext as RecommendAssessmentInput['sessionContext'],
    providerConfig,
  }

  const result = await recommendAssessment(assessmentInput)

  if (result.status === 'ai') {
    return {
      status: 'ready',
      // AssessmentRecommendation uses readonly arrays; the response schema expects
      // mutable arrays. The data is structurally identical at runtime.
      recommendation: result.recommendation as RecommendLeetCodeAssessmentResponse & { status: 'ready' } extends { recommendation: infer R } ? R : never,
      providerMetadata: result.providerMetadata,
      submissionFingerprint: request.submissionFingerprint,
    }
  }

  const errorCode = result.error.code
  if (errorCode === 'not-configured') {
    return {
      status: 'unavailable',
      message: UNAVAILABLE_MESSAGE,
      submissionFingerprint: request.submissionFingerprint,
    }
  }

  return {
    status: 'error',
    code: errorCode as RecommendLeetCodeAssessmentErrorCode,
    message: ERROR_MESSAGE_BY_CODE[errorCode as RecommendLeetCodeAssessmentErrorCode],
    submissionFingerprint: request.submissionFingerprint,
  }
}

function assertConsistentProblemSlug(
  request: RecommendLeetCodeAssessmentRequest,
): void {
  if (request.problemSlug !== request.problem.slug) {
    throw new Error(
      `Inconsistent problem slug: request.problemSlug="${request.problemSlug}" but request.problem.slug="${request.problem.slug}".`,
    )
  }
}
