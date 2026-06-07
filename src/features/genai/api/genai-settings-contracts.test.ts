import { describe, expect, it } from 'vitest'

import { setAiProviderSecretRequestSchema } from './genai-settings-contracts'

describe('genai settings contracts', () => {
  it('rejects baseUrl in provider secret requests via .strict()', () => {
    expect(() =>
      setAiProviderSecretRequestSchema.parse({
        surface: 'dashboard',
        provider: 'openai',
        secret: {
          apiKey: 'sk-test',
          baseUrl: 'https://proxy.example.test',
        },
      }),
    ).toThrow()
  })
})
