import type {
  GenAiGenerateJsonRequest,
  GenAiGenerateJsonResult,
} from '../domain'
import { requestJsonWithAiSdk } from './providers/ai-sdk-provider'

export async function generateJson<T>(
  request: GenAiGenerateJsonRequest<T>,
): Promise<GenAiGenerateJsonResult<T>> {
  return requestJsonWithAiSdk(request)
}
