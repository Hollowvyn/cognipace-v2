import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import {
  generateObject,
  type GenerateObjectResult,
  type LanguageModel,
} from 'ai'

import type {
  GenAiError,
  GenAiGenerateJsonRequest,
  GenAiGenerateJsonResult,
  GenAiProviderConfig,
  GenAiProviderId,
  GenAiProviderMetadata,
} from '../../domain'
import { mapHttpStatusToGenAiError, redactErrorMessage } from './shared'

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_TEMPERATURE = 0.2
const MAX_ERROR_DETAIL_CHARS = 180

export async function requestJsonWithAiSdk<T>(
  request: GenAiGenerateJsonRequest<T>,
): Promise<GenAiGenerateJsonResult<T>> {
  const startedAt = Date.now()
  const model = resolveLanguageModel(request)

  if (!model) {
    return {
      status: 'error',
      code: 'unknown',
      message: `Unrecognized provider: ${String(request.provider)}`,
      providerMetadata: {
        provider: request.provider,
        model: request.model,
        durationMs: Date.now() - startedAt,
      },
    }
  }

  try {
    const result = await generateObject({
      maxRetries: 0,
      model,
      prompt: request.prompt.user,
      schema: request.schema,
      system: request.prompt.system,
      temperature: request.temperature ?? DEFAULT_TEMPERATURE,
      timeout: request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      ...(request.signal ? { abortSignal: request.signal } : {}),
    })

    return {
      status: 'success',
      data: result.object,
      providerMetadata: buildSuccessMetadata(result, request, startedAt),
    }
  } catch (error) {
    if (request.signal?.aborted && isAbortError(error)) {
      throw error
    }

    return {
      status: 'error',
      code: mapSdkError(error),
      message: redactSdkErrorMessage(request.provider, error, request.apiKey),
      providerMetadata: {
        provider: request.provider,
        model: request.model,
        durationMs: Date.now() - startedAt,
      },
    }
  }
}

export function resolveLanguageModel(
  request: GenAiProviderConfig,
): LanguageModel | null {
  switch (request.provider) {
    case 'gemini':
      return createGoogleGenerativeAI(buildProviderOptions(request))(
        request.model,
      )
    case 'openai':
      return createOpenAI(buildProviderOptions(request))(request.model)
    case 'anthropic':
      return createAnthropic(buildProviderOptions(request))(request.model)
    default:
      return null
  }
}

function buildProviderOptions(request: GenAiProviderConfig): {
  apiKey: string
  baseURL?: string
} {
  return {
    apiKey: request.apiKey,
    ...(request.baseUrl ? { baseURL: request.baseUrl } : {}),
  }
}

function buildSuccessMetadata<T>(
  result: GenerateObjectResult<T>,
  request: GenAiGenerateJsonRequest<T>,
  startedAt: number,
): GenAiProviderMetadata {
  const metadata: GenAiProviderMetadata = {
    provider: request.provider,
    model: request.model,
    durationMs: Date.now() - startedAt,
  }

  const modelVersion = readModelVersion(result)
  if (modelVersion !== null) {
    metadata.modelVersion = modelVersion
  }

  const totalTokens = readTotalTokens(result)
  if (totalTokens !== undefined) {
    metadata.totalTokens = totalTokens
  }

  return metadata
}

function readModelVersion(result: GenerateObjectResult<unknown>): string | null {
  return typeof result.response.modelId === 'string'
    ? result.response.modelId
    : null
}

function readTotalTokens(result: GenerateObjectResult<unknown>): number | undefined {
  return typeof result.usage.totalTokens === 'number'
    ? result.usage.totalTokens
    : undefined
}

function mapSdkError(error: unknown): GenAiError {
  if (isInvalidOutputError(error)) {
    return 'invalid-output'
  }

  const status = readHttpStatus(error)
  if (status !== null) {
    return mapHttpStatusToGenAiError(status) ?? 'unknown'
  }

  if (isAbortError(error) || hasTimeoutSignal(error)) {
    return 'timeout'
  }

  if (isNetworkError(error)) {
    return 'network'
  }

  return 'unknown'
}

function redactSdkErrorMessage(
  provider: GenAiProviderId,
  error: unknown,
  apiKey: string,
): string {
  const code = mapSdkError(error)
  const status = readHttpStatus(error)

  if (status !== null && code !== 'invalid-output') {
    return redactErrorMessage({ provider, cause: 'http', status })
  }

  if (code === 'timeout') {
    return redactErrorMessage({ provider, cause: 'timeout' })
  }

  if (code === 'network') {
    return redactErrorMessage({ provider, cause: 'network' })
  }

  if (code === 'invalid-output') {
    return redactErrorMessage({ provider, cause: 'invalid-output' })
  }

  return redactErrorMessage({
    provider,
    cause: 'unknown',
    detail: sanitizeSdkErrorDetail(readErrorMessage(error), apiKey),
  })
}

function readHttpStatus(error: unknown): number | null {
  if (!isRecord(error)) {
    return null
  }

  for (const key of ['statusCode', 'status']) {
    const value = error[key]
    if (typeof value === 'number') {
      return value
    }
  }

  const response = error.response
  if (isRecord(response) && typeof response.status === 'number') {
    return response.status
  }

  return null
}

function isInvalidOutputError(error: unknown): boolean {
  const name = readErrorName(error)
  return (
    name === 'NoObjectGeneratedError' ||
    name === 'NoOutputGeneratedError' ||
    name === 'InvalidResponseDataError' ||
    name === 'TypeValidationError'
  )
}

function isAbortError(error: unknown): error is DOMException {
  return readErrorName(error) === 'AbortError'
}

function hasTimeoutSignal(error: unknown): boolean {
  const message = readErrorMessage(error).toLowerCase()
  return message.includes('timeout') || message.includes('timed out')
}

function isNetworkError(error: unknown): boolean {
  return readErrorName(error) === 'TypeError'
}

function readErrorName(error: unknown): string | null {
  if (error instanceof Error) {
    return error.name
  }
  if (isRecord(error) && typeof error.name === 'string') {
    return error.name
  }
  return null
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (isRecord(error) && typeof error.message === 'string') {
    return error.message
  }
  return 'Unknown provider error'
}

function sanitizeSdkErrorDetail(message: string, apiKey: string): string {
  let sanitized = message
    .replace(/apiKey/gi, 'credential')
    .replace(/AIza[A-Za-z0-9_-]*/g, '[redacted]')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')

  const trimmedKey = apiKey.trim()
  if (trimmedKey.length >= 4) {
    sanitized = sanitized.split(trimmedKey).join('[redacted]')
  }

  return sanitized.slice(0, MAX_ERROR_DETAIL_CHARS)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
