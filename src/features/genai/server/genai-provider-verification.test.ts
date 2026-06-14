import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { generateJson } from './genai-service'
import {
  buildVerificationMetadata,
  verifyProviderConnection,
} from './genai-provider-verification'

vi.mock('./genai-service', () => ({
  generateJson: vi.fn(),
}))

const generateJsonMock = vi.mocked(generateJson)

describe('verifyProviderConnection', () => {
  it('calls generateJson with a bounded verification request and builds valid metadata', async () => {
    generateJsonMock.mockResolvedValue({
      status: 'success',
      data: { ok: true },
      providerMetadata: {
        provider: 'gemini',
        model: 'gemini-test',
        durationMs: 42,
      },
    })

    const result = await verifyProviderConnection({
      provider: 'gemini',
      model: 'gemini-test',
      apiKey: 'AIza-test',
    })

    expect(result).toEqual({ status: 'success', durationMs: 42 })
    const request = generateJsonMock.mock.calls[0]?.[0]
    expect(request).toMatchObject({
      provider: 'gemini',
      model: 'gemini-test',
      apiKey: 'AIza-test',
      prompt: {
        system:
          'Return compact JSON for a CogniPace provider verification test. No prose.',
        user: 'Return {"ok":true}.',
      },
      temperature: 0,
      timeoutMs: 10000,
    })
    expect(request?.schema).toBeInstanceOf(z.ZodObject)
    expect(request?.schema.parse({ ok: true })).toEqual({ ok: true })

    expect(
      buildVerificationMetadata(
        'gemini-test',
        result,
        new Date('2026-06-14T10:00:00.000Z'),
      ),
    ).toEqual({
      state: 'valid',
      verifiedAt: '2026-06-14T10:00:00.000Z',
      checkedModel: 'gemini-test',
      errorCode: null,
      message: null,
    })
  })

  it('maps provider errors into invalid metadata with safe messages', async () => {
    generateJsonMock.mockResolvedValue({
      status: 'error',
      code: 'not-configured',
      message: 'Provider not configured.',
      providerMetadata: {
        provider: 'openai',
        model: 'gpt-test',
        durationMs: 13,
      },
    })

    const result = await verifyProviderConnection({
      provider: 'openai',
      model: 'gpt-test',
      apiKey: 'sk-test-secret',
    })
    const metadata = buildVerificationMetadata(
      'gpt-test',
      result,
      new Date('2026-06-14T10:01:00.000Z'),
    )

    expect(result).toEqual({
      status: 'error',
      code: 'unknown',
      message: 'Provider not configured.',
      durationMs: 13,
    })
    expect(metadata).toEqual({
      state: 'invalid',
      verifiedAt: '2026-06-14T10:01:00.000Z',
      checkedModel: 'gpt-test',
      errorCode: 'unknown',
      message: 'Provider not configured.',
    })
    expect(JSON.stringify(result)).not.toMatch(/sk-test-secret|apiKey/)
    expect(JSON.stringify(metadata)).not.toMatch(/sk-test-secret|apiKey/)
  })
})
