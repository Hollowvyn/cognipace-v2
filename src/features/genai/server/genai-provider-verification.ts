import { z } from 'zod'

import {
  mapGenAiErrorToVerificationError,
  type GenAiProviderVerification,
  type GenAiVerificationErrorCode,
} from '../domain/genai-connection-types'
import type { GenAiProviderConfig } from '../domain/genai-types'
import { generateJson } from './genai-service'

const verificationSchema = z.strictObject({
  ok: z.literal(true),
})

export type GenAiProviderVerificationResult =
  | {
      status: 'success'
      durationMs: number
    }
  | {
      status: 'error'
      code: GenAiVerificationErrorCode
      message: string
      durationMs: number
    }

export async function verifyProviderConnection(
  config: GenAiProviderConfig,
): Promise<GenAiProviderVerificationResult> {
  const result = await generateJson({
    ...config,
    schema: verificationSchema,
    prompt: {
      system:
        'Return compact JSON for a CogniPace provider verification test. No prose.',
      user: 'Return {"ok":true}.',
    },
    temperature: 0,
    timeoutMs: 10000,
  })

  if (result.status === 'success') {
    return {
      status: 'success',
      durationMs: result.providerMetadata.durationMs,
    }
  }

  return {
    status: 'error',
    code: mapGenAiErrorToVerificationError(result.code),
    message: sanitizeVerificationMessage(result.message),
    durationMs: result.providerMetadata.durationMs,
  }
}

export function buildVerificationMetadata(
  model: string,
  result: GenAiProviderVerificationResult,
  now = new Date(),
): GenAiProviderVerification {
  if (result.status === 'success') {
    return {
      state: 'valid',
      verifiedAt: now.toISOString(),
      checkedModel: model,
      errorCode: null,
      message: null,
    }
  }

  return {
    state: 'invalid',
    verifiedAt: now.toISOString(),
    checkedModel: model,
    errorCode: result.code,
    message: sanitizeVerificationMessage(result.message),
  }
}

function sanitizeVerificationMessage(message: string): string {
  return message
    .replace(/apiKey/gi, 'credential')
    .replace(/AIza[A-Za-z0-9_-]*/g, '[redacted]')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .slice(0, 240)
}
