import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenAiError, GenAiGenerateJsonResult } from '@/features/genai'

vi.mock('@/features/genai/server/genai-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/genai/server/genai-service')
  >('@/features/genai/server/genai-service')
  return {
    ...actual,
    generateJson: vi.fn(),
  }
})

import { generateJson } from '@/features/genai/server/genai-service'

import type { AssessmentRecommendation } from '../domain/recommendation-types'
import { recommendAssessment } from './recommendation-service'
import {
  makeFailedDecision,
  makeProviderMetadata,
  makeRecommendAssessmentInput,
  makeValidRecommendation,
} from '../testing/recommendation-fixtures'

const generateJsonMock = vi.mocked(generateJson)

beforeEach(() => {
  generateJsonMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('recommendAssessment — AI success', () => {
  it('returns status:"ai" with normalized recommendation and providerMetadata', async () => {
    const aiOutput = makeValidRecommendation({ recommendedRating: 'good' })
    generateJsonMock.mockResolvedValue({
      status: 'success',
      data: aiOutput,
      providerMetadata: makeProviderMetadata(),
    } as GenAiGenerateJsonResult<AssessmentRecommendation>)

    const result = await recommendAssessment(makeRecommendAssessmentInput())

    expect(result.status).toBe('ai')
    if (result.status === 'ai') {
      expect(result.recommendation.recommendedRating).toBe('good')
      expect(result.recommendation.shouldUpdateRating).toBe(false)
      expect(result.providerMetadata.provider).toBe('openai')
    }
  })

  it('applies the normalizer when deterministic lock fires', async () => {
    const aiOutput = makeValidRecommendation({ recommendedRating: 'good' })
    generateJsonMock.mockResolvedValue({
      status: 'success',
      data: aiOutput,
      providerMetadata: makeProviderMetadata(),
    } as GenAiGenerateJsonResult<AssessmentRecommendation>)

    const result = await recommendAssessment(
      makeRecommendAssessmentInput({
        deterministicDecision: makeFailedDecision(),
      }),
    )

    expect(result.status).toBe('ai')
    if (result.status === 'ai') {
      expect(result.recommendation.recommendedRating).toBe('again')
      expect(result.recommendation.shouldUpdateRating).toBe(false)
    }
  })

  it('calls generateJson with the spread provider config + prompt + schema', async () => {
    generateJsonMock.mockResolvedValue({
      status: 'success',
      data: makeValidRecommendation(),
      providerMetadata: makeProviderMetadata(),
    } as GenAiGenerateJsonResult<AssessmentRecommendation>)

    await recommendAssessment(makeRecommendAssessmentInput())

    expect(generateJsonMock).toHaveBeenCalledOnce()
    const [arg] = generateJsonMock.mock.calls[0]!
    const request = arg as Record<string, unknown>
    expect(request.provider).toBe('openai')
    expect(request.model).toBe('gpt-test')
    expect(request.apiKey).toBe('sk-test-fixture')
    expect(request.prompt).toMatchObject({
      system: expect.stringContaining('CogniPace'),
      user: expect.stringContaining('## Problem'),
    })
    expect(request.schema).toBeDefined()
  })
})

describe('recommendAssessment — AI error → fallback', () => {
  it.each([
    'auth',
    'rate-limit',
    'network',
    'timeout',
    'invalid-output',
    'unknown',
  ] as const)(
    'returns status:"fallback" with deterministic rating for error code %s',
    async (code) => {
      generateJsonMock.mockResolvedValue({
        status: 'error',
        code: code as GenAiError,
        message: `${code} error from provider`,
        providerMetadata: {
          provider: 'openai',
          model: 'gpt-test',
          durationMs: 100,
        },
      } as GenAiGenerateJsonResult<AssessmentRecommendation>)

      const result = await recommendAssessment(makeRecommendAssessmentInput())

      expect(result.status).toBe('fallback')
      if (result.status === 'fallback') {
        expect(result.recommendation.recommendedRating).toBe('good')
        expect(result.error.code).toBe(code)
        expect(result.error.message).toBe(`${code} error from provider`)
        expect(result.recommendation.confidence).toBe('low')
      }
    },
  )

  it('matches deterministic "again" when failed lock + AI error', async () => {
    generateJsonMock.mockResolvedValue({
      status: 'error',
      code: 'network',
      message: 'down',
      providerMetadata: { provider: 'openai', model: 'gpt-test', durationMs: 100 },
    } as GenAiGenerateJsonResult<AssessmentRecommendation>)

    const result = await recommendAssessment(
      makeRecommendAssessmentInput({
        deterministicDecision: makeFailedDecision(),
      }),
    )

    expect(result.status).toBe('fallback')
    if (result.status === 'fallback') {
      expect(result.recommendation.recommendedRating).toBe('again')
    }
  })
})

describe('recommendAssessment — caller cancellation', () => {
  it('re-raises AbortError thrown by generateJson', async () => {
    generateJsonMock.mockRejectedValue(
      new DOMException('Aborted', 'AbortError'),
    )

    await expect(
      recommendAssessment(makeRecommendAssessmentInput()),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})
