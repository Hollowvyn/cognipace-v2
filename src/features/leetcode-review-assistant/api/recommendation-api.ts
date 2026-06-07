import { sendMessage } from '@/extension/messaging'

import type { RecommendLeetCodeAssessmentRequest } from './runtime-contracts'

export function recommendLeetCodeAssessmentViaRuntime(
  request: RecommendLeetCodeAssessmentRequest,
) {
  return sendMessage('genai.recommendLeetCodeAssessment', request)
}
