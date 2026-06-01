import { describe, expect, it } from 'vitest'

import { genAiErrorCodes, genAiProviderIds } from './genai-types'

describe('genai domain surface', () => {
  it('locks the provider id order', () => {
    expect(genAiProviderIds).toEqual(['openai', 'anthropic', 'gemini'])
  })

  it('includes every documented error code without duplicates', () => {
    expect(genAiErrorCodes).toHaveLength(7)
    expect(new Set(genAiErrorCodes)).toEqual(
      new Set([
        'not-configured',
        'auth',
        'rate-limit',
        'network',
        'timeout',
        'invalid-output',
        'unknown',
      ]),
    )
  })
})
