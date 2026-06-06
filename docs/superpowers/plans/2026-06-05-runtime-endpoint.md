# Runtime Endpoint for AI Assessment Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire one runtime method `genai.recommendLeetCodeAssessment` that the LeetCode-page content-script overlay calls to request an AI assessment recommendation, validated by sender policy, with provider config read in background-only code and secrets never returned on the wire.

**Architecture:** A thin runtime handler in `features/leetcode-review-assistant/server/runtime-handler-service.ts` validates internal consistency, resolves the active provider config via the existing `loadActiveProviderConfig(db)`, delegates to `recommendAssessment` (from #5), and maps the orchestrator's `'ai' | 'fallback'` output to the wire's `'ready' | 'unavailable' | 'error'` tagged union. The extension-messaging plumbing is grafted on through the existing `ProtocolMap` + `runtime-policy` + `register-handlers` chain.

**Tech Stack:** TypeScript, Zod 4, Vitest, WXT (extension messaging via `@webext-core/messaging`), existing `recommendAssessment` orchestrator.

---

## File structure

**New files:**

| Path | Responsibility |
|---|---|
| `src/features/leetcode-review-assistant/api/runtime-contracts.ts` | Zod schemas + inferred types for the wire request and response, plus the five sub-schemas needed (problem, submission, timing, deterministic decision, session context). |
| `src/features/leetcode-review-assistant/api/index.ts` | Public barrel for the `api/` directory. |
| `src/features/leetcode-review-assistant/server/runtime-handler-service.ts` | `recommendLeetCodeAssessmentInBackground(db, request)` + private helpers `assertConsistentProblemSlug` and `mapErrorToUserMessage`. |
| `src/features/leetcode-review-assistant/server/runtime-handler-service.test.ts` | Unit tests with `recommendAssessment` and `loadActiveProviderConfig` mocked. |

**Modified files:**

| Path | Change |
|---|---|
| `src/features/leetcode-review-assistant/server/index.ts` | Add re-export of `recommendLeetCodeAssessmentInBackground`. |
| `src/features/leetcode-review-assistant/index.ts` | Re-export new request/response schemas + types from `./api`. |
| `src/extension/messaging.ts` | Add `'genai.recommendLeetCodeAssessment'` to `ProtocolMap`; import + re-export the wire schemas. |
| `src/extension/background/runtime-policy.ts` | Add `'genai.recommendLeetCodeAssessment': ['content-script']` to `methodSurfaceAccess`. |
| `src/extension/background/register-handlers.ts` | Add `onMessage('genai.recommendLeetCodeAssessment', ...)` block that parses the request, asserts sender, and calls the handler. |
| `src/extension/background/register-handlers.test.ts` | Add sender-policy tests + happy-path integration test. |

---

## Task ordering rationale

- **Task 1** introduces the wire schemas. They have no dependencies and are exercised by their own tests, so they land cleanly first.
- **Task 2** widens the public barrels so subsequent tasks can import via the canonical paths. Tiny but isolated.
- **Task 3** builds the runtime handler with full unit-test coverage of the spec's eight server-level test cases. The handler can be exercised in isolation.
- **Task 4** wires everything into the extension messaging chain. Integration tests for sender policy land here.
- **Task 5** is the whole-project validation pass.

---

## Task 1: Wire contracts (schemas + types)

**Files:**
- Create: `src/features/leetcode-review-assistant/api/runtime-contracts.ts`
- Create: `src/features/leetcode-review-assistant/api/runtime-contracts.test.ts`

This task defines all the zod schemas needed at the wire boundary: five sub-schemas for the inner types (problem, submission, timing, deterministic decision, session context) plus the top-level request and response schemas. The TypeScript types in `features/leetcode-review-assistant/domain` and the sibling features (`assessment`, `overlay-session`) are not currently expressed as zod — these are the first zod parsers for those shapes, introduced here because the runtime boundary needs validation.

- [ ] **Step 1: Write the failing tests**

Create `src/features/leetcode-review-assistant/api/runtime-contracts.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { PROMPT_VERSION } from '../domain/recommendation-types'
import {
  recommendLeetCodeAssessmentRequestSchema,
  recommendLeetCodeAssessmentResponseSchema,
} from './runtime-contracts'

const validRequest = {
  surface: 'content-script' as const,
  problemSlug: 'two-sum',
  submissionFingerprint: 'fp-abc-123',
  problem: {
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'medium' as const,
    topics: ['array', 'hash-table'],
    statement: 'Find two numbers that add up to target.',
  },
  submission: {
    status: 'accepted' as const,
    code: 'function twoSum() {}',
    language: 'TypeScript',
    runtime: '42 ms',
    memory: '18 MB',
    passedTestCount: 57,
    totalTestCount: 57,
  },
  timing: {
    elapsedSeconds: 600,
    targetSeconds: 2100,
    timerUsed: true,
  },
  deterministicDecision: {
    status: 'accepted' as const,
    rating: 'good' as const,
    isCorrect: true,
    elapsedSeconds: 600,
    targetSeconds: 2100,
    isOverTarget: false,
    lockReason: null,
    reason: {
      code: 'leetcode-good',
      signals: {
        elapsedSeconds: 600,
        targetSeconds: 2100,
        ratioOfTarget: 600 / 2100,
        previousBestSeconds: 1200,
        beatsPreviousBest: true,
        isRecallReview: true,
      },
    },
    warnings: [],
    confidence: 0.8,
  },
  sessionContext: {
    sessionKind: 'recall-review' as const,
    submissionSource: 'leetcode-watcher' as const,
    timerUsed: true,
    previousRating: 'good' as const,
    bestElapsedSeconds: 1200,
    latestAttempt: {
      id: 'attempt-1',
      rating: 'good' as const,
      isCorrect: true,
      elapsedSeconds: 1200,
      occurredAt: Date.parse('2026-05-30T10:00:00.000Z'),
    },
    currentDraftHasChanges: false,
  },
}

const validRecommendation = {
  recommendedRating: 'good' as const,
  confidence: 'medium' as const,
  summary: 'Solved within target time.',
  primaryReason: 'Accepted on first try.',
  evidence: ['Status: accepted'],
  complexity: { time: 'O(n)', space: 'O(n)', confidence: 'high' as const },
  improvementPoints: [],
  edgeCaseNotes: [],
  shouldUpdateRating: false,
  promptVersion: PROMPT_VERSION,
}

const validProviderMetadata = {
  provider: 'openai' as const,
  model: 'gpt-4o',
  durationMs: 1234,
}

describe('recommendLeetCodeAssessmentRequestSchema', () => {
  it('accepts a canonical request', () => {
    expect(() =>
      recommendLeetCodeAssessmentRequestSchema.parse(validRequest),
    ).not.toThrow()
  })

  it('rejects surface other than content-script', () => {
    expect(() =>
      recommendLeetCodeAssessmentRequestSchema.parse({
        ...validRequest,
        surface: 'popup',
      }),
    ).toThrow()
  })

  it('rejects unknown wire fields via .strict()', () => {
    expect(() =>
      recommendLeetCodeAssessmentRequestSchema.parse({
        ...validRequest,
        unknownExtra: 'leak',
      }),
    ).toThrow()
  })

  it('rejects an empty submissionFingerprint', () => {
    expect(() =>
      recommendLeetCodeAssessmentRequestSchema.parse({
        ...validRequest,
        submissionFingerprint: '',
      }),
    ).toThrow()
  })

  it('accepts the failed submission variant', () => {
    expect(() =>
      recommendLeetCodeAssessmentRequestSchema.parse({
        ...validRequest,
        submission: {
          status: 'failed',
          code: 'function() {}',
          language: 'TypeScript',
          failingTestcase: '[1,2]',
          expectedOutput: '[0,1]',
          actualOutput: '[]',
          errorMessage: '',
          passedTestCount: 0,
          totalTestCount: 1,
        },
      }),
    ).not.toThrow()
  })

  it('accepts the no-submission variant', () => {
    expect(() =>
      recommendLeetCodeAssessmentRequestSchema.parse({
        ...validRequest,
        submission: { status: 'no-submission' },
      }),
    ).not.toThrow()
  })

  it('accepts a blocked deterministicDecision', () => {
    expect(() =>
      recommendLeetCodeAssessmentRequestSchema.parse({
        ...validRequest,
        deterministicDecision: {
          status: 'blocked',
          reason: {
            code: 'failed',
            signals: { targetSeconds: 2100 },
          },
          targetSeconds: 2100,
          elapsedSeconds: null,
        },
      }),
    ).not.toThrow()
  })

  it('accepts null latestAttempt in sessionContext', () => {
    expect(() =>
      recommendLeetCodeAssessmentRequestSchema.parse({
        ...validRequest,
        sessionContext: {
          ...validRequest.sessionContext,
          latestAttempt: null,
        },
      }),
    ).not.toThrow()
  })
})

describe('recommendLeetCodeAssessmentResponseSchema', () => {
  it('accepts a ready response', () => {
    expect(() =>
      recommendLeetCodeAssessmentResponseSchema.parse({
        status: 'ready',
        recommendation: validRecommendation,
        providerMetadata: validProviderMetadata,
        submissionFingerprint: 'fp-abc-123',
      }),
    ).not.toThrow()
  })

  it('accepts an unavailable response', () => {
    expect(() =>
      recommendLeetCodeAssessmentResponseSchema.parse({
        status: 'unavailable',
        message: 'AI is not configured.',
        submissionFingerprint: 'fp-abc-123',
      }),
    ).not.toThrow()
  })

  it('accepts an error response with providerMetadata', () => {
    expect(() =>
      recommendLeetCodeAssessmentResponseSchema.parse({
        status: 'error',
        code: 'network',
        message: 'AI request could not reach the provider.',
        providerMetadata: validProviderMetadata,
        submissionFingerprint: 'fp-abc-123',
      }),
    ).not.toThrow()
  })

  it('accepts an error response without providerMetadata', () => {
    expect(() =>
      recommendLeetCodeAssessmentResponseSchema.parse({
        status: 'error',
        code: 'auth',
        message: 'AI authentication failed.',
        submissionFingerprint: 'fp-abc-123',
      }),
    ).not.toThrow()
  })

  it('rejects an error code of not-configured', () => {
    expect(() =>
      recommendLeetCodeAssessmentResponseSchema.parse({
        status: 'error',
        code: 'not-configured',
        message: 'unused',
        submissionFingerprint: 'fp',
      }),
    ).toThrow()
  })

  it('rejects unknown wire fields via .strict()', () => {
    expect(() =>
      recommendLeetCodeAssessmentResponseSchema.parse({
        status: 'unavailable',
        message: 'AI is not configured.',
        submissionFingerprint: 'fp',
        leak: 'extra',
      }),
    ).toThrow()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/features/leetcode-review-assistant/api/runtime-contracts.test.ts`
Expected: FAIL with `Failed to resolve import "./runtime-contracts"`.

- [ ] **Step 3: Implement `runtime-contracts.ts`**

Create `src/features/leetcode-review-assistant/api/runtime-contracts.ts`:

```ts
import { genAiProviderIds } from '@/features/genai/domain/genai-types'
import { problemSlugSchema } from '@/features/problems/api/problems-contracts'
import { z } from 'zod'

import {
  PROMPT_VERSION,
  assessmentRecommendationConfidenceLevels,
  assessmentRecommendationRatings,
} from '../domain/recommendation-types'

const reviewRatingSchema = z.enum(['again', 'hard', 'good', 'easy'])

const problemDifficultySchema = z.enum(['easy', 'medium', 'hard'])

const assessmentRecommendationProblemSchema = z
  .object({
    slug: problemSlugSchema,
    title: z.string(),
    difficulty: problemDifficultySchema,
    topics: z.array(z.string()).readonly(),
    statement: z.string().optional(),
  })
  .strict()

const assessmentRecommendationSubmissionSchema = z.discriminatedUnion(
  'status',
  [
    z
      .object({
        status: z.literal('accepted'),
        code: z.string().optional(),
        language: z.string().optional(),
        runtime: z.string().optional(),
        memory: z.string().optional(),
        passedTestCount: z.number().int().nonnegative().optional(),
        totalTestCount: z.number().int().nonnegative().optional(),
      })
      .strict(),
    z
      .object({
        status: z.literal('failed'),
        code: z.string().optional(),
        language: z.string().optional(),
        failingTestcase: z.string().optional(),
        expectedOutput: z.string().optional(),
        actualOutput: z.string().optional(),
        errorMessage: z.string().optional(),
        passedTestCount: z.number().int().nonnegative().optional(),
        totalTestCount: z.number().int().nonnegative().optional(),
      })
      .strict(),
    z.object({ status: z.literal('no-submission') }).strict(),
  ],
)

const assessmentRecommendationTimingSchema = z
  .object({
    elapsedSeconds: z.number().nullable(),
    targetSeconds: z.number(),
    timerUsed: z.boolean(),
  })
  .strict()

const assessmentReasonSchema = z
  .object({
    code: z.string(),
    signals: z.record(
      z.string(),
      z.union([z.number(), z.string(), z.boolean(), z.null()]),
    ),
  })
  .strict()

const assessmentBlockedReasonSchema = z
  .object({
    code: z.string(),
    signals: z.object({ targetSeconds: z.number() }).strict(),
  })
  .strict()

const assessmentWarningSchema = z
  .object({ code: z.string() })
  .loose()

const leetCodeAssessmentDecisionSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('accepted'),
      rating: reviewRatingSchema,
      isCorrect: z.boolean(),
      elapsedSeconds: z.number().nullable(),
      targetSeconds: z.number(),
      isOverTarget: z.boolean(),
      lockReason: z.string().nullable(),
      reason: assessmentReasonSchema,
      warnings: z.array(assessmentWarningSchema),
      confidence: z.number(),
    })
    .strict(),
  z
    .object({
      status: z.literal('blocked'),
      reason: assessmentBlockedReasonSchema,
      targetSeconds: z.number(),
      elapsedSeconds: z.null(),
    })
    .strict(),
])

const overlayAssessmentLatestAttemptSchema = z
  .object({
    id: z.string(),
    rating: reviewRatingSchema,
    isCorrect: z.boolean(),
    elapsedSeconds: z.number().nullable(),
    occurredAt: z.number(),
  })
  .strict()

const overlayAssessmentSessionContextSchema = z
  .object({
    sessionKind: z.enum(['first-solve', 'recall-review']),
    submissionSource: z.enum([
      'manual-overlay',
      'collapsed-quick',
      'leetcode-watcher',
    ]),
    timerUsed: z.boolean(),
    previousRating: reviewRatingSchema.nullable(),
    bestElapsedSeconds: z.number().nullable(),
    latestAttempt: overlayAssessmentLatestAttemptSchema.nullable(),
    currentDraftHasChanges: z.boolean(),
  })
  .strict()

export const recommendLeetCodeAssessmentRequestSchema = z
  .object({
    surface: z.literal('content-script'),
    problemSlug: problemSlugSchema,
    submissionFingerprint: z.string().min(1).max(200),
    problem: assessmentRecommendationProblemSchema,
    submission: assessmentRecommendationSubmissionSchema,
    timing: assessmentRecommendationTimingSchema,
    deterministicDecision: leetCodeAssessmentDecisionSchema,
    sessionContext: overlayAssessmentSessionContextSchema,
  })
  .strict()

export type RecommendLeetCodeAssessmentRequest = z.infer<
  typeof recommendLeetCodeAssessmentRequestSchema
>

const assessmentRecommendationSchemaForResponse = z
  .object({
    recommendedRating: z.enum(assessmentRecommendationRatings),
    confidence: z.enum(assessmentRecommendationConfidenceLevels),
    summary: z.string(),
    primaryReason: z.string(),
    evidence: z.array(z.string()),
    complexity: z
      .object({
        time: z.string(),
        space: z.string(),
        confidence: z.enum(assessmentRecommendationConfidenceLevels),
      })
      .strict(),
    improvementPoints: z.array(z.string()),
    edgeCaseNotes: z.array(z.string()),
    shouldUpdateRating: z.boolean(),
    promptVersion: z.literal(PROMPT_VERSION),
  })
  .strict()

const genAiProviderMetadataSchemaForResponse = z
  .object({
    provider: z.enum(genAiProviderIds),
    model: z.string(),
    durationMs: z.number(),
  })
  .strict()

const recommendLeetCodeAssessmentErrorCodeSchema = z.enum([
  'auth',
  'rate-limit',
  'network',
  'timeout',
  'invalid-output',
  'unknown',
])

export type RecommendLeetCodeAssessmentErrorCode = z.infer<
  typeof recommendLeetCodeAssessmentErrorCodeSchema
>

export const recommendLeetCodeAssessmentResponseSchema = z.discriminatedUnion(
  'status',
  [
    z
      .object({
        status: z.literal('ready'),
        recommendation: assessmentRecommendationSchemaForResponse,
        providerMetadata: genAiProviderMetadataSchemaForResponse,
        submissionFingerprint: z.string(),
      })
      .strict(),
    z
      .object({
        status: z.literal('unavailable'),
        message: z.string(),
        submissionFingerprint: z.string(),
      })
      .strict(),
    z
      .object({
        status: z.literal('error'),
        code: recommendLeetCodeAssessmentErrorCodeSchema,
        message: z.string(),
        providerMetadata: genAiProviderMetadataSchemaForResponse.optional(),
        submissionFingerprint: z.string(),
      })
      .strict(),
  ],
)

export type RecommendLeetCodeAssessmentResponse = z.infer<
  typeof recommendLeetCodeAssessmentResponseSchema
>
```

Notes on this implementation:
- `problemSlugSchema` is imported from the problems feature's contracts module (existing canonical zod).
- The five inner schemas (`assessmentRecommendationProblemSchema`, `assessmentRecommendationSubmissionSchema`, `assessmentRecommendationTimingSchema`, `leetCodeAssessmentDecisionSchema`, `overlayAssessmentSessionContextSchema`) are file-private — they are NOT exported. They exist only to compose the request schema. Keeping them private avoids accidentally creating cross-feature schema dependencies.
- `assessmentRecommendationSchemaForResponse` mirrors the schema from `features/leetcode-review-assistant/domain/recommendation-schema.ts` but is intentionally re-declared here without the `.max()` bounds — at the wire boundary the values have already been bounded by the AI side; re-bounding would add no value and would risk drift. The orchestrator's own schema is the source of truth for the AI-side bounds.
- `genAiProviderMetadataSchemaForResponse` is file-private for the same reason — the genai feature does not currently export a zod schema for `GenAiProviderMetadata`, so we declare one here narrowly for the response.
- `recommendLeetCodeAssessmentErrorCodeSchema` is exported (typed as `RecommendLeetCodeAssessmentErrorCode`) because Task 3's error message mapping table consumes the enum directly.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run src/features/leetcode-review-assistant/api/runtime-contracts.test.ts`
Expected: PASS, 14 tests.

Then: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add src/features/leetcode-review-assistant/api/runtime-contracts.ts \
        src/features/leetcode-review-assistant/api/runtime-contracts.test.ts
git commit -m "feat(leetcode-review-assistant): add runtime endpoint wire schemas"
```

---

## Task 2: Public barrels

**Files:**
- Create: `src/features/leetcode-review-assistant/api/index.ts`
- Modify: `src/features/leetcode-review-assistant/index.ts`

Task 4 wires the runtime endpoint through the extension messaging chain; the schemas and types need to be reachable via the public barrel paths before that wiring lands.

- [ ] **Step 1: Create the api barrel**

Create `src/features/leetcode-review-assistant/api/index.ts`:

```ts
export {
  recommendLeetCodeAssessmentRequestSchema,
  recommendLeetCodeAssessmentResponseSchema,
  type RecommendLeetCodeAssessmentErrorCode,
  type RecommendLeetCodeAssessmentRequest,
  type RecommendLeetCodeAssessmentResponse,
} from './runtime-contracts'
```

- [ ] **Step 2: Update the root barrel**

Open `src/features/leetcode-review-assistant/index.ts` and add a new export block at the end of the file (after the existing `export { … } from './domain'` block):

```ts
export {
  recommendLeetCodeAssessmentRequestSchema,
  recommendLeetCodeAssessmentResponseSchema,
  type RecommendLeetCodeAssessmentErrorCode,
  type RecommendLeetCodeAssessmentRequest,
  type RecommendLeetCodeAssessmentResponse,
} from './api'
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```sh
git add src/features/leetcode-review-assistant/api/index.ts \
        src/features/leetcode-review-assistant/index.ts
git commit -m "feat(leetcode-review-assistant): expose runtime contracts via barrels"
```

---

## Task 3: Runtime handler

**Files:**
- Create: `src/features/leetcode-review-assistant/server/runtime-handler-service.ts`
- Create: `src/features/leetcode-review-assistant/server/runtime-handler-service.test.ts`
- Modify: `src/features/leetcode-review-assistant/server/index.ts`

The handler is the thin runtime layer that validates internal consistency, resolves the provider config, calls the orchestrator, and maps the result to the wire shape.

- [ ] **Step 1: Write the failing tests**

Create `src/features/leetcode-review-assistant/server/runtime-handler-service.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenAiError, GenAiProviderConfig } from '@/features/genai'

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
        error: { code: code as GenAiError, message: 'provider said no' },
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
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/features/leetcode-review-assistant/server/runtime-handler-service.test.ts`
Expected: FAIL with `Failed to resolve import "./runtime-handler-service"`.

- [ ] **Step 3: Implement `runtime-handler-service.ts`**

Create `src/features/leetcode-review-assistant/server/runtime-handler-service.ts`:

```ts
import { loadActiveProviderConfig } from '@/features/genai/server/genai-settings-service'
import type { Db } from '@/platform/db'

import type {
  RecommendLeetCodeAssessmentErrorCode,
  RecommendLeetCodeAssessmentRequest,
  RecommendLeetCodeAssessmentResponse,
} from '../api/runtime-contracts'
import { recommendAssessment } from './recommendation-service'

const UNAVAILABLE_MESSAGE =
  'AI is not configured. Add a provider in settings to get recommendations.'

const ERROR_MESSAGE_BY_CODE: Record<
  RecommendLeetCodeAssessmentErrorCode,
  string
> = {
  auth: 'AI authentication failed. Check the API key in settings.',
  'rate-limit': 'AI is rate-limited. Try again in a moment.',
  network: 'AI request could not reach the provider.',
  timeout: 'AI request timed out.',
  'invalid-output': 'AI returned an unexpected response.',
  unknown: 'AI request failed.',
}

export async function recommendLeetCodeAssessmentInBackground(
  db: Db,
  request: RecommendLeetCodeAssessmentRequest,
): Promise<RecommendLeetCodeAssessmentResponse> {
  assertConsistentProblemSlug(request)

  const providerConfig = await loadActiveProviderConfig(db)
  if (providerConfig === null) {
    return {
      status: 'unavailable',
      message: UNAVAILABLE_MESSAGE,
      submissionFingerprint: request.submissionFingerprint,
    }
  }

  const result = await recommendAssessment({
    problem: request.problem,
    submission: request.submission,
    timing: request.timing,
    deterministicDecision: request.deterministicDecision,
    sessionContext: request.sessionContext,
    providerConfig,
  })

  if (result.status === 'ai') {
    return {
      status: 'ready',
      recommendation: result.recommendation,
      providerMetadata: result.providerMetadata,
      submissionFingerprint: request.submissionFingerprint,
    }
  }

  const code = result.error.code
  if (code === 'not-configured') {
    // Defensive: pre-check should have short-circuited; fall back to unavailable.
    return {
      status: 'unavailable',
      message: UNAVAILABLE_MESSAGE,
      submissionFingerprint: request.submissionFingerprint,
    }
  }

  return {
    status: 'error',
    code,
    message: ERROR_MESSAGE_BY_CODE[code],
    submissionFingerprint: request.submissionFingerprint,
  }
}

function assertConsistentProblemSlug(
  request: RecommendLeetCodeAssessmentRequest,
): void {
  if (request.problemSlug !== request.problem.slug) {
    throw new Error(
      `Inconsistent problem slug: request.problemSlug="${request.problemSlug}" but request.problem.slug="${request.problem.slug}".`,
    )
  }
  // LeetCodeAssessmentDecision and OverlayAssessmentSessionContext do not
  // currently carry a problemSlug field, so structural consistency reduces to
  // the request.problemSlug === request.problem.slug check above.
}
```

NOTE: The implementation strings above must match the regexes in the test. If a string is edited, update both ends.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run src/features/leetcode-review-assistant/server/runtime-handler-service.test.ts`
Expected: PASS — `2 (ready) + 1 (unavailable) + 6 (error.each) + 2 (consistency) + 1 (redaction) = 12 tests`.

Then: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Update the server barrel**

Open `src/features/leetcode-review-assistant/server/index.ts` and append:

```ts
export { recommendLeetCodeAssessmentInBackground } from './runtime-handler-service'
```

- [ ] **Step 6: Commit**

```sh
git add src/features/leetcode-review-assistant/server/runtime-handler-service.ts \
        src/features/leetcode-review-assistant/server/runtime-handler-service.test.ts \
        src/features/leetcode-review-assistant/server/index.ts
git commit -m "feat(leetcode-review-assistant): add runtime handler for content-script overlay"
```

---

## Task 4: Extension messaging integration

**Files:**
- Modify: `src/extension/messaging.ts`
- Modify: `src/extension/background/runtime-policy.ts`
- Modify: `src/extension/background/register-handlers.ts`
- Modify: `src/extension/background/register-handlers.test.ts`

This task wires the new method through the messaging chain and adds the sender-policy integration tests.

- [ ] **Step 1: Add the method to `messaging.ts`**

Open `src/extension/messaging.ts`. Add the import block for the new types (place it alphabetically with the other `@/features/...` imports near the top):

```ts
import type {
  RecommendLeetCodeAssessmentRequest,
  RecommendLeetCodeAssessmentResponse,
} from '@/features/leetcode-review-assistant'
export {
  recommendLeetCodeAssessmentRequestSchema,
  recommendLeetCodeAssessmentResponseSchema,
} from '@/features/leetcode-review-assistant'
```

Then add the protocol-map entry. Inside the `ProtocolMap` interface block, add (place near the existing `'genai.*'` entries):

```ts
  'genai.recommendLeetCodeAssessment'(
    request: RecommendLeetCodeAssessmentRequest,
  ): RecommendLeetCodeAssessmentResponse
```

- [ ] **Step 2: Add to the runtime policy allowlist**

Open `src/extension/background/runtime-policy.ts`. In `methodSurfaceAccess`, add the new entry near the other `'genai.*'` entries:

```ts
  'genai.recommendLeetCodeAssessment': ['content-script'],
```

- [ ] **Step 3: Write failing sender-policy tests**

Open `src/extension/background/register-handlers.test.ts`. Add a new describe block at the end of the file's main describe (look at the existing pattern for `genai.setAiProviderSecret` tests as the template — same shape):

```ts
describe('genai.recommendLeetCodeAssessment', () => {
  const baseRequest = {
    surface: 'content-script' as const,
    problemSlug: 'two-sum',
    submissionFingerprint: 'fp-abc-123',
    problem: {
      slug: 'two-sum',
      title: 'Two Sum',
      difficulty: 'medium' as const,
      topics: ['array'],
    },
    submission: { status: 'no-submission' as const },
    timing: {
      elapsedSeconds: 600,
      targetSeconds: 2100,
      timerUsed: true,
    },
    deterministicDecision: {
      status: 'accepted' as const,
      rating: 'good' as const,
      isCorrect: true,
      elapsedSeconds: 600,
      targetSeconds: 2100,
      isOverTarget: false,
      lockReason: null,
      reason: {
        code: 'leetcode-good',
        signals: { elapsedSeconds: 600 },
      },
      warnings: [],
      confidence: 0.8,
    },
    sessionContext: {
      sessionKind: 'first-solve' as const,
      submissionSource: 'leetcode-watcher' as const,
      timerUsed: true,
      previousRating: null,
      bestElapsedSeconds: null,
      latestAttempt: null,
      currentDraftHasChanges: false,
    },
  }

  const contentScriptSender = {
    tab: { id: 1 },
  }

  beforeEach(() => {
    backgroundMocks.handlers.clear()
    backgroundMocks.recommendLeetCodeAssessmentInBackground.mockReset()
    registerBackgroundHandlers()
  })

  it('calls the handler when sender is content-script', async () => {
    backgroundMocks.recommendLeetCodeAssessmentInBackground.mockResolvedValue({
      status: 'unavailable',
      message: 'AI is not configured.',
      submissionFingerprint: 'fp-abc-123',
    })

    const handler = backgroundMocks.handlers.get(
      'genai.recommendLeetCodeAssessment',
    )
    expect(handler).toBeDefined()

    const result = await handler!({
      data: baseRequest,
      sender: contentScriptSender,
    })

    expect(
      backgroundMocks.recommendLeetCodeAssessmentInBackground,
    ).toHaveBeenCalledOnce()
    expect((result as { status: string }).status).toBe('unavailable')
  })

  it('throws when sender claims a non-content-script surface', async () => {
    backgroundMocks.assertCanSenderCallExtensionMethod.mockImplementation(
      (_method: string, surface: string) => {
        if (surface !== 'content-script') {
          throw new Error('blocked')
        }
      },
    )

    const handler = backgroundMocks.handlers.get(
      'genai.recommendLeetCodeAssessment',
    )

    await expect(
      handler!({
        data: { ...baseRequest, surface: 'popup' },
        sender: contentScriptSender,
      }),
    ).rejects.toThrow()
  })
})
```

NOTE: the implementer must check that `backgroundMocks` (defined via `vi.hoisted` at the top of `register-handlers.test.ts`) already includes a `recommendLeetCodeAssessmentInBackground: vi.fn()` field. If it doesn't, add it to the `vi.hoisted` block and to the `vi.mock('@/features/leetcode-review-assistant/server/runtime-handler-service', ...)` block. Use the existing `setAiProviderSecret` mock as the structural template.

- [ ] **Step 4: Run the test and verify it fails**

Run: `npx vitest run src/extension/background/register-handlers.test.ts`
Expected: FAIL — the handler is not yet registered.

- [ ] **Step 5: Wire the handler in `register-handlers.ts`**

Open `src/extension/background/register-handlers.ts`. Add the import near the other `@/features/leetcode-review-assistant` imports (none currently exist — add one):

```ts
import { recommendLeetCodeAssessmentInBackground } from '@/features/leetcode-review-assistant/server/runtime-handler-service'
```

Add to the destructured import list at the top of the file (near the other `*RequestSchema` imports from `@/extension/messaging`):

```ts
  recommendLeetCodeAssessmentRequestSchema,
```

Then add a new `onMessage` block inside `registerBackgroundHandlers()`, placed near the existing `'genai.*'` handlers:

```ts
  onMessage('genai.recommendLeetCodeAssessment', ({ data, sender }) => {
    const request = recommendLeetCodeAssessmentRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'genai.recommendLeetCodeAssessment',
      request.surface,
      sender,
    )
    return getAppDb().then(({ db }) =>
      recommendLeetCodeAssessmentInBackground(db, request),
    )
  })
```

- [ ] **Step 6: Run the tests and verify they pass**

Run: `npx vitest run src/extension/background/register-handlers.test.ts`
Expected: PASS — including the two new tests.

Then: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```sh
git add src/extension/messaging.ts \
        src/extension/background/runtime-policy.ts \
        src/extension/background/register-handlers.ts \
        src/extension/background/register-handlers.test.ts
git commit -m "feat(extension): wire genai.recommendLeetCodeAssessment runtime endpoint"
```

---

## Task 5: Whole-project validation

**Files:** none modified unless Step 2 catches something.

- [ ] **Step 1: Run the full check**

Run: `npm run check`
Expected: PASS for all four phases (drizzle, typecheck, lint, vitest).

- [ ] **Step 2: Resolve any failures**

If any phase fails, fix the root cause. Common cases:
- ESLint formatting in the new schema file → reformat.
- A schema field name that doesn't match the underlying TypeScript type (e.g. the runtime-contracts schema for `OverlayAssessmentSessionContext` drifted from the type in `features/overlay-session/domain/session-context.ts`) → align the schema with the type. The test in Task 1 covers the canonical case but a sibling field may have been missed.
- The architecture-boundary test catches an apiKey literal in `runtime-handler-service.ts` → confirm `apiKey` does not appear anywhere outside `features/genai/`. The handler must spread `providerConfig` into the `recommendAssessment` call (via the named field `providerConfig`, not by destructuring `apiKey`).
- `runtime-handler-service.ts` does not match the `server/*service` deep-import allowlist regex → confirm the filename ends with `-service.ts`.

Re-run `npm run check` until it passes. Commit any fixes:

```sh
git commit -m "fix(leetcode-review-assistant): align runtime endpoint with project checks"
```

If `package-lock.json` shows as modified, discard with `git checkout -- package-lock.json`.

- [ ] **Step 3: Confirm clean state**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

Run: `git log --oneline -7`
Expected (most recent first):
- `feat(extension): wire genai.recommendLeetCodeAssessment runtime endpoint`
- `feat(leetcode-review-assistant): add runtime handler for content-script overlay`
- `feat(leetcode-review-assistant): expose runtime contracts via barrels`
- `feat(leetcode-review-assistant): add runtime endpoint wire schemas`
- (optional) a `fix:` commit from Step 2
- `docs: design AI assessment runtime endpoint (#6)`

Implementation complete.
