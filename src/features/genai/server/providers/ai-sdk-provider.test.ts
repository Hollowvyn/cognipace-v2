import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const sdkMocks = vi.hoisted(() => ({
  createAnthropic: vi.fn((options: unknown) => (model: string) => ({
    model,
    options,
    provider: 'anthropic',
  })),
  createGoogleGenerativeAI: vi.fn((options: unknown) => (model: string) => ({
    model,
    options,
    provider: 'gemini',
  })),
  createOpenAI: vi.fn((options: unknown) => (model: string) => ({
    model,
    options,
    provider: 'openai',
  })),
  generateObject: vi.fn(),
}))

vi.mock('ai', () => ({
  generateObject: sdkMocks.generateObject,
}))
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: sdkMocks.createGoogleGenerativeAI,
}))
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: sdkMocks.createOpenAI,
}))
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: sdkMocks.createAnthropic,
}))

import { requestJsonWithAiSdk } from './ai-sdk-provider'

const schema = z.strictObject({ ok: z.literal(true) })

describe('requestJsonWithAiSdk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('maps a successful Gemini object result to CogniPace metadata', async () => {
    sdkMocks.generateObject.mockResolvedValue({
      object: { ok: true },
      response: { modelId: 'gemini-2.5-flash-001' },
      usage: { totalTokens: 12 },
    })

    const result = await requestJsonWithAiSdk({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      apiKey: 'AIza-secret',
      baseUrl: 'https://generativelanguage.googleapis.test',
      prompt: { system: 'sys', user: 'user' },
      schema,
      temperature: 0,
      timeoutMs: 1234,
    })

    expect(result).toEqual({
      status: 'success',
      data: { ok: true },
      providerMetadata: expect.objectContaining({
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        modelVersion: 'gemini-2.5-flash-001',
        totalTokens: 12,
      }) as unknown,
    })
    expect(JSON.stringify(result)).not.toContain('AIza-secret')
    expect(sdkMocks.createGoogleGenerativeAI).toHaveBeenCalledWith({
      apiKey: 'AIza-secret',
      baseURL: 'https://generativelanguage.googleapis.test',
    })
    expect(sdkMocks.generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        maxRetries: 0,
        prompt: 'user',
        schema,
        system: 'sys',
        temperature: 0,
        timeout: 1234,
      }),
    )
  })

  it('selects OpenAI and Anthropic SDK providers with BYOK options', async () => {
    sdkMocks.generateObject.mockResolvedValue({
      object: { ok: true },
      response: {},
      usage: {},
    })

    await requestJsonWithAiSdk({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-openai',
      prompt: { system: 'sys', user: 'user' },
      schema,
    })
    await requestJsonWithAiSdk({
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      apiKey: 'sk-ant',
      baseUrl: 'https://api.anthropic.test',
      prompt: { system: 'sys', user: 'user' },
      schema,
    })

    expect(sdkMocks.createOpenAI).toHaveBeenCalledWith({ apiKey: 'sk-openai' })
    expect(sdkMocks.createAnthropic).toHaveBeenCalledWith({
      apiKey: 'sk-ant',
      baseURL: 'https://api.anthropic.test',
    })
  })

  it('uses safe defaults for temperature and timeout', async () => {
    sdkMocks.generateObject.mockResolvedValue({
      object: { ok: true },
      response: {},
      usage: {},
    })

    await requestJsonWithAiSdk({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-openai',
      prompt: { system: 'sys', user: 'user' },
      schema,
    })

    expect(sdkMocks.generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.2,
        timeout: 30_000,
      }),
    )
  })

  it('maps SDK auth-style errors without leaking the API key', async () => {
    sdkMocks.generateObject.mockRejectedValue(
      Object.assign(new Error('bad key sk-secret'), { statusCode: 401 }),
    )

    const result = await requestJsonWithAiSdk({
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-secret',
      prompt: { system: 'sys', user: 'user' },
      schema,
    })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe('auth')
      expect(result.message).toBe('openai request failed: HTTP 401')
      expect(result.message).not.toContain('sk-secret')
      expect(JSON.stringify(result)).not.toContain('sk-secret')
    }
  })

  it('maps SDK object generation failures to invalid-output', async () => {
    sdkMocks.generateObject.mockRejectedValue(
      Object.assign(new Error('No object generated'), {
        name: 'NoObjectGeneratedError',
      }),
    )

    const result = await requestJsonWithAiSdk({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      apiKey: 'AIza-secret',
      prompt: { system: 'sys', user: 'user' },
      schema,
    })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe('invalid-output')
      expect(result.message).toBe(
        'gemini returned output that failed schema validation',
      )
    }
  })

  it('maps SDK timeout aborts to timeout', async () => {
    sdkMocks.generateObject.mockRejectedValue(
      new DOMException('The operation was aborted.', 'AbortError'),
    )

    const result = await requestJsonWithAiSdk({
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      apiKey: 'sk-ant',
      prompt: { system: 'sys', user: 'user' },
      schema,
    })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe('timeout')
      expect(result.message).toBe('anthropic request timed out')
    }
  })

  it('re-raises caller AbortError cancellation', async () => {
    const controller = new AbortController()
    sdkMocks.generateObject.mockRejectedValue(
      new DOMException('Aborted by caller.', 'AbortError'),
    )
    controller.abort()

    await expect(
      requestJsonWithAiSdk({
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiKey: 'sk-openai',
        prompt: { system: 'sys', user: 'user' },
        schema,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('returns unknown for corrupted provider ids defensively', async () => {
    const result = await requestJsonWithAiSdk({
      provider: 'bad-provider' as never,
      model: 'model',
      apiKey: 'secret',
      prompt: { system: 'sys', user: 'user' },
      schema,
    })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe('unknown')
      expect(result.providerMetadata.provider).toBe('bad-provider')
      expect(sdkMocks.generateObject).not.toHaveBeenCalled()
    }
  })
})
