import { describe, expect, it } from 'vitest'

import {
  aiProviderSecretsSchema,
  emptyAiProviderSecrets,
  makeEmptyAiProviderSecretPresence,
} from './genai-secrets-types'

describe('genai secrets domain', () => {
  it('accepts a row with per-provider secrets', () => {
    const parsed = aiProviderSecretsSchema.parse({
      openai: { apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1' },
      anthropic: { apiKey: 'sk-ant-test' },
    })
    expect(parsed.openai?.apiKey).toBe('sk-test')
    expect(parsed.anthropic?.baseUrl).toBeUndefined()
    expect(parsed.gemini).toBeUndefined()
  })

  it('accepts an empty row', () => {
    expect(aiProviderSecretsSchema.parse({})).toEqual({})
  })

  it('rejects unknown providers via .strict()', () => {
    expect(() =>
      aiProviderSecretsSchema.parse({
        mistral: { apiKey: 'sk-x' },
      }),
    ).toThrow()
  })

  it('rejects empty apiKey', () => {
    expect(() =>
      aiProviderSecretsSchema.parse({ openai: { apiKey: '' } }),
    ).toThrow()
  })

  it('rejects invalid baseUrl', () => {
    expect(() =>
      aiProviderSecretsSchema.parse({
        openai: { apiKey: 'sk-x', baseUrl: 'not-a-url' },
      }),
    ).toThrow()
  })

  it('emptyAiProviderSecrets is an empty object', () => {
    expect(emptyAiProviderSecrets).toEqual({})
  })

  it('makeEmptyAiProviderSecretPresence returns all-false for known providers', () => {
    expect(makeEmptyAiProviderSecretPresence()).toEqual({
      openai: false,
      anthropic: false,
      gemini: false,
    })
  })
})
