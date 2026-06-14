import { describe, expect, it } from 'vitest'

import {
  mapHttpStatusToGenAiError,
  redactErrorMessage,
} from './shared'

describe('mapHttpStatusToGenAiError', () => {
  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate-limit'],
    [500, 'network'],
    [502, 'network'],
    [503, 'network'],
    [400, 'unknown'],
    [404, 'unknown'],
  ] as const)('maps HTTP %s to %s', (status, expected) => {
    expect(mapHttpStatusToGenAiError(status)).toBe(expected)
  })

  it.each([200, 201, 204])('returns null for 2xx status %s', (status) => {
    expect(mapHttpStatusToGenAiError(status)).toBeNull()
  })
})

describe('redactErrorMessage', () => {
  it('formats an HTTP failure with status', () => {
    expect(
      redactErrorMessage({ provider: 'openai', cause: 'http', status: 429 }),
    ).toBe('openai request failed: HTTP 429')
  })

  it('formats a timeout', () => {
    expect(
      redactErrorMessage({ provider: 'anthropic', cause: 'timeout' }),
    ).toBe('anthropic request timed out')
  })

  it('formats a network failure', () => {
    expect(redactErrorMessage({ provider: 'gemini', cause: 'network' })).toBe(
      'gemini network request failed',
    )
  })

  it('formats an invalid-output failure', () => {
    expect(
      redactErrorMessage({ provider: 'openai', cause: 'invalid-output' }),
    ).toBe('openai returned output that failed schema validation')
  })

  it('formats unknown with a safe detail', () => {
    expect(
      redactErrorMessage({
        provider: 'openai',
        cause: 'unknown',
        detail: 'CORS preflight rejected',
      }),
    ).toBe('openai request failed: CORS preflight rejected')
  })

  it('omits trailing colon when no detail is provided', () => {
    expect(redactErrorMessage({ provider: 'openai', cause: 'unknown' })).toBe(
      'openai request failed',
    )
  })
})
