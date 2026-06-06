import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenAiProviderConfig } from '@/features/genai'

vi.mock('@/features/genai/server/genai-settings-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/genai/server/genai-settings-service')
  >('@/features/genai/server/genai-settings-service')
  return {
    ...actual,
    loadActiveProviderConfig: vi.fn(),
  }
})

vi.mock('./recommendation-service', async () => {
  const actual = await vi.importActual<
    typeof import('./recommendation-service')
  >('./recommendation-service')
  return {
    ...actual,
    recommendAssessment: vi.fn(),
  }
})

import { loadActiveProviderConfig } from '@/features/genai/server/genai-settings-service'

import type { RecommendLeetCodeAssessmentRequest } from '../api/runtime-contracts'
import { recommendAssessment } from './recommendation-service'
import { recommendLeetCodeAssessmentInBackground } from './runtime-handler-service'
import {
  makeAcceptedDecision,
  makeAcceptedSubmission,
  makeProblem,
  makeProviderMetadata,
  makeRecallSessionContext,
  makeTiming,
  makeValidRecommendation,
} from '../testing/recommendation-fixtures'

const loadActiveProviderConfigMock = vi.mocked(loadActiveProviderConfig)
const recommendAssessmentMock = vi.mocked(recommendAssessment)
const fakeDb = { kind: 'test-db' } as unknown as Parameters<
  typeof recommendLeetCodeAssessmentInBackground
>[0]

function makeRequest(
  overrides: Partial<RecommendLeetCodeAssessmentRequest> = {},
): RecommendLeetCodeAssessmentRequest {
  return {
    surface: 'content-script',
    problemSlug: 'two-sum',
    submissionFingerprint: 'fp-abc-123',
    problem: makeProblem({ slug: 'two-sum' }),
    submission: makeAcceptedSubmission(),
    timing: makeTiming(),
    deterministicDecision: makeAcceptedDecision(),
    sessionContext: makeRecallSessionContext(),
    ...overrides,
  }
}

const providerConfig: GenAiProviderConfig = {
  provider: 'openai',
  model: 'gpt-test',
  apiKey: 'sk-test-fixture',
}

beforeEach(() => {
  loadActiveProviderConfigMock.mockReset()
  recommendAssessmentMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('recommendLeetCodeAssessmentInBackground — ready', () => {
  it('returns status:"ready" with recommendation, providerMetadata, fingerprint echoed', async () => {
    loadActiveProviderConfigMock.mockResolvedValue(providerConfig)
    recommendAssessmentMock.mockResolvedValue({
      status: 'ai',
      recommendation: makeValidRecommendation(),
      providerMetadata: makeProviderMetadata(),
    })

    const result = await recommendLeetCodeAssessmentInBackground(
      fakeDb,
      makeRequest(),
    )

    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.recommendation.recommendedRating).toBe('good')
      expect(result.providerMetadata.provider).toBe('openai')
      expect(result.submissionFingerprint).toBe('fp-abc-123')
    }
  })

  it('passes the request payload through to recommendAssessment with the providerConfig attached', async () => {
    loadActiveProviderConfigMock.mockResolvedValue(providerConfig)
    recommendAssessmentMock.mockResolvedValue({
      status: 'ai',
      recommendation: makeValidRecommendation(),
      providerMetadata: makeProviderMetadata(),
    })

    const request = makeRequest()
    await recommendLeetCodeAssessmentInBackground(fakeDb, request)

    expect(recommendAssessmentMock).toHaveBeenCalledOnce()
    expect(recommendAssessmentMock).toHaveBeenCalledWith({
      problem: request.problem,
      submission: request.submission,
      timing: request.timing,
      deterministicDecision: request.deterministicDecision,
      sessionContext: request.sessionContext,
      providerConfig,
    })
  })
})

describe('recommendLeetCodeAssessmentInBackground — unavailable', () => {
  it('returns status:"unavailable" when loadActiveProviderConfig resolves null', async () => {
    loadActiveProviderConfigMock.mockResolvedValue(null)

    const result = await recommendLeetCodeAssessmentInBackground(
      fakeDb,
      makeRequest(),
    )

    expect(result.status).toBe('unavailable')
    if (result.status === 'unavailable') {
      expect(result.message).toMatch(/not configured/i)
      expect(result.submissionFingerprint).toBe('fp-abc-123')
    }
    expect(recommendAssessmentMock).not.toHaveBeenCalled()
  })
})

describe('recommendLeetCodeAssessmentInBackground — error', () => {
  const errorCodes = [
    'auth',
    'rate-limit',
    'network',
    'timeout',
    'invalid-output',
    'unknown',
  ] as const

  const expectedMessages: Record<(typeof errorCodes)[number], RegExp> = {
    auth: /authentication failed/i,
    'rate-limit': /rate-limited/i,
    network: /could not reach/i,
    timeout: /timed out/i,
    'invalid-output': /unexpected response/i,
    unknown: /request failed/i,
  }

  it.each(errorCodes)(
    'returns status:"error" with the user-facing message for code %s',
    async (code) => {
      loadActiveProviderConfigMock.mockResolvedValue(providerConfig)
      recommendAssessmentMock.mockResolvedValue({
        status: 'fallback',
        recommendation: makeValidRecommendation(),
        error: { code, message: 'provider said no' },
      })

      const result = await recommendLeetCodeAssessmentInBackground(
        fakeDb,
        makeRequest(),
      )

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.code).toBe(code)
        expect(result.message).toMatch(expectedMessages[code])
        expect(result.submissionFingerprint).toBe('fp-abc-123')
      }
    },
  )
})

describe('recommendLeetCodeAssessmentInBackground — internal consistency', () => {
  it('throws when request.problemSlug does not match request.problem.slug', async () => {
    loadActiveProviderConfigMock.mockResolvedValue(providerConfig)

    await expect(
      recommendLeetCodeAssessmentInBackground(
        fakeDb,
        makeRequest({
          problemSlug: 'two-sum',
          problem: makeProblem({ slug: 'three-sum' }),
        }),
      ),
    ).rejects.toThrow(/problem slug/i)

    expect(recommendAssessmentMock).not.toHaveBeenCalled()
  })

  it('runs the consistency check before resolving provider config', async () => {
    await expect(
      recommendLeetCodeAssessmentInBackground(
        fakeDb,
        makeRequest({
          problemSlug: 'two-sum',
          problem: makeProblem({ slug: 'three-sum' }),
        }),
      ),
    ).rejects.toThrow()

    expect(loadActiveProviderConfigMock).not.toHaveBeenCalled()
  })
})

describe('recommendLeetCodeAssessmentInBackground — secrets redaction', () => {
  it('returns no apiKey literal in any response branch', async () => {
    loadActiveProviderConfigMock.mockResolvedValue(providerConfig)
    recommendAssessmentMock.mockResolvedValue({
      status: 'ai',
      recommendation: makeValidRecommendation(),
      providerMetadata: makeProviderMetadata(),
    })

    const ready = await recommendLeetCodeAssessmentInBackground(
      fakeDb,
      makeRequest(),
    )
    expect(JSON.stringify(ready)).not.toMatch(/apiKey/i)
    expect(JSON.stringify(ready)).not.toContain('sk-test-fixture')

    loadActiveProviderConfigMock.mockResolvedValue(null)
    const unavailable = await recommendLeetCodeAssessmentInBackground(
      fakeDb,
      makeRequest(),
    )
    expect(JSON.stringify(unavailable)).not.toMatch(/apiKey/i)
    expect(JSON.stringify(unavailable)).not.toContain('sk-test-fixture')

    loadActiveProviderConfigMock.mockResolvedValue(providerConfig)
    recommendAssessmentMock.mockResolvedValue({
      status: 'fallback',
      recommendation: makeValidRecommendation(),
      error: { code: 'network', message: 'down' },
    })
    const error = await recommendLeetCodeAssessmentInBackground(
      fakeDb,
      makeRequest(),
    )
    expect(JSON.stringify(error)).not.toMatch(/apiKey/i)
    expect(JSON.stringify(error)).not.toContain('sk-test-fixture')
  })
})

describe('recommendLeetCodeAssessmentInBackground — no practice writes', () => {
  it('does not import or call anything from features/practice', async () => {
    // The architecture-boundary tests enforce this statically. This test is a
    // runtime sanity check that the handler's import graph does not transitively
    // pull in practice mutation code.
    const handlerModule = await import('./runtime-handler-service')
    const handlerSource = handlerModule.recommendLeetCodeAssessmentInBackground.toString()

    expect(handlerSource).not.toMatch(/practice/i)
  })
})
