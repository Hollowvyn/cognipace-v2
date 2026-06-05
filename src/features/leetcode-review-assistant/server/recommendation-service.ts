import type { GenAiGenerateJsonResult } from '@/features/genai'
import { generateJson } from '@/features/genai/server/genai-service'

import { assessmentRecommendationSchema } from '../domain/recommendation-schema'
import type {
  AssessmentRecommendation,
  RecommendAssessmentInput,
  RecommendAssessmentOutput,
} from '../domain/recommendation-types'
import { buildAssessmentPrompt } from './build-assessment-prompt'
import {
  buildFallbackRecommendation,
  normalizeRecommendation,
} from './recommendation-normalizer'

export async function recommendAssessment(
  input: RecommendAssessmentInput,
): Promise<RecommendAssessmentOutput> {
  const prompt = buildAssessmentPrompt(input)

  const result: GenAiGenerateJsonResult<AssessmentRecommendation> =
    await generateJson({
      ...input.providerConfig,
      prompt,
      schema: assessmentRecommendationSchema,
    })

  if (result.status === 'error') {
    return {
      status: 'fallback',
      recommendation: buildFallbackRecommendation(input.deterministicDecision, {
        code: result.code,
        message: result.message,
      }),
      error: { code: result.code, message: result.message },
    }
  }

  return {
    status: 'ai',
    recommendation: normalizeRecommendation(
      result.data,
      input.deterministicDecision,
    ),
    providerMetadata: result.providerMetadata,
  }
}
