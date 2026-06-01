import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import type {
  GenAiGenerateJsonRequest,
  GenAiGenerateJsonResult,
  GenAiProviderId,
} from '../domain'

vi.mock('./providers/openai', () => ({
  requestJson: vi.fn(() => buildSuccess('openai')),
}))
vi.mock('./providers/anthropic', () => ({
  requestJson: vi.fn(() => buildSuccess('anthropic')),
}))
vi.mock('./providers/gemini', () => ({
  requestJson: vi.fn(() => buildSuccess('gemini')),
}))

import { requestJson as openaiRequestJson } from './providers/openai'
import { requestJson as anthropicRequestJson } from './providers/anthropic'
import { requestJson as geminiRequestJson } from './providers/gemini'
import { generateJson } from './genai-client'

const schema = z.object({ ok: z.boolean() })

function buildSuccess(
  provider: GenAiProviderId,
): GenAiGenerateJsonResult<{ ok: boolean }> {
  return {
    status: 'success',
    data: { ok: true },
    providerMetadata: { provider, model: 'm', durationMs: 1 },
  }
}

function buildRequest(
  provider: GenAiProviderId,
): GenAiGenerateJsonRequest<{ ok: boolean }> {
  return {
    provider,
    model: 'm',
    apiKey: 'k',
    prompt: { system: 's', user: 'u' },
    schema,
  }
}

describe('generateJson facade', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('dispatches openai requests to the openai adapter', async () => {
    await generateJson(buildRequest('openai'))
    expect(openaiRequestJson).toHaveBeenCalledOnce()
    expect(anthropicRequestJson).not.toHaveBeenCalled()
    expect(geminiRequestJson).not.toHaveBeenCalled()
  })

  it('dispatches anthropic requests to the anthropic adapter', async () => {
    await generateJson(buildRequest('anthropic'))
    expect(anthropicRequestJson).toHaveBeenCalledOnce()
    expect(openaiRequestJson).not.toHaveBeenCalled()
    expect(geminiRequestJson).not.toHaveBeenCalled()
  })

  it('dispatches gemini requests to the gemini adapter', async () => {
    await generateJson(buildRequest('gemini'))
    expect(geminiRequestJson).toHaveBeenCalledOnce()
    expect(openaiRequestJson).not.toHaveBeenCalled()
    expect(anthropicRequestJson).not.toHaveBeenCalled()
  })

  it('returns a generic unknown error for an unrecognized provider (defensive)', async () => {
    const corrupted = {
      ...buildRequest('openai'),
      provider: 'unknown-provider' as unknown as GenAiProviderId,
    }

    const result = await generateJson(corrupted)

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe('unknown')
      expect(result.providerMetadata.provider).toBe('unknown-provider')
    }
  })
})
