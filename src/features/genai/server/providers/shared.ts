import type { GenAiError, GenAiProviderId } from '../../domain'

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
