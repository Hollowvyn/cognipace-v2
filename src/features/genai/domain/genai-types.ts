import type { ZodType } from 'zod'

export const genAiProviderIds = ['openai', 'anthropic', 'gemini'] as const
export type GenAiProviderId = (typeof genAiProviderIds)[number]

export const genAiErrorCodes = [
  'not-configured',
  'auth',
  'rate-limit',
  'network',
  'timeout',
  'invalid-output',
  'unknown',
] as const
export type GenAiError = (typeof genAiErrorCodes)[number]

export type GenAiProviderConfig = {
  provider: GenAiProviderId
  model: string
  apiKey: string
  /** Optional override for proxies, self-hosted, OpenAI-compatible endpoints. */
  baseUrl?: string
}

export type GenAiPrompt = {
  system: string
  user: string
}

export type GenAiGenerateJsonRequest<T> = GenAiProviderConfig & {
  prompt: GenAiPrompt
  schema: ZodType<T>
  /** Inclusive 0–2 range; provider clamps. Default 0.2. */
  temperature?: number
  /** Default 30000. */
  timeoutMs?: number
  /** Caller's optional cancellation signal. Composed with the internal timeout. */
  signal?: AbortSignal
}

export type GenAiProviderMetadata = {
  provider: GenAiProviderId
  model: string
  /** Provider-reported model/version string when present in the response. */
  modelVersion?: string
  /** Whole-call duration in ms (start of fetch to result return). */
  durationMs: number
  /** Total tokens (input + output) when the provider reports usage. */
  totalTokens?: number
}

export type GenAiGenerateJsonResult<T> =
  | {
      status: 'success'
      data: T
      providerMetadata: GenAiProviderMetadata
    }
  | {
      status: 'error'
      code: GenAiError
      /** Safe to log. Never contains the API key, response headers, or raw body. */
      message: string
      providerMetadata: Pick<
        GenAiProviderMetadata,
        'provider' | 'model' | 'durationMs'
      >
    }
