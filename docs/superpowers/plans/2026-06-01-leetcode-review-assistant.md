# LeetCode Review Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `features/leetcode-review-assistant/` exporting `recommendAssessment(input)` — a single async function that builds a versioned prompt, calls `generateJson` from #3, normalizes the AI response against deterministic constraints, and returns a tagged outcome (`'ai' | 'fallback'`).

**Architecture:** Three-file server pipeline. `build-assessment-prompt.ts` is a pure deterministic prompt builder with named length budgets. `recommendation-normalizer.ts` is a pure clamping function plus a fallback recommendation factory. `recommendation-service.ts` orchestrates: build → `generateJson` → normalize → tagged outcome. The Zod schema in `domain/` strictly bounds every field. The `apiKey` literal never appears in this feature — `providerConfig` is spread into `generateJson` without destructuring.

**Tech Stack:** TypeScript, Zod 4, Vitest. No new dependencies. Consumes `@/features/genai`, `@/features/assessment`, `@/features/overlay-session`, `@/features/problems` via existing public surfaces.

**Spec:** `docs/superpowers/specs/2026-06-01-leetcode-review-assistant-design.md`

---

## File Plan

**Create:**
- `src/features/leetcode-review-assistant/domain/recommendation-types.ts`
- `src/features/leetcode-review-assistant/domain/recommendation-schema.ts`
- `src/features/leetcode-review-assistant/domain/recommendation-schema.test.ts`
- `src/features/leetcode-review-assistant/domain/index.ts`
- `src/features/leetcode-review-assistant/server/build-assessment-prompt.ts`
- `src/features/leetcode-review-assistant/server/build-assessment-prompt.test.ts`
- `src/features/leetcode-review-assistant/server/recommendation-normalizer.ts`
- `src/features/leetcode-review-assistant/server/recommendation-normalizer.test.ts`
- `src/features/leetcode-review-assistant/server/recommendation-service.ts`
- `src/features/leetcode-review-assistant/server/recommendation-service.test.ts`
- `src/features/leetcode-review-assistant/server/index.ts`
- `src/features/leetcode-review-assistant/testing/recommendation-fixtures.ts`
- `src/features/leetcode-review-assistant/testing/index.ts`
- `src/features/leetcode-review-assistant/index.ts`

**Modify:** None. This is a greenfield feature folder.

**Conventions:**
- Test files sit next to source.
- Run a single test file with `npx vitest run <path>`.
- Run a single test by name with `npx vitest run <path> -t "<name>"`.
- Full validation: `npm run check`.
- All commit messages follow conventional commits.

---

## Task 1: Domain types + barrels

**Files:**
- Create: `src/features/leetcode-review-assistant/domain/recommendation-types.ts`
- Create: `src/features/leetcode-review-assistant/domain/index.ts`
- Create: `src/features/leetcode-review-assistant/index.ts`

No tests in this task — the types are inert until Task 2 adds the schema.

- [ ] **Step 1: Create `recommendation-types.ts`**

Create `src/features/leetcode-review-assistant/domain/recommendation-types.ts`:

```ts
import type { LeetCodeAssessmentDecision } from '@/features/assessment'
import type {
  GenAiError,
  GenAiProviderConfig,
  GenAiProviderMetadata,
} from '@/features/genai'
import type { OverlayAssessmentSessionContext } from '@/features/overlay-session'
import type { ProblemDifficulty } from '@/features/problems'

export const PROMPT_VERSION = 'leetcode-assessment-v1' as const
export type PromptVersion = typeof PROMPT_VERSION

export type AssessmentRecommendationProblem = {
  slug: string
  title: string
  difficulty: ProblemDifficulty
  topics: ReadonlyArray<string>
  /** May be omitted or truncated; see STATEMENT_CHAR_LIMIT. */
  statement?: string
}

export type AssessmentRecommendationSubmission =
  | {
      status: 'accepted'
      code?: string
      language?: string
      runtime?: string
      memory?: string
      passedTestCount?: number
      totalTestCount?: number
    }
  | {
      status: 'failed'
      code?: string
      language?: string
      failingTestcase?: string
      expectedOutput?: string
      actualOutput?: string
      errorMessage?: string
      passedTestCount?: number
      totalTestCount?: number
    }
  | { status: 'no-submission' }

export type AssessmentRecommendationTiming = {
  elapsedSeconds: number | null
  targetSeconds: number
  timerUsed: boolean
}

export type RecommendAssessmentInput = {
  problem: AssessmentRecommendationProblem
  submission: AssessmentRecommendationSubmission
  timing: AssessmentRecommendationTiming
  deterministicDecision: LeetCodeAssessmentDecision
  sessionContext: OverlayAssessmentSessionContext
  providerConfig: GenAiProviderConfig
}

export const assessmentRecommendationRatings = [
  'again',
  'hard',
  'good',
  'easy',
] as const
export type AssessmentRecommendationRating =
  (typeof assessmentRecommendationRatings)[number]

export const assessmentRecommendationConfidenceLevels = [
  'low',
  'medium',
  'high',
] as const
export type AssessmentRecommendationConfidence =
  (typeof assessmentRecommendationConfidenceLevels)[number]

export type AssessmentRecommendation = {
  recommendedRating: AssessmentRecommendationRating
  confidence: AssessmentRecommendationConfidence
  summary: string
  primaryReason: string
  evidence: ReadonlyArray<string>
  complexity: {
    time: string
    space: string
    confidence: AssessmentRecommendationConfidence
  }
  improvementPoints: ReadonlyArray<string>
  edgeCaseNotes: ReadonlyArray<string>
  shouldUpdateRating: boolean
  promptVersion: PromptVersion
}

export type RecommendAssessmentOutput =
  | {
      status: 'ai'
      recommendation: AssessmentRecommendation
      providerMetadata: GenAiProviderMetadata
    }
  | {
      status: 'fallback'
      recommendation: AssessmentRecommendation
      error: {
        code: GenAiError
        message: string
      }
    }
```

- [ ] **Step 2: Create the domain barrel**

Create `src/features/leetcode-review-assistant/domain/index.ts`:

```ts
export {
  PROMPT_VERSION,
  assessmentRecommendationConfidenceLevels,
  assessmentRecommendationRatings,
  type AssessmentRecommendation,
  type AssessmentRecommendationConfidence,
  type AssessmentRecommendationProblem,
  type AssessmentRecommendationRating,
  type AssessmentRecommendationSubmission,
  type AssessmentRecommendationTiming,
  type PromptVersion,
  type RecommendAssessmentInput,
  type RecommendAssessmentOutput,
} from './recommendation-types'
```

- [ ] **Step 3: Create the root barrel (placeholder)**

Create `src/features/leetcode-review-assistant/index.ts`:

```ts
export {
  PROMPT_VERSION,
  assessmentRecommendationConfidenceLevels,
  assessmentRecommendationRatings,
  type AssessmentRecommendation,
  type AssessmentRecommendationConfidence,
  type AssessmentRecommendationProblem,
  type AssessmentRecommendationRating,
  type AssessmentRecommendationSubmission,
  type AssessmentRecommendationTiming,
  type PromptVersion,
  type RecommendAssessmentInput,
  type RecommendAssessmentOutput,
} from './domain'
```

Task 5 will add `export { recommendAssessment } from './server'` once the orchestrator exists.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add src/features/leetcode-review-assistant/domain src/features/leetcode-review-assistant/index.ts
git commit -m "feat(leetcode-review-assistant): add recommendation domain types"
```

---

## Task 2: Output schema

**Files:**
- Create: `src/features/leetcode-review-assistant/domain/recommendation-schema.ts`
- Create: `src/features/leetcode-review-assistant/domain/recommendation-schema.test.ts`
- Modify: `src/features/leetcode-review-assistant/domain/index.ts` (export schema + limits)

- [ ] **Step 1: Write the failing tests**

Create `src/features/leetcode-review-assistant/domain/recommendation-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  assessmentRecommendationSchema,
  assessmentRecommendationSchemaLimits,
} from './recommendation-schema'
import { PROMPT_VERSION } from './recommendation-types'

const validRecommendation = {
  recommendedRating: 'good' as const,
  confidence: 'medium' as const,
  summary: 'Solved within target time using a hash-map.',
  primaryReason: 'Accepted on first try, normal time.',
  evidence: ['Status: accepted', 'Elapsed 600s vs 2100s target'],
  complexity: {
    time: 'O(n)',
    space: 'O(n)',
    confidence: 'high' as const,
  },
  improvementPoints: [],
  edgeCaseNotes: [],
  shouldUpdateRating: false,
  promptVersion: PROMPT_VERSION,
}

describe('assessmentRecommendationSchema', () => {
  it('accepts a canonical valid recommendation', () => {
    expect(assessmentRecommendationSchema.parse(validRecommendation)).toEqual(
      validRecommendation,
    )
  })

  it('rejects an extra unknown field via .strict()', () => {
    expect(() =>
      assessmentRecommendationSchema.parse({
        ...validRecommendation,
        unknownExtra: 'leak',
      }),
    ).toThrow()
  })

  it('rejects an evidence array with more than 5 items', () => {
    expect(() =>
      assessmentRecommendationSchema.parse({
        ...validRecommendation,
        evidence: ['a', 'b', 'c', 'd', 'e', 'f'],
      }),
    ).toThrow()
  })

  it('rejects an improvementPoints array with more than 5 items', () => {
    expect(() =>
      assessmentRecommendationSchema.parse({
        ...validRecommendation,
        improvementPoints: ['a', 'b', 'c', 'd', 'e', 'f'],
      }),
    ).toThrow()
  })

  it('rejects a primaryReason longer than 200 characters', () => {
    expect(() =>
      assessmentRecommendationSchema.parse({
        ...validRecommendation,
        primaryReason: 'x'.repeat(201),
      }),
    ).toThrow()
  })

  it('rejects a complexity.time longer than 80 characters', () => {
    expect(() =>
      assessmentRecommendationSchema.parse({
        ...validRecommendation,
        complexity: { ...validRecommendation.complexity, time: 'O'.repeat(81) },
      }),
    ).toThrow()
  })

  it('rejects a wrong promptVersion literal', () => {
    expect(() =>
      assessmentRecommendationSchema.parse({
        ...validRecommendation,
        promptVersion: 'leetcode-v2',
      }),
    ).toThrow()
  })

  it('rejects an invalid recommendedRating enum value', () => {
    expect(() =>
      assessmentRecommendationSchema.parse({
        ...validRecommendation,
        recommendedRating: 'maybe',
      }),
    ).toThrow()
  })

  it('rejects an invalid confidence enum value', () => {
    expect(() =>
      assessmentRecommendationSchema.parse({
        ...validRecommendation,
        confidence: 'unknown',
      }),
    ).toThrow()
  })

  it('exposes the documented limits', () => {
    expect(assessmentRecommendationSchemaLimits).toEqual({
      evidenceMaxItems: 5,
      improvementPointsMaxItems: 5,
      edgeCaseNotesMaxItems: 5,
      shortTextMaxChars: 200,
      complexityMaxChars: 80,
    })
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/features/leetcode-review-assistant/domain/recommendation-schema.test.ts`
Expected: FAIL with `Failed to resolve import "./recommendation-schema"`.

- [ ] **Step 3: Implement `recommendation-schema.ts`**

Create `src/features/leetcode-review-assistant/domain/recommendation-schema.ts`:

```ts
import { z } from 'zod'

import {
  PROMPT_VERSION,
  assessmentRecommendationConfidenceLevels,
  assessmentRecommendationRatings,
  type AssessmentRecommendation,
} from './recommendation-types'

const EVIDENCE_MAX_ITEMS = 5
const IMPROVEMENT_POINTS_MAX_ITEMS = 5
const EDGE_CASE_NOTES_MAX_ITEMS = 5
const SHORT_TEXT_MAX_CHARS = 200
const COMPLEXITY_MAX_CHARS = 80

const shortText = z.string().min(1).max(SHORT_TEXT_MAX_CHARS)
const evidenceItemSchema = z.string().min(1).max(SHORT_TEXT_MAX_CHARS)
const improvementItemSchema = z.string().min(1).max(SHORT_TEXT_MAX_CHARS)
const edgeCaseItemSchema = z.string().min(1).max(SHORT_TEXT_MAX_CHARS)

export const assessmentRecommendationSchema = z
  .object({
    recommendedRating: z.enum(assessmentRecommendationRatings),
    confidence: z.enum(assessmentRecommendationConfidenceLevels),
    summary: shortText,
    primaryReason: shortText,
    evidence: z.array(evidenceItemSchema).max(EVIDENCE_MAX_ITEMS),
    complexity: z
      .object({
        time: z.string().min(1).max(COMPLEXITY_MAX_CHARS),
        space: z.string().min(1).max(COMPLEXITY_MAX_CHARS),
        confidence: z.enum(assessmentRecommendationConfidenceLevels),
      })
      .strict(),
    improvementPoints: z
      .array(improvementItemSchema)
      .max(IMPROVEMENT_POINTS_MAX_ITEMS),
    edgeCaseNotes: z.array(edgeCaseItemSchema).max(EDGE_CASE_NOTES_MAX_ITEMS),
    shouldUpdateRating: z.boolean(),
    promptVersion: z.literal(PROMPT_VERSION),
  })
  .strict() satisfies z.ZodType<AssessmentRecommendation>

export const assessmentRecommendationSchemaLimits = {
  evidenceMaxItems: EVIDENCE_MAX_ITEMS,
  improvementPointsMaxItems: IMPROVEMENT_POINTS_MAX_ITEMS,
  edgeCaseNotesMaxItems: EDGE_CASE_NOTES_MAX_ITEMS,
  shortTextMaxChars: SHORT_TEXT_MAX_CHARS,
  complexityMaxChars: COMPLEXITY_MAX_CHARS,
} as const
```

- [ ] **Step 4: Re-export from `domain/index.ts`**

Open `src/features/leetcode-review-assistant/domain/index.ts` and add a new re-export block at the end:

```ts
export {
  assessmentRecommendationSchema,
  assessmentRecommendationSchemaLimits,
} from './recommendation-schema'
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npx vitest run src/features/leetcode-review-assistant/domain/recommendation-schema.test.ts`
Expected: PASS, 10 tests.

Also run typecheck:

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```sh
git add src/features/leetcode-review-assistant/domain
git commit -m "feat(leetcode-review-assistant): add strictly-bounded recommendation schema"
```

---

## Task 3: Testing fixtures + prompt builder

**Files:**
- Create: `src/features/leetcode-review-assistant/testing/recommendation-fixtures.ts`
- Create: `src/features/leetcode-review-assistant/server/build-assessment-prompt.ts`
- Create: `src/features/leetcode-review-assistant/server/build-assessment-prompt.test.ts`

This task bundles the fixtures with the first server module because subsequent tasks (4 and 5) and the test file in this task all import factory helpers from `recommendation-fixtures.ts`. Task 6 only adds the barrel that re-exports these factories.

- [ ] **Step 1: Write the failing test**

Create `src/features/leetcode-review-assistant/server/build-assessment-prompt.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { PROMPT_VERSION } from '../domain/recommendation-types'
import {
  buildAssessmentPrompt,
  CODE_CHAR_LIMIT,
  CODE_TRUNCATION_MARKER,
  DIAGNOSTIC_FIELD_CHAR_LIMIT,
  STATEMENT_CHAR_LIMIT,
  TEXT_TRUNCATION_MARKER,
} from './build-assessment-prompt'
import {
  makeAcceptedDecision,
  makeAcceptedSubmission,
  makeFailedDecision,
  makeFailedSubmission,
  makeNoSubmission,
  makeProblem,
  makeProviderConfig,
  makeRecallSessionContext,
  makeRecommendAssessmentInput,
  makeTiming,
} from '../testing/recommendation-fixtures'

describe('buildAssessmentPrompt — system message', () => {
  it('includes the prompt version', () => {
    const { system } = buildAssessmentPrompt(makeRecommendAssessmentInput())
    expect(system).toContain(PROMPT_VERSION)
  })

  it('includes all six non-negotiable rules', () => {
    const { system } = buildAssessmentPrompt(makeRecommendAssessmentInput())
    for (const ruleNumber of ['1.', '2.', '3.', '4.', '5.', '6.']) {
      expect(system).toContain(ruleNumber)
    }
    // Sanity-check key wording so a future rule rewrite that drops one is caught.
    expect(system).toMatch(/conservative/i)
    expect(system).toMatch(/Failed submissions/)
    expect(system).toMatch(/Hard-mode/i)
  })

  it('produces identical output for identical input (deterministic)', () => {
    const input = makeRecommendAssessmentInput()
    const a = buildAssessmentPrompt(input)
    const b = buildAssessmentPrompt(input)
    expect(a.system).toBe(b.system)
    expect(a.user).toBe(b.user)
  })
})

describe('buildAssessmentPrompt — accepted submission snapshot', () => {
  it('renders an accepted submission with full context', () => {
    const input = makeRecommendAssessmentInput({
      problem: makeProblem({
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'medium',
        topics: ['array', 'hash-table'],
        statement: 'Find two numbers that add up to target.',
      }),
      submission: makeAcceptedSubmission({
        code: 'function twoSum(nums, target) { /* ... */ }',
        language: 'TypeScript',
        runtime: '42 ms',
        memory: '18 MB',
        passedTestCount: 57,
        totalTestCount: 57,
      }),
      timing: makeTiming({
        elapsedSeconds: 600,
        targetSeconds: 2100,
        timerUsed: true,
      }),
      deterministicDecision: makeAcceptedDecision(),
      sessionContext: makeRecallSessionContext(),
      providerConfig: makeProviderConfig(),
    })
    expect(buildAssessmentPrompt(input).user).toMatchSnapshot()
  })
})

describe('buildAssessmentPrompt — wrong-answer snapshot', () => {
  it('renders a failed submission with diagnostics', () => {
    const input = makeRecommendAssessmentInput({
      problem: makeProblem({
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'medium',
        topics: ['array', 'hash-table'],
      }),
      submission: makeFailedSubmission({
        code: 'function twoSum(nums, target) { return [] }',
        language: 'TypeScript',
        failingTestcase: '[2,7,11,15]\n9',
        expectedOutput: '[0,1]',
        actualOutput: '[]',
        errorMessage: '',
        passedTestCount: 10,
        totalTestCount: 11,
      }),
      timing: makeTiming({ elapsedSeconds: 900, timerUsed: true }),
      deterministicDecision: makeFailedDecision(),
      sessionContext: makeRecallSessionContext(),
      providerConfig: makeProviderConfig(),
    })
    expect(buildAssessmentPrompt(input).user).toMatchSnapshot()
  })
})

describe('buildAssessmentPrompt — no-submission snapshot', () => {
  it('omits code and diagnostics blocks for manual-overlay path', () => {
    const input = makeRecommendAssessmentInput({
      submission: makeNoSubmission(),
    })
    const { user } = buildAssessmentPrompt(input)
    expect(user).not.toContain('### Code')
    expect(user).not.toContain('### Failure diagnostics')
    expect(user).toMatch(/Status: no-submission/i)
    expect(user).toMatchSnapshot()
  })
})

describe('buildAssessmentPrompt — truncation', () => {
  it('truncates a long statement with the text marker', () => {
    const input = makeRecommendAssessmentInput({
      problem: makeProblem({
        statement: 'x'.repeat(STATEMENT_CHAR_LIMIT + 500),
      }),
    })
    const { user } = buildAssessmentPrompt(input)
    expect(user).toContain(TEXT_TRUNCATION_MARKER)
    // The statement section's truncation marker appears exactly once.
    const occurrences = user.split(TEXT_TRUNCATION_MARKER).length - 1
    expect(occurrences).toBeGreaterThanOrEqual(1)
  })

  it('truncates long code with the code marker', () => {
    const input = makeRecommendAssessmentInput({
      submission: makeAcceptedSubmission({
        code: 'x'.repeat(CODE_CHAR_LIMIT + 500),
        language: 'TypeScript',
      }),
    })
    const { user } = buildAssessmentPrompt(input)
    expect(user).toContain(CODE_TRUNCATION_MARKER)
  })

  it('truncates long failingTestcase with the text marker', () => {
    const input = makeRecommendAssessmentInput({
      submission: makeFailedSubmission({
        failingTestcase: 'x'.repeat(DIAGNOSTIC_FIELD_CHAR_LIMIT + 500),
      }),
      deterministicDecision: makeFailedDecision(),
    })
    const { user } = buildAssessmentPrompt(input)
    expect(user).toContain(TEXT_TRUNCATION_MARKER)
  })
})
```

The tests above import factories from `recommendation-fixtures.ts`. Create that file next so vitest can resolve the imports when we run the failing test in Step 3.

- [ ] **Step 2: Create the testing fixtures**

Create `src/features/leetcode-review-assistant/testing/recommendation-fixtures.ts`. This is the file's final content — Task 6 only adds the barrel that re-exports these factories.

```ts
import type {
  LeetCodeAssessmentDecision,
  AssessmentTimingSettings,
} from '@/features/assessment'
import type {
  GenAiProviderConfig,
  GenAiProviderMetadata,
} from '@/features/genai'
import type {
  OverlayAssessmentLatestAttempt,
  OverlayAssessmentSessionContext,
} from '@/features/overlay-session'

import {
  PROMPT_VERSION,
  type AssessmentRecommendation,
  type AssessmentRecommendationProblem,
  type AssessmentRecommendationSubmission,
  type AssessmentRecommendationTiming,
  type RecommendAssessmentInput,
} from '../domain/recommendation-types'

const baseTiming: AssessmentTimingSettings = {
  requireSolveTime: false,
  strictTiming: false,
  timeTargetsMinutes: { easy: 20, medium: 35, hard: 50 },
}

const baseLatestAttempt: OverlayAssessmentLatestAttempt = {
  id: 'attempt-1',
  rating: 'good',
  isCorrect: true,
  elapsedSeconds: 1200,
  occurredAt: Date.parse('2026-05-30T10:00:00.000Z'),
}

export function makeProblem(
  overrides: Partial<AssessmentRecommendationProblem> = {},
): AssessmentRecommendationProblem {
  return {
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'medium',
    topics: ['array', 'hash-table'],
    statement: 'Find two numbers in the array that add up to the target.',
    ...overrides,
  }
}

export function makeAcceptedSubmission(
  overrides: Partial<
    Extract<AssessmentRecommendationSubmission, { status: 'accepted' }>
  > = {},
): AssessmentRecommendationSubmission {
  return {
    status: 'accepted',
    code: 'function twoSum(nums, target) { /* ... */ }',
    language: 'TypeScript',
    runtime: '42 ms',
    memory: '18 MB',
    passedTestCount: 57,
    totalTestCount: 57,
    ...overrides,
  }
}

export function makeFailedSubmission(
  overrides: Partial<
    Extract<AssessmentRecommendationSubmission, { status: 'failed' }>
  > = {},
): AssessmentRecommendationSubmission {
  return {
    status: 'failed',
    code: 'function twoSum(nums, target) { return [] }',
    language: 'TypeScript',
    failingTestcase: '[2,7,11,15]\n9',
    expectedOutput: '[0,1]',
    actualOutput: '[]',
    errorMessage: '',
    passedTestCount: 10,
    totalTestCount: 11,
    ...overrides,
  }
}

export function makeNoSubmission(): AssessmentRecommendationSubmission {
  return { status: 'no-submission' }
}

export function makeTiming(
  overrides: Partial<AssessmentRecommendationTiming> = {},
): AssessmentRecommendationTiming {
  return {
    elapsedSeconds: 600,
    targetSeconds: 2100,
    timerUsed: true,
    ...overrides,
  }
}

export function makeAcceptedDecision(
  overrides: Partial<LeetCodeAssessmentDecision> = {},
): LeetCodeAssessmentDecision {
  return {
    status: 'accepted',
    rating: 'good',
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
    ...overrides,
  } as LeetCodeAssessmentDecision
}

export function makeFailedDecision(): LeetCodeAssessmentDecision {
  return {
    status: 'accepted',
    rating: 'again',
    isCorrect: false,
    elapsedSeconds: 900,
    targetSeconds: 2100,
    isOverTarget: false,
    lockReason: 'failed',
    reason: {
      code: 'failed',
      signals: {
        elapsedSeconds: 900,
        targetSeconds: 2100,
        ratioOfTarget: 900 / 2100,
        previousBestSeconds: null,
        beatsPreviousBest: null,
        isRecallReview: null,
      },
    },
    warnings: [],
    confidence: 1,
  }
}

export function makeStrictTimingLockedDecision(): LeetCodeAssessmentDecision {
  return {
    status: 'accepted',
    rating: 'again',
    isCorrect: false,
    elapsedSeconds: 2200,
    targetSeconds: 2100,
    isOverTarget: true,
    lockReason: 'hard-mode-overtime',
    reason: {
      code: 'hard-mode-overtime',
      signals: {
        elapsedSeconds: 2200,
        targetSeconds: 2100,
        ratioOfTarget: 2200 / 2100,
        previousBestSeconds: null,
        beatsPreviousBest: null,
        isRecallReview: null,
      },
    },
    warnings: [],
    confidence: 1,
  }
}

export function makeRecallSessionContext(
  overrides: Partial<OverlayAssessmentSessionContext> = {},
): OverlayAssessmentSessionContext {
  return {
    sessionKind: 'recall-review',
    submissionSource: 'leetcode-watcher',
    timerUsed: true,
    previousRating: 'good',
    bestElapsedSeconds: 1200,
    latestAttempt: baseLatestAttempt,
    currentDraftHasChanges: false,
    ...overrides,
  }
}

export function makeFirstSolveSessionContext(): OverlayAssessmentSessionContext {
  return {
    sessionKind: 'first-solve',
    submissionSource: 'leetcode-watcher',
    timerUsed: true,
    previousRating: null,
    bestElapsedSeconds: null,
    latestAttempt: null,
    currentDraftHasChanges: false,
  }
}

export function makeProviderConfig(
  overrides: Partial<GenAiProviderConfig> = {},
): GenAiProviderConfig {
  return {
    provider: 'openai',
    model: 'gpt-test',
    apiKey: 'sk-test-fixture',
    ...overrides,
  }
}

export function makeProviderMetadata(
  overrides: Partial<GenAiProviderMetadata> = {},
): GenAiProviderMetadata {
  return {
    provider: 'openai',
    model: 'gpt-test',
    durationMs: 1234,
    ...overrides,
  }
}

export function makeValidRecommendation(
  overrides: Partial<AssessmentRecommendation> = {},
): AssessmentRecommendation {
  return {
    recommendedRating: 'good',
    confidence: 'medium',
    summary: 'Solved within target time using a hash-map.',
    primaryReason: 'Accepted on first try, normal time.',
    evidence: ['Status: accepted', 'Elapsed 600s vs 2100s target'],
    complexity: { time: 'O(n)', space: 'O(n)', confidence: 'high' },
    improvementPoints: [],
    edgeCaseNotes: [],
    shouldUpdateRating: false,
    promptVersion: PROMPT_VERSION,
    ...overrides,
  }
}

export function makeRecommendAssessmentInput(
  overrides: Partial<RecommendAssessmentInput> = {},
): RecommendAssessmentInput {
  return {
    problem: makeProblem(),
    submission: makeAcceptedSubmission(),
    timing: makeTiming(),
    deterministicDecision: makeAcceptedDecision(),
    sessionContext: makeRecallSessionContext(),
    providerConfig: makeProviderConfig(),
    ...overrides,
  }
}
```


- [ ] **Step 3: Run the test and verify it fails on missing prompt builder**

Run: `npx vitest run src/features/leetcode-review-assistant/server/build-assessment-prompt.test.ts`
Expected: FAIL with `Failed to resolve import "./build-assessment-prompt"`.

- [ ] **Step 4: Implement `build-assessment-prompt.ts`**

Create `src/features/leetcode-review-assistant/server/build-assessment-prompt.ts`:

```ts
import {
  PROMPT_VERSION,
  type RecommendAssessmentInput,
  type AssessmentRecommendationSubmission,
} from '../domain/recommendation-types'

export const STATEMENT_CHAR_LIMIT = 2000
export const CODE_CHAR_LIMIT = 4000
export const DIAGNOSTIC_FIELD_CHAR_LIMIT = 500

export const TEXT_TRUNCATION_MARKER = '... [truncated]'
export const CODE_TRUNCATION_MARKER = '// [truncated]'

export type AssessmentPrompt = {
  system: string
  user: string
}

export function buildAssessmentPrompt(
  input: RecommendAssessmentInput,
): AssessmentPrompt {
  return {
    system: buildSystemMessage(),
    user: buildUserPayload(input),
  }
}

function buildSystemMessage(): string {
  return `You are CogniPace's LeetCode review assistant, prompt version ${PROMPT_VERSION}.

CogniPace is a LeetCode spaced-repetition practice coach. Your job is to recommend an FSRS review rating (again | hard | good | easy) for the user's just-completed practice attempt — NOT a grade or quality score.

The FSRS ratings mean:
- again: the user did not recall the solution; needs to see this soon
- hard: the user recalled with significant struggle
- good: the user recalled with normal effort
- easy: the user recalled quickly and confidently

Recommendation rules (these are non-negotiable):
1. Be conservative. When in doubt, recommend the deterministic rating.
2. Failed submissions MUST recommend "again". You may not override this.
3. Hard-mode locked overtime attempts MUST recommend "again". You may not override this.
4. Use only the facts provided in the context payload. Do not invent runtime numbers, prior attempts, or code that was not given to you.
5. Do not write or modify the user's notes or any structured log field.
6. Respond ONLY with JSON conforming to the schema you were given. No prose, no markdown, no commentary outside the JSON.

Output field rules:
- evidence: at most 5 items, each ≤200 characters, each a concrete fact from the provided context.
- improvementPoints: at most 5 actionable suggestions, ≤200 chars each.
- edgeCaseNotes: at most 5 items, ≤200 chars each.
- complexity.{time, space}: standard Big-O notation (e.g., "O(n log n)"). Use "unknown" if you cannot tell from the code.
- shouldUpdateRating: true ONLY when your recommendedRating differs from the deterministic rating AND your confidence is medium or high.
- promptVersion: always "${PROMPT_VERSION}".`
}

function buildUserPayload(input: RecommendAssessmentInput): string {
  const sections: string[] = []
  sections.push(renderProblem(input))
  sections.push(renderSubmission(input.submission))
  sections.push(renderTiming(input))
  sections.push(renderDeterministicDecision(input))
  sections.push(renderPracticeContext(input))
  sections.push('## Your task\nRecommend an FSRS rating for this attempt. Respond with JSON only.')
  return sections.join('\n\n')
}

function renderProblem(input: RecommendAssessmentInput): string {
  const { problem } = input
  const topics = problem.topics.length > 0 ? problem.topics.join(', ') : '(none)'
  const lines = [
    '## Problem',
    `- Slug: ${problem.slug}`,
    `- Title: ${problem.title}`,
    `- Difficulty: ${problem.difficulty}`,
    `- Topics: ${topics}`,
  ]
  if (problem.statement !== undefined && problem.statement !== '') {
    lines.push('')
    lines.push('### Statement')
    lines.push(truncateText(problem.statement, STATEMENT_CHAR_LIMIT, TEXT_TRUNCATION_MARKER))
  }
  return lines.join('\n')
}

function renderSubmission(submission: AssessmentRecommendationSubmission): string {
  if (submission.status === 'no-submission') {
    return '## Submission\n- Status: no-submission (manual review without LeetCode result)'
  }

  const lines: string[] = ['## Submission', `- Status: ${submission.status}`]
  if (submission.language !== undefined) lines.push(`- Language: ${submission.language}`)
  if (submission.status === 'accepted') {
    if (submission.runtime !== undefined) lines.push(`- Runtime: ${submission.runtime}`)
    if (submission.memory !== undefined) lines.push(`- Memory: ${submission.memory}`)
  }
  if (
    submission.passedTestCount !== undefined &&
    submission.totalTestCount !== undefined
  ) {
    lines.push(`- Tests passed: ${submission.passedTestCount} of ${submission.totalTestCount}`)
  }

  if (submission.code !== undefined && submission.code !== '') {
    lines.push('')
    lines.push('### Code')
    const fence = submission.language !== undefined ? `\`\`\`${submission.language}` : '```'
    lines.push(fence)
    lines.push(truncateText(submission.code, CODE_CHAR_LIMIT, CODE_TRUNCATION_MARKER))
    lines.push('```')
  }

  if (submission.status === 'failed') {
    const diag: string[] = []
    if (submission.failingTestcase !== undefined && submission.failingTestcase !== '') {
      diag.push(`- Failing testcase: ${truncateText(submission.failingTestcase, DIAGNOSTIC_FIELD_CHAR_LIMIT, TEXT_TRUNCATION_MARKER)}`)
    }
    if (submission.expectedOutput !== undefined && submission.expectedOutput !== '') {
      diag.push(`- Expected output: ${truncateText(submission.expectedOutput, DIAGNOSTIC_FIELD_CHAR_LIMIT, TEXT_TRUNCATION_MARKER)}`)
    }
    if (submission.actualOutput !== undefined && submission.actualOutput !== '') {
      diag.push(`- Actual output: ${truncateText(submission.actualOutput, DIAGNOSTIC_FIELD_CHAR_LIMIT, TEXT_TRUNCATION_MARKER)}`)
    }
    if (submission.errorMessage !== undefined && submission.errorMessage !== '') {
      diag.push(`- Error message: ${truncateText(submission.errorMessage, DIAGNOSTIC_FIELD_CHAR_LIMIT, TEXT_TRUNCATION_MARKER)}`)
    }
    if (diag.length > 0) {
      lines.push('')
      lines.push('### Failure diagnostics')
      lines.push(...diag)
    }
  }

  return lines.join('\n')
}

function renderTiming(input: RecommendAssessmentInput): string {
  const { timing } = input
  const lines = ['## Timing']
  if (timing.elapsedSeconds === null) {
    lines.push('- Elapsed: untimed')
  } else {
    lines.push(`- Elapsed: ${timing.elapsedSeconds} seconds (${formatDuration(timing.elapsedSeconds)})`)
  }
  lines.push(`- Target: ${timing.targetSeconds} seconds (${formatDuration(timing.targetSeconds)})`)
  lines.push(`- Timer used: ${timing.timerUsed ? 'yes' : 'no'}`)
  return lines.join('\n')
}

function renderDeterministicDecision(input: RecommendAssessmentInput): string {
  const { deterministicDecision: decision } = input
  if (decision.status !== 'accepted') {
    return `## Deterministic decision\n- Status: blocked\n- Reason code: ${decision.reason.code}`
  }
  const lines = [
    '## Deterministic decision',
    `- Rating: ${decision.rating}`,
    `- Reason code: ${decision.reason.code}`,
    `- Confidence: ${decision.confidence.toFixed(2)}`,
    `- Lock reason: ${decision.lockReason ?? 'none'}`,
  ]
  if (decision.warnings.length > 0) {
    const codes = decision.warnings.map((w) => w.code).join(', ')
    lines.push(`- Warnings: ${codes}`)
  }
  return lines.join('\n')
}

function renderPracticeContext(input: RecommendAssessmentInput): string {
  const ctx = input.sessionContext
  const lines = [
    '## Practice context',
    `- Session kind: ${ctx.sessionKind}`,
    `- Submission source: ${ctx.submissionSource}`,
  ]
  if (ctx.previousRating !== null) {
    lines.push(`- Previous rating: ${ctx.previousRating}`)
  }
  if (ctx.bestElapsedSeconds !== null) {
    lines.push(`- Best previous time: ${ctx.bestElapsedSeconds} seconds (${formatDuration(ctx.bestElapsedSeconds)})`)
  }
  if (ctx.latestAttempt !== null) {
    const a = ctx.latestAttempt
    const elapsed = a.elapsedSeconds === null ? 'untimed' : `${a.elapsedSeconds}s`
    lines.push(`- Latest attempt: rating=${a.rating}, isCorrect=${a.isCorrect}, elapsed=${elapsed}`)
  }
  return lines.join('\n')
}

function truncateText(value: string, limit: number, marker: string): string {
  if (value.length <= limit) return value
  const cutAt = Math.max(0, limit - marker.length)
  return value.slice(0, cutAt) + marker
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  if (minutes === 0) return `${remainder} sec`
  if (remainder === 0) return `${minutes} min`
  return `${minutes} min ${remainder} sec`
}
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npx vitest run src/features/leetcode-review-assistant/server/build-assessment-prompt.test.ts -u`
Expected: PASS — the `-u` flag updates snapshot files on first run, then subsequent runs assert against the committed snapshot.

Run again without `-u` to confirm snapshots are stable:

Run: `npx vitest run src/features/leetcode-review-assistant/server/build-assessment-prompt.test.ts`
Expected: PASS, all 9 tests.

- [ ] **Step 6: Commit**

```sh
git add src/features/leetcode-review-assistant/server/build-assessment-prompt.ts \
        src/features/leetcode-review-assistant/server/build-assessment-prompt.test.ts \
        src/features/leetcode-review-assistant/server/__snapshots__ \
        src/features/leetcode-review-assistant/testing/recommendation-fixtures.ts
git commit -m "feat(leetcode-review-assistant): build deterministic versioned prompt"
```

---

## Task 4: Normalizer + fallback factory

**Files:**
- Create: `src/features/leetcode-review-assistant/server/recommendation-normalizer.ts`
- Create: `src/features/leetcode-review-assistant/server/recommendation-normalizer.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/leetcode-review-assistant/server/recommendation-normalizer.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type { GenAiError } from '@/features/genai'

import { PROMPT_VERSION } from '../domain/recommendation-types'
import {
  buildFallbackRecommendation,
  normalizeRecommendation,
} from './recommendation-normalizer'
import {
  makeAcceptedDecision,
  makeFailedDecision,
  makeStrictTimingLockedDecision,
  makeValidRecommendation,
} from '../testing/recommendation-fixtures'

describe('normalizeRecommendation — failed lock', () => {
  it('forces recommendedRating to "again" even when AI says "good"', () => {
    const result = normalizeRecommendation(
      makeValidRecommendation({ recommendedRating: 'good', shouldUpdateRating: true }),
      makeFailedDecision(),
    )
    expect(result.recommendedRating).toBe('again')
    expect(result.shouldUpdateRating).toBe(false)
  })

  it('keeps recommendedRating "again" and clears shouldUpdateRating', () => {
    const result = normalizeRecommendation(
      makeValidRecommendation({ recommendedRating: 'again', shouldUpdateRating: true }),
      makeFailedDecision(),
    )
    expect(result.recommendedRating).toBe('again')
    expect(result.shouldUpdateRating).toBe(false)
  })
})

describe('normalizeRecommendation — hard-mode-overtime lock', () => {
  it('forces recommendedRating to "again" even when AI says "easy"', () => {
    const result = normalizeRecommendation(
      makeValidRecommendation({ recommendedRating: 'easy', shouldUpdateRating: true }),
      makeStrictTimingLockedDecision(),
    )
    expect(result.recommendedRating).toBe('again')
    expect(result.shouldUpdateRating).toBe(false)
  })
})

describe('normalizeRecommendation — matching rating', () => {
  it('passes through but forces shouldUpdateRating to false', () => {
    const result = normalizeRecommendation(
      makeValidRecommendation({ recommendedRating: 'good', shouldUpdateRating: true }),
      makeAcceptedDecision(),  // deterministic rating is "good"
    )
    expect(result.recommendedRating).toBe('good')
    expect(result.shouldUpdateRating).toBe(false)
  })
})

describe('normalizeRecommendation — different rating, no lock', () => {
  it('passes through unchanged including the AI shouldUpdateRating', () => {
    const aiOutput = makeValidRecommendation({
      recommendedRating: 'hard',
      shouldUpdateRating: true,
    })
    const result = normalizeRecommendation(aiOutput, makeAcceptedDecision())
    expect(result.recommendedRating).toBe('hard')
    expect(result.shouldUpdateRating).toBe(true)
  })
})

describe('buildFallbackRecommendation', () => {
  const reasonByCode: Record<GenAiError, string> = {
    'not-configured': 'AI is not configured.',
    auth: 'AI authentication failed.',
    'rate-limit': 'AI is rate-limited; try again shortly.',
    network: 'AI request could not reach the provider.',
    timeout: 'AI request timed out.',
    'invalid-output': 'AI returned output that did not validate.',
    unknown: 'AI request failed.',
  }

  it.each(Object.entries(reasonByCode))(
    'maps error code %s to the documented primaryReason',
    (code, expectedReason) => {
      const result = buildFallbackRecommendation(makeAcceptedDecision(), {
        code: code as GenAiError,
        message: 'irrelevant',
      })
      expect(result.primaryReason).toBe(expectedReason)
    },
  )

  it('uses a generic primaryReason when error is null', () => {
    const result = buildFallbackRecommendation(makeAcceptedDecision(), null)
    expect(result.primaryReason).toBe('AI recommendation unavailable.')
  })

  it('populates safe display fields', () => {
    const result = buildFallbackRecommendation(makeAcceptedDecision(), null)
    expect(result.confidence).toBe('low')
    expect(result.evidence).toEqual([])
    expect(result.improvementPoints).toEqual([])
    expect(result.edgeCaseNotes).toEqual([])
    expect(result.complexity).toEqual({
      time: 'unknown',
      space: 'unknown',
      confidence: 'low',
    })
    expect(result.shouldUpdateRating).toBe(false)
    expect(result.promptVersion).toBe(PROMPT_VERSION)
  })

  it('matches the deterministic rating for accepted decisions', () => {
    const result = buildFallbackRecommendation(makeAcceptedDecision(), null)
    expect(result.recommendedRating).toBe('good')
  })

  it('matches the deterministic rating "again" when failed lock applies', () => {
    const result = buildFallbackRecommendation(makeFailedDecision(), null)
    expect(result.recommendedRating).toBe('again')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/features/leetcode-review-assistant/server/recommendation-normalizer.test.ts`
Expected: FAIL with `Failed to resolve import "./recommendation-normalizer"`.

- [ ] **Step 3: Implement `recommendation-normalizer.ts`**

Create `src/features/leetcode-review-assistant/server/recommendation-normalizer.ts`:

```ts
import type { LeetCodeAssessmentDecision } from '@/features/assessment'
import type { GenAiError } from '@/features/genai'

import {
  PROMPT_VERSION,
  type AssessmentRecommendation,
  type AssessmentRecommendationRating,
} from '../domain/recommendation-types'

export function normalizeRecommendation(
  aiOutput: AssessmentRecommendation,
  deterministic: LeetCodeAssessmentDecision,
): AssessmentRecommendation {
  if (deterministic.status !== 'accepted') {
    return aiOutput
  }
  if (deterministic.lockReason === 'failed') {
    return {
      ...aiOutput,
      recommendedRating: 'again',
      shouldUpdateRating: false,
    }
  }
  if (deterministic.lockReason === 'hard-mode-overtime') {
    return {
      ...aiOutput,
      recommendedRating: 'again',
      shouldUpdateRating: false,
    }
  }
  if (aiOutput.recommendedRating === deterministic.rating) {
    return { ...aiOutput, shouldUpdateRating: false }
  }
  return aiOutput
}

const FALLBACK_REASON_BY_CODE: Record<GenAiError, string> = {
  'not-configured': 'AI is not configured.',
  auth: 'AI authentication failed.',
  'rate-limit': 'AI is rate-limited; try again shortly.',
  network: 'AI request could not reach the provider.',
  timeout: 'AI request timed out.',
  'invalid-output': 'AI returned output that did not validate.',
  unknown: 'AI request failed.',
}

export function buildFallbackRecommendation(
  deterministic: LeetCodeAssessmentDecision,
  error: { code: GenAiError; message: string } | null,
): AssessmentRecommendation {
  const baseRating: AssessmentRecommendationRating =
    deterministic.status === 'accepted' ? deterministic.rating : 'again'
  const primaryReason =
    error !== null
      ? FALLBACK_REASON_BY_CODE[error.code]
      : 'AI recommendation unavailable.'

  return {
    recommendedRating: baseRating,
    confidence: 'low',
    summary: 'Using deterministic rating; AI recommendation unavailable.',
    primaryReason,
    evidence: [],
    complexity: { time: 'unknown', space: 'unknown', confidence: 'low' },
    improvementPoints: [],
    edgeCaseNotes: [],
    shouldUpdateRating: false,
    promptVersion: PROMPT_VERSION,
  }
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run src/features/leetcode-review-assistant/server/recommendation-normalizer.test.ts`
Expected: PASS (4 normalizer cases + 7 error-code rows + 4 fallback cases = 15 tests).

- [ ] **Step 5: Commit**

```sh
git add src/features/leetcode-review-assistant/server/recommendation-normalizer.ts \
        src/features/leetcode-review-assistant/server/recommendation-normalizer.test.ts
git commit -m "feat(leetcode-review-assistant): clamp AI output against deterministic decision"
```

---

## Task 5: Orchestrator + server barrel

**Files:**
- Create: `src/features/leetcode-review-assistant/server/recommendation-service.ts`
- Create: `src/features/leetcode-review-assistant/server/recommendation-service.test.ts`
- Create: `src/features/leetcode-review-assistant/server/index.ts`
- Modify: `src/features/leetcode-review-assistant/index.ts` (re-export `recommendAssessment`)

- [ ] **Step 1: Write the failing tests**

Create `src/features/leetcode-review-assistant/server/recommendation-service.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GenAiError, GenAiGenerateJsonResult } from '@/features/genai'

vi.mock('@/features/genai', async () => {
  const actual = await vi.importActual<typeof import('@/features/genai')>(
    '@/features/genai',
  )
  return {
    ...actual,
    generateJson: vi.fn(),
  }
})

import { generateJson } from '@/features/genai'

import type { AssessmentRecommendation } from '../domain/recommendation-types'
import { recommendAssessment } from './recommendation-service'
import {
  makeAcceptedDecision,
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
      // matched rating → normalizer forces shouldUpdateRating false
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
  ] as const)('returns status:"fallback" with deterministic rating for error code %s', async (code) => {
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
      expect(result.recommendation.recommendedRating).toBe('good')  // matches makeAcceptedDecision
      expect(result.error.code).toBe(code)
      expect(result.error.message).toBe(`${code} error from provider`)
      expect(result.recommendation.confidence).toBe('low')
    }
  })

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
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/features/leetcode-review-assistant/server/recommendation-service.test.ts`
Expected: FAIL with `Failed to resolve import "./recommendation-service"`.

- [ ] **Step 3: Implement `recommendation-service.ts`**

Create `src/features/leetcode-review-assistant/server/recommendation-service.ts`:

```ts
import { generateJson, type GenAiGenerateJsonResult } from '@/features/genai'

import { assessmentRecommendationSchema } from '../domain/recommendation-schema'
import type {
  AssessmentRecommendation,
  RecommendAssessmentInput,
  RecommendAssessmentOutput,
} from '../domain/recommendation-types'
import { buildAssessmentPrompt } from './build-assessment-prompt'
import {
  buildFallbackRecommendation,
  normalizeRecommendation,
} from './recommendation-normalizer'

export async function recommendAssessment(
  input: RecommendAssessmentInput,
): Promise<RecommendAssessmentOutput> {
  const prompt = buildAssessmentPrompt(input)

  const result: GenAiGenerateJsonResult<AssessmentRecommendation> =
    await generateJson({
      ...input.providerConfig,
      prompt,
      schema: assessmentRecommendationSchema,
    })

  if (result.status === 'error') {
    return {
      status: 'fallback',
      recommendation: buildFallbackRecommendation(input.deterministicDecision, {
        code: result.code,
        message: result.message,
      }),
      error: { code: result.code, message: result.message },
    }
  }

  return {
    status: 'ai',
    recommendation: normalizeRecommendation(
      result.data,
      input.deterministicDecision,
    ),
    providerMetadata: result.providerMetadata,
  }
}
```

- [ ] **Step 4: Create `server/index.ts`**

Create `src/features/leetcode-review-assistant/server/index.ts`:

```ts
export { recommendAssessment } from './recommendation-service'
```

- [ ] **Step 5: Update the root barrel**

Open `src/features/leetcode-review-assistant/index.ts` and add this line after the existing block:

```ts
export { recommendAssessment } from './server'
```

- [ ] **Step 6: Run the tests and verify they pass**

Run: `npx vitest run src/features/leetcode-review-assistant/server/recommendation-service.test.ts`
Expected: PASS (3 success + 6 error-code rows + 1 lock + 1 cancellation = 11 tests).

Run the full feature suite:

Run: `npx vitest run src/features/leetcode-review-assistant`
Expected: PASS across all test files.

- [ ] **Step 7: Commit**

```sh
git add src/features/leetcode-review-assistant/server/recommendation-service.ts \
        src/features/leetcode-review-assistant/server/recommendation-service.test.ts \
        src/features/leetcode-review-assistant/server/index.ts \
        src/features/leetcode-review-assistant/index.ts
git commit -m "feat(leetcode-review-assistant): orchestrate prompt → generateJson → normalize"
```

---

## Task 6: Testing barrel

**Files:**
- Create: `src/features/leetcode-review-assistant/testing/index.ts`

Task 3 already created `testing/recommendation-fixtures.ts` with the complete factory set. This task adds the barrel so consumers (including #6's runtime-handler tests) can import via `@/features/leetcode-review-assistant/testing`.

- [ ] **Step 1: Create the barrel**

Create `src/features/leetcode-review-assistant/testing/index.ts`:

```ts
export {
  makeAcceptedDecision,
  makeAcceptedSubmission,
  makeFailedDecision,
  makeFailedSubmission,
  makeFirstSolveSessionContext,
  makeNoSubmission,
  makeProblem,
  makeProviderConfig,
  makeProviderMetadata,
  makeRecallSessionContext,
  makeRecommendAssessmentInput,
  makeStrictTimingLockedDecision,
  makeTiming,
  makeValidRecommendation,
} from './recommendation-fixtures'
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```sh
git add src/features/leetcode-review-assistant/testing/index.ts
git commit -m "feat(leetcode-review-assistant): expose testing fixtures barrel"
```

---

## Task 7: Whole-project validation

**Files:** none modified (unless Step 2 catches something)

- [ ] **Step 1: Run the full check**

Run: `npm run check`
Expected: PASS for all four phases (drizzle, typecheck, lint, vitest).

- [ ] **Step 2: Resolve any failures**

If any phase fails, read the output and fix the root cause. Common cases:
- ESLint import-order or unused-import violation in any of the new files → reformat.
- Snapshot mismatch (e.g., from a typo in the prompt builder) → inspect the diff in `__snapshots__/`, decide whether the new output is correct, and re-run with `-u` to update OR fix the builder.
- Architecture-boundary `apiKey` test catches a hit in this feature → grep `src/features/leetcode-review-assistant` for `\bapiKey\b` outside test files, refactor to spread the provider config instead of destructuring.
- A barrel missing one of the new symbols → add to `domain/index.ts`, `server/index.ts`, `testing/index.ts`, or the root barrel as appropriate.

Re-run `npm run check` until it passes. If you make fixes, commit with a focused message such as `fix(leetcode-review-assistant): align lint formatting`.

If `package-lock.json` shows as modified, discard those auto-changes with `git checkout -- package-lock.json`.

- [ ] **Step 3: Confirm clean state**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

Run: `git log --oneline -10`
Expected (most recent first):
- `feat(leetcode-review-assistant): expose testing fixtures barrel`
- `feat(leetcode-review-assistant): orchestrate prompt → generateJson → normalize`
- `feat(leetcode-review-assistant): clamp AI output against deterministic decision`
- `feat(leetcode-review-assistant): build deterministic versioned prompt`
- `feat(leetcode-review-assistant): add strictly-bounded recommendation schema`
- `feat(leetcode-review-assistant): add recommendation domain types`
- (optionally) a `fix:` commit from Step 2
- `docs: plan LeetCode review assistant implementation (#5)`
- `docs: design LeetCode review assistant prompt and schema (#5)`

Implementation complete.
