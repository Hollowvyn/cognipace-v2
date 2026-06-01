import { z } from 'zod'

import { genAiProviderIds } from '../domain/genai-types'

const surfaceSchema = z.enum(['popup', 'dashboard'])

const aiProviderSecretBodySchema = z
  .object({
    apiKey: z.string().min(1),
    baseUrl: z.string().url().optional(),
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

export type GetAiProviderSecretPresenceRequest = z.infer<
  typeof getAiProviderSecretPresenceRequestSchema
>
export type SetAiProviderSecretRequest = z.infer<
  typeof setAiProviderSecretRequestSchema
>
export type ClearAiProviderSecretRequest = z.infer<
  typeof clearAiProviderSecretRequestSchema
>
