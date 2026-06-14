import { z } from 'zod'

import {
  genAiVerificationErrorCodes,
  genAiVerificationStates,
} from '../domain/genai-connection-types'
import { genAiProviderIds } from '../domain/genai-types'

const surfaceSchema = z.enum(['popup', 'dashboard'])
const redactedTextSchema = z
  .string()
  .refine((value) => !/(apiKey|AIza|sk-[A-Za-z0-9_-]+)/i.test(value), {
    message: 'Value must not contain secret-like text.',
  })

const aiProviderSecretBodySchema = z
  .object({
    apiKey: z.string().min(1),
  })
  .strict()

export const getAiProviderSecretPresenceRequestSchema = z
  .object({
    surface: surfaceSchema,
  })
  .strict()

export const setAiProviderSecretRequestSchema = z
  .object({
    surface: surfaceSchema,
    provider: z.enum(genAiProviderIds),
    secret: aiProviderSecretBodySchema,
  })
  .strict()

export const clearAiProviderSecretRequestSchema = z
  .object({
    surface: surfaceSchema,
    provider: z.enum(genAiProviderIds),
  })
  .strict()

export const genAiSetupSurfaceSchema = z.literal('dashboard')

export const genAiProviderVerificationStateSchema = z.enum(
  genAiVerificationStates,
)

export const genAiProviderStatusSchema = z.strictObject({
  selectedProvider: z.enum(genAiProviderIds),
  selectedReady: z.boolean(),
  providers: z.array(
    z.strictObject({
      provider: z.enum(genAiProviderIds),
      label: redactedTextSchema.max(80),
      model: redactedTextSchema.trim().min(1).max(120),
      secretConfigured: z.boolean(),
      verificationState: genAiProviderVerificationStateSchema,
      verifiedAt: z.iso.datetime().nullable(),
      lastErrorCode: z.enum(genAiVerificationErrorCodes).nullable(),
      lastErrorMessage: redactedTextSchema.max(240).nullable(),
    }),
  ),
})

export const genAiProviderActionResultSchema = z.strictObject({
  action: z.enum([
    'save-model',
    'save-secret',
    'clear-secret',
    'select-provider',
    'test-draft',
    'verify-provider',
  ]),
  outcome: z.enum(['success', 'error']),
  message: redactedTextSchema.max(240),
  status: genAiProviderStatusSchema,
  occurredAt: z.iso.datetime(),
})

export const getGenAiProviderStatusRequestSchema = z.strictObject({
  surface: genAiSetupSurfaceSchema,
})

export const saveGenAiProviderModelRequestSchema = z.strictObject({
  surface: genAiSetupSurfaceSchema,
  provider: z.enum(genAiProviderIds),
  model: z.string().trim().min(1).max(120),
})

export const saveGenAiProviderSecretRequestSchema = z.strictObject({
  surface: genAiSetupSurfaceSchema,
  provider: z.enum(genAiProviderIds),
  secret: aiProviderSecretBodySchema,
})

export const testGenAiProviderDraftRequestSchema = z.strictObject({
  surface: genAiSetupSurfaceSchema,
  provider: z.enum(genAiProviderIds),
  model: z.string().trim().min(1).max(120),
  secret: aiProviderSecretBodySchema,
})

export const verifyGenAiProviderRequestSchema = z.strictObject({
  surface: genAiSetupSurfaceSchema,
  provider: z.enum(genAiProviderIds),
})

export const selectGenAiProviderRequestSchema = z.strictObject({
  surface: genAiSetupSurfaceSchema,
  provider: z.enum(genAiProviderIds),
})

export const clearGenAiProviderSecretRequestSchema = z.strictObject({
  surface: genAiSetupSurfaceSchema,
  provider: z.enum(genAiProviderIds),
})

export type GetAiProviderSecretPresenceRequest = z.infer<
  typeof getAiProviderSecretPresenceRequestSchema
>
export type SetAiProviderSecretRequest = z.infer<
  typeof setAiProviderSecretRequestSchema
>
export type ClearAiProviderSecretRequest = z.infer<
  typeof clearAiProviderSecretRequestSchema
>
export type GenAiSetupSurface = z.infer<typeof genAiSetupSurfaceSchema>
export type GenAiProviderVerificationState = z.infer<
  typeof genAiProviderVerificationStateSchema
>
export type GenAiProviderStatus = z.infer<typeof genAiProviderStatusSchema>
export type GenAiProviderActionResult = z.infer<
  typeof genAiProviderActionResultSchema
>
export type GetGenAiProviderStatusRequest = z.infer<
  typeof getGenAiProviderStatusRequestSchema
>
export type SaveGenAiProviderModelRequest = z.infer<
  typeof saveGenAiProviderModelRequestSchema
>
export type SaveGenAiProviderSecretRequest = z.infer<
  typeof saveGenAiProviderSecretRequestSchema
>
export type TestGenAiProviderDraftRequest = z.infer<
  typeof testGenAiProviderDraftRequestSchema
>
export type VerifyGenAiProviderRequest = z.infer<
  typeof verifyGenAiProviderRequestSchema
>
export type SelectGenAiProviderRequest = z.infer<
  typeof selectGenAiProviderRequestSchema
>
export type ClearGenAiProviderSecretRequest = z.infer<
  typeof clearGenAiProviderSecretRequestSchema
>
