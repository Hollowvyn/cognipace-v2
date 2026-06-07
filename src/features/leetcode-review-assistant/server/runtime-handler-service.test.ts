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
  makeRecallSessionContext,
  makeTiming,
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

describe('recommendLeetCodeAssessmentInBackground — gated', () => {
  it('returns unavailable while AI provider host permissions are not approved', async () => {
    loadActiveProviderConfigMock.mockResolvedValue(providerConfig)

    const result = await recommendLeetCodeAssessmentInBackground(
      fakeDb,
      makeRequest(),
    )

    expect(result.status).toBe('unavailable')
    if (result.status === 'unavailable') {
      expect(result.message).toBe(
        'AI recommendations are disabled until provider host permissions are approved.',
      )
      expect(result.submissionFingerprint).toBe('fp-abc-123')
    }
    expect(recommendAssessmentMock).not.toHaveBeenCalled()
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

    const gated = await recommendLeetCodeAssessmentInBackground(
      fakeDb,
      makeRequest(),
    )
    expect(JSON.stringify(gated)).not.toMatch(/apiKey/i)
    expect(JSON.stringify(gated)).not.toContain('sk-test-fixture')

    loadActiveProviderConfigMock.mockResolvedValue(null)
    const unavailable = await recommendLeetCodeAssessmentInBackground(
      fakeDb,
      makeRequest(),
    )
    expect(JSON.stringify(unavailable)).not.toMatch(/apiKey/i)
    expect(JSON.stringify(unavailable)).not.toContain('sk-test-fixture')

    loadActiveProviderConfigMock.mockResolvedValue(providerConfig)
    const gatedAgain = await recommendLeetCodeAssessmentInBackground(
      fakeDb,
      makeRequest(),
    )
    expect(JSON.stringify(gatedAgain)).not.toMatch(/apiKey/i)
    expect(JSON.stringify(gatedAgain)).not.toContain('sk-test-fixture')
  })
})

describe('recommendLeetCodeAssessmentInBackground — no practice writes', () => {
  it('exists as a callable function (transitive import guarantee enforced by architecture-boundaries.test)', () => {
    // The structural guarantee that this handler cannot transitively import
    // anything from features/practice is enforced statically by the
    // architecture-boundaries suite ("review scheduling writes" + cross-feature
    // import allowlist). This test just confirms the handler is exported.
    expect(typeof recommendLeetCodeAssessmentInBackground).toBe('function')
  })
})
