import type { GenAiError, GenAiProviderId } from '../../domain'

export class GenAiTimeoutError extends Error {
  readonly tag = 'GenAiTimeoutError' as const

  constructor(message = 'GenAI request timed out') {
    super(message)
    this.name = 'GenAiTimeoutError'
  }
}

export type FetchWithTimeoutOptions = {
  timeoutMs: number
  externalSignal?: AbortSignal
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  options: FetchWithTimeoutOptions,
): Promise<Response> {
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => {
    timeoutController.abort(new GenAiTimeoutError())
  }, options.timeoutMs)

  const composedSignal = composeSignals(
    timeoutController.signal,
    options.externalSignal,
  )

  try {
    return await fetch(url, { ...init, signal: composedSignal })
  } catch (error) {
    if (timeoutController.signal.aborted) {
      const reason: unknown = timeoutController.signal.reason
      throw reason instanceof GenAiTimeoutError ? reason : new GenAiTimeoutError()
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

function composeSignals(
  primary: AbortSignal,
  secondary: AbortSignal | undefined,
): AbortSignal {
  if (!secondary) {
    return primary
  }
  if (secondary.aborted) {
    return secondary
  }
  const merged = new AbortController()
  primary.addEventListener('abort', () => merged.abort(primary.reason), {
    once: true,
  })
  secondary.addEventListener('abort', () => merged.abort(secondary.reason), {
    once: true,
  })
  return merged.signal
}

export function mapHttpStatusToGenAiError(status: number): GenAiError | null {
  if (status >= 200 && status < 300) {
    return null
  }
  if (status === 401 || status === 403) {
    return 'auth'
  }
  if (status === 429) {
    return 'rate-limit'
  }
  if (status >= 500 && status < 600) {
    return 'network'
  }
  return 'unknown'
}

export type RedactErrorMessageInput = {
  provider: GenAiProviderId
  cause: 'http' | 'timeout' | 'network' | 'invalid-output' | 'unknown'
  status?: number
  /** Short, controlled, secret-free string from the caller; appended verbatim. */
  detail?: string
}

export function redactErrorMessage(input: RedactErrorMessageInput): string {
  switch (input.cause) {
    case 'http':
      return `${input.provider} request failed: HTTP ${input.status ?? 'unknown'}`
    case 'timeout':
      return `${input.provider} request timed out`
    case 'network':
      return `${input.provider} network request failed`
    case 'invalid-output':
      return `${input.provider} returned output that failed schema validation`
    case 'unknown':
      return input.detail
        ? `${input.provider} request failed: ${input.detail}`
        : `${input.provider} request failed`
  }
}
