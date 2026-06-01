import type {
  GenAiGenerateJsonRequest,
  GenAiGenerateJsonResult,
} from '../domain'

import { requestJson as anthropicRequestJson } from './providers/anthropic'
import { requestJson as geminiRequestJson } from './providers/gemini'
import { requestJson as openaiRequestJson } from './providers/openai'

export async function generateJson<T>(
  request: GenAiGenerateJsonRequest<T>,
): Promise<GenAiGenerateJsonResult<T>> {
  switch (request.provider) {
    case 'openai':
      return openaiRequestJson(request)
    case 'anthropic':
      return anthropicRequestJson(request)
    case 'gemini':
      return geminiRequestJson(request)
    default:
      return {
        status: 'error',
        code: 'unknown',
        message: `Unrecognized provider: ${String(request.provider)}`,
        providerMetadata: {
          provider: request.provider,
          model: request.model,
          durationMs: 0,
        },
      }
  }
}
