import { z } from 'zod'

import {
  genAiProviderIds,
  type GenAiError,
  type GenAiProviderId,
} from './genai-types'

export const genAiProviderLabels = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
} as const satisfies Record<GenAiProviderId, string>

export const genAiProviderDefaultModels = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5',
} as const satisfies Record<GenAiProviderId, string>

export const genAiVerificationStates = [
  'unverified',
  'valid',
  'invalid',
] as const
export type GenAiVerificationState = (typeof genAiVerificationStates)[number]

export const genAiVerificationErrorCodes = [
  'auth',
  'rate-limit',
  'network',
  'timeout',
  'invalid-model',
  'invalid-output',
  'unknown',
] as const
export type GenAiVerificationErrorCode =
  (typeof genAiVerificationErrorCodes)[number]

const secretLikePattern = /(apiKey|AIza|sk-[A-Za-z0-9_-]+)/i

export const genAiProviderVerificationSchema = z.strictObject({
  state: z.enum(genAiVerificationStates),
  verifiedAt: z.iso.datetime().nullable(),
  checkedModel: z.string().nullable(),
  errorCode: z.enum(genAiVerificationErrorCodes).nullable(),
  message: z
    .string()
    .max(240)
    .refine((message) => !secretLikePattern.test(message), {
      message: 'Verification message must not contain secret-like values.',
    })
    .nullable(),
})

export const genAiProviderConnectionSchema = z.strictObject({
  model: z.string().trim().min(1).max(120),
  verification: genAiProviderVerificationSchema,
})

export const genAiConnectionMetadataSchema = z.strictObject({
  schemaVersion: z.literal(1),
  selectedProvider: z.enum(genAiProviderIds),
  providers: z.strictObject({
    gemini: genAiProviderConnectionSchema,
    openai: genAiProviderConnectionSchema,
    anthropic: genAiProviderConnectionSchema,
  }),
  updatedAt: z.iso.datetime(),
})

export type GenAiProviderVerification = z.infer<
  typeof genAiProviderVerificationSchema
>
export type GenAiProviderConnection = z.infer<
  typeof genAiProviderConnectionSchema
>
export type GenAiConnectionMetadata = z.infer<
  typeof genAiConnectionMetadataSchema
>

export type GenAiProviderStatus = {
  selectedProvider: GenAiProviderId
  selectedReady: boolean
  providers: Array<{
    provider: GenAiProviderId
    label: string
    model: string
    secretConfigured: boolean
    verificationState: GenAiVerificationState
    verifiedAt: string | null
    lastErrorCode: GenAiVerificationErrorCode | null
    lastErrorMessage: string | null
  }>
}

export type GenAiProviderAction =
  | 'save-model'
  | 'save-secret'
  | 'clear-secret'
  | 'select-provider'
  | 'test-draft'
  | 'verify-provider'

export type GenAiProviderActionResult = {
  action: GenAiProviderAction
  outcome: 'success' | 'error'
  message: string
  status: GenAiProviderStatus
  occurredAt: string
}

export function createUnverifiedProviderVerification(): GenAiProviderVerification {
  return {
    state: 'unverified',
    verifiedAt: null,
    checkedModel: null,
    errorCode: null,
    message: null,
  }
}

export function mapGenAiErrorToVerificationError(
  code: GenAiError,
): GenAiVerificationErrorCode {
  if (code === 'not-configured') {
    return 'unknown'
  }

  return code
}
