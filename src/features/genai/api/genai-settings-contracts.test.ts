import { describe, expect, it } from 'vitest'

import {
  genAiProviderActionResultSchema,
  genAiProviderStatusSchema,
  saveGenAiProviderModelRequestSchema,
  saveGenAiProviderSecretRequestSchema,
  setAiProviderSecretRequestSchema,
  testGenAiProviderDraftRequestSchema,
} from './genai-settings-contracts'

const redactedProviderStatus = {
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
}

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
    const status = genAiProviderStatusSchema.parse(redactedProviderStatus)

    expect(JSON.stringify(status)).not.toMatch(/apiKey|AIza|sk-/)
  })

  it('rejects secret-like provider status model values', () => {
    expect(() =>
      genAiProviderStatusSchema.parse({
        ...redactedProviderStatus,
        providers: [
          {
            ...redactedProviderStatus.providers[0],
            model: 'sk-test',
          },
        ],
      }),
    ).toThrow()
  })

  it('rejects secret-like provider model setup requests', () => {
    expect(() =>
      saveGenAiProviderModelRequestSchema.parse({
        surface: 'dashboard',
        provider: 'openai',
        model: 'sk-pasted-key',
      }),
    ).toThrow()
  })

  it('rejects secret-like provider status error messages', () => {
    expect(() =>
      genAiProviderStatusSchema.parse({
        ...redactedProviderStatus,
        providers: [
          {
            ...redactedProviderStatus.providers[0],
            lastErrorMessage: 'AIza-test',
          },
        ],
      }),
    ).toThrow()
  })

  it('rejects extra apiKey fields in provider status objects', () => {
    expect(() =>
      genAiProviderStatusSchema.parse({
        ...redactedProviderStatus,
        providers: [
          {
            ...redactedProviderStatus.providers[0],
            apiKey: 'sk-test',
          },
        ],
      }),
    ).toThrow()
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

  it('rejects secret-like action result messages', () => {
    expect(() =>
      genAiProviderActionResultSchema.parse({
        action: 'verify-provider',
        outcome: 'error',
        message: 'Provider failed with sk-test',
        occurredAt: '2026-06-14T10:00:00.000Z',
        status: {
          selectedProvider: 'gemini',
          selectedReady: false,
          providers: [],
        },
      }),
    ).toThrow()
  })
})
