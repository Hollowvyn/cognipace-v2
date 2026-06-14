import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import type {
  GenAiGenerateJsonRequest,
  GenAiGenerateJsonResult,
  GenAiProviderId,
} from '../domain'

vi.mock('./providers/ai-sdk-provider', () => ({
  requestJsonWithAiSdk: vi.fn(() => buildSuccess('openai')),
}))

import { requestJsonWithAiSdk } from './providers/ai-sdk-provider'
import { generateJson } from './genai-service'

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

  it('delegates provider requests to the AI SDK wrapper', async () => {
    const request = buildRequest('gemini')

    const result = await generateJson(request)

    expect(result.status).toBe('success')
    expect(requestJsonWithAiSdk).toHaveBeenCalledOnce()
    expect(requestJsonWithAiSdk).toHaveBeenCalledWith(request)
  })
})
