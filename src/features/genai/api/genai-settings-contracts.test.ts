import { describe, expect, it } from 'vitest'

import {
  genAiProviderActionResultSchema,
  genAiProviderStatusSchema,
  saveGenAiProviderSecretRequestSchema,
  setAiProviderSecretRequestSchema,
  testGenAiProviderDraftRequestSchema,
} from './genai-settings-contracts'

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

  it('accepts redacted provider status without secret values', () => {
    const status = genAiProviderStatusSchema.parse({
      selectedProvider: 'gemini',
      selectedReady: false,
      providers: [
        {
          provider: 'gemini',
          label: 'Gemini',
          model: 'gemini-2.5-flash',
          secretConfigured: true,
          verificationState: 'unverified',
          verifiedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      ],
    })

    expect(JSON.stringify(status)).not.toMatch(/apiKey|AIza|sk-/)
  })

  it('allows raw keys only in provider setup request payloads', () => {
    expect(
      saveGenAiProviderSecretRequestSchema.parse({
        surface: 'dashboard',
        provider: 'gemini',
        secret: { apiKey: 'AIza-test' },
      }),
    ).toEqual({
      surface: 'dashboard',
      provider: 'gemini',
      secret: { apiKey: 'AIza-test' },
    })

    expect(
      testGenAiProviderDraftRequestSchema.parse({
        surface: 'dashboard',
        provider: 'openai',
        model: 'gpt-4o-mini',
        secret: { apiKey: 'sk-test' },
      }),
    ).toEqual({
      surface: 'dashboard',
      provider: 'openai',
      model: 'gpt-4o-mini',
      secret: { apiKey: 'sk-test' },
    })
  })

  it('never contains raw keys in provider action result shape', () => {
    const result = genAiProviderActionResultSchema.parse({
      action: 'verify-provider',
      outcome: 'success',
      message: 'Provider verified.',
      occurredAt: '2026-06-14T10:00:00.000Z',
      status: {
        selectedProvider: 'gemini',
        selectedReady: true,
        providers: [],
      },
    })

    expect(JSON.stringify(result)).not.toMatch(/apiKey|AIza|sk-/)
  })
})
