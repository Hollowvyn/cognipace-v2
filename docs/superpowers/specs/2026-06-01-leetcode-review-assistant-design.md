# LeetCode Review Assistant Implementation Design

## Status

Approved design from brainstorming on 2026-06-01. This is a planning artifact
for issue #5 (Build LeetCode review assistant prompt and schema). Third of
four specs in the GenAI plumbing cluster (#3, #4, #5, #6); #3 and #4 have
shipped (`features/genai/` with `generateJson`, `loadActiveProviderConfig`,
secrets store, settings UI). Current product and architecture docs remain the
source of truth until the implementation lands.

## Context

Issues #1, #2, #3, #4 are all merged. The deterministic policy returns a
typed `LeetCodeAssessmentDecision` with confidence, warnings, and structured
reason; the overlay session context exposes `OverlayAssessmentSessionContext`
with submission source, practice context, and timer state; `generateJson`
returns validated JSON from any of three providers; `loadActiveProviderConfig`
composes settings + secrets into a `GenAiProviderConfig | null`.

This issue (#5) builds the LeetCode-specific recommendation layer that sits
between the deterministic decision and the AI provider — a feature folder at
`src/features/leetcode-review-assistant/` exporting one async function:
`recommendAssessment(input): Promise<RecommendAssessmentOutput>`. The
function builds a versioned prompt, calls `generateJson` with the strict
output schema, normalizes the AI's response against the deterministic
constraints, and returns a tagged outcome so callers can distinguish
AI-backed recommendations from fallbacks.

The next issue (#6) wires this function into a content-script-callable
runtime endpoint, loading the provider config via #4's loader and broadcasting
the recommendation to the overlay.

## Decisions

- One feature folder: `src/features/leetcode-review-assistant/`. Three
  subfolders: `domain/` (types + Zod schema), `server/` (pure prompt builder,
  pure normalizer, async orchestrator), `testing/` (fixture factories).
- One public entrypoint: `recommendAssessment(input)` exported from
  `server/recommendation-service.ts` and re-exported through the feature
  barrel. No factory, no class.
- The input is composed from existing types: `RecommendAssessmentInput`
  embeds `LeetCodeAssessmentDecision` (#1), `OverlayAssessmentSessionContext`
  (#2), and `GenAiProviderConfig` (#3) directly. Zero adapter shim at the
  caller (#6) boundary.
- The return is a tagged outcome:
  `{ status: 'ai', recommendation, providerMetadata }` or
  `{ status: 'fallback', recommendation, error }`. The recommendation field
  is always populated; consumers can render uniformly while learning whether
  the AI succeeded.
- Prompt version is a single exported constant `PROMPT_VERSION =
  'leetcode-assessment-v1'`. The version is embedded in the system message
  and in the output `promptVersion` field; Zod's `z.literal(PROMPT_VERSION)`
  rejects mismatches so version drift triggers the fallback path.
- Length budgets are named, exported constants:
  `STATEMENT_CHAR_LIMIT = 2000`, `CODE_CHAR_LIMIT = 4000`,
  `DIAGNOSTIC_FIELD_CHAR_LIMIT = 500`. Truncation appends documented markers
  (`'... [truncated]'` for text, `'// [truncated]'` for code).
- Schema bounds every field: arrays ≤5 items, short-text fields ≤200 chars,
  complexity fields ≤80 chars. `.strict()` at every object level.
- Normalizer rules, in order:
  1. `deterministic.lockReason === 'failed'` → force
     `recommendedRating: 'again'`, `shouldUpdateRating: false`.
  2. `deterministic.lockReason === 'hard-mode-overtime'` → force
     `recommendedRating: 'again'`, `shouldUpdateRating: false`.
  3. AI's `recommendedRating === deterministic.rating` → force
     `shouldUpdateRating: false`.
  4. Otherwise pass through AI output unchanged.
- Fallback recommendation factory (`buildFallbackRecommendation(decision,
  error?)`): `recommendedRating` matches the deterministic rating (or
  `'again'` for blocked decisions), `confidence: 'low'`, all arrays empty,
  complexity all `'unknown'`, `shouldUpdateRating: false`,
  `promptVersion: PROMPT_VERSION`. `primaryReason` maps the `GenAiError` code
  to a fixed human-readable phrase.
- The `apiKey` literal never appears under
  `src/features/leetcode-review-assistant/`. The orchestrator passes
  `input.providerConfig` to `generateJson` by spread, never destructuring
  `.apiKey`. Architecture-boundary test from #4 stays clean.
- Caller-cancellation (`AbortError` from `generateJson`) is re-raised; #6's
  runtime endpoint is the right layer to translate cancellation into its own
  response.

## Goals

- Give #6 a single typed function that takes everything it already has and
  returns a recommendation ready for the overlay (whether AI succeeded or
  not).
- Produce deterministic prompts so prompt-engineering iteration is grounded
  in snapshot tests, not coincidence.
- Force every AI response through the same Zod schema + normalizer so the
  overlay never sees a recommendation that violates the deterministic safety
  rules (failed → again, hard-mode lock → again).
- Keep the prompt and schema versioned so future iterations can rev them
  independently of code structure.

## Non-Goals

- No runtime endpoint, sender-policy plumbing, or messaging entries — that is
  #6.
- No overlay UI consumption — that is #7 / #8.
- No session-only AI notes guardrails — that is #9.
- No persistent storage of AI output. The recommendation is computed
  on-demand per call; `features/leetcode-review-assistant/` does not touch
  the DB.
- No retries on AI errors (`#3`'s explicit non-goal; #6 may add retry policy
  later).
- No streaming responses. `generateJson` is single-shot.
- No prompt-template editor UI. The prompt is hand-written in TypeScript
  source.

## File Layout

```
src/features/leetcode-review-assistant/
  domain/
    recommendation-types.ts        // PROMPT_VERSION, input/output types, enums
    recommendation-schema.ts       // assessmentRecommendationSchema (Zod)
    recommendation-schema.test.ts
    index.ts                       // barrel
  server/
    build-assessment-prompt.ts     // pure prompt builder + length constants
    build-assessment-prompt.test.ts
    recommendation-normalizer.ts   // pure normalizer + fallback factory
    recommendation-normalizer.test.ts
    recommendation-service.ts      // orchestrator
    recommendation-service.test.ts
    index.ts                       // re-exports recommendAssessment + types
  testing/
    recommendation-fixtures.ts
    index.ts
  index.ts                         // feature barrel
```

The orchestrator filename is `recommendation-service.ts` (not the issue's
suggested `recommend-assessment.ts`) so it matches the architecture-boundary
test's `server/*service` deep-import allowlist; #6 can import via
`@/features/leetcode-review-assistant/server/recommendation-service` without
tripping the boundary.

## Public Contracts

`src/features/leetcode-review-assistant/domain/recommendation-types.ts`:

```ts
import type {
  GenAiError,
  GenAiProviderConfig,
  GenAiProviderMetadata,
} from '@/features/genai'
import type { LeetCodeAssessmentDecision } from '@/features/assessment'
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

The submission tag `'no-submission'` covers manual-overlay and
collapsed-quick paths where there is no LeetCode-watcher submission record.
The prompt builder omits the code and diagnostics blocks for that variant.

## Output Schema

`src/features/leetcode-review-assistant/domain/recommendation-schema.ts`:

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

The `satisfies z.ZodType<AssessmentRecommendation>` at the bottom is a
compile-time cross-check between the Zod schema's inferred type and the
hand-written `AssessmentRecommendation` type. If they ever diverge,
TypeScript catches it at build time.

`assessmentRecommendationSchemaLimits` is exported so the prompt builder
references the same numbers in its instructions. Single source of truth.

## Prompt Builder

`src/features/leetcode-review-assistant/server/build-assessment-prompt.ts`:

```ts
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
): AssessmentPrompt
```

### System message (versioned, ~600 tokens)

```
You are CogniPace's LeetCode review assistant, prompt version leetcode-assessment-v1.

CogniPace is a LeetCode spaced-repetition practice coach. Your job is to
recommend an FSRS review rating (again | hard | good | easy) for the user's
just-completed practice attempt — NOT a grade or quality score.

The FSRS ratings mean:
- again: the user did not recall the solution; needs to see this soon
- hard: the user recalled with significant struggle
- good: the user recalled with normal effort
- easy: the user recalled quickly and confidently

Recommendation rules (these are non-negotiable):
1. Be conservative. When in doubt, recommend the deterministic rating.
2. Failed submissions MUST recommend "again". You may not override this.
3. Hard-mode locked overtime attempts MUST recommend "again". You may not
   override this.
4. Use only the facts provided in the context payload. Do not invent runtime
   numbers, prior attempts, or code that was not given to you.
5. Do not write or modify the user's notes or any structured log field.
6. Respond ONLY with JSON conforming to the schema you were given. No prose,
   no markdown, no commentary outside the JSON.

Output field rules:
- evidence: at most 5 items, each ≤200 characters, each a concrete fact from
  the provided context.
- improvementPoints: at most 5 actionable suggestions, ≤200 chars each.
- edgeCaseNotes: at most 5 items, ≤200 chars each.
- complexity.{time, space}: standard Big-O notation (e.g., "O(n log n)").
  Use "unknown" if you cannot tell from the code.
- shouldUpdateRating: true ONLY when your recommendedRating differs from the
  deterministic rating AND your confidence is medium or high.
- promptVersion: always "leetcode-assessment-v1".
```

### User payload (structured Markdown)

```
## Problem
- Slug: two-sum
- Title: Two Sum
- Difficulty: medium
- Topics: array, hash-table

### Statement
<truncated to STATEMENT_CHAR_LIMIT, with TEXT_TRUNCATION_MARKER if cut>

## Submission
- Status: accepted | failed | no-submission
- Language: TypeScript                              (omitted if none)
- Runtime: 42 ms                                    (omitted if none)
- Memory: 18 MB                                     (omitted if none)
- Tests passed: 57 of 57                            (omitted if none)

### Code                                            (omitted if no code)
```ts
<truncated to CODE_CHAR_LIMIT, with CODE_TRUNCATION_MARKER if cut>
```

### Failure diagnostics                             (only if status=failed)
- Failing testcase: <truncated to DIAGNOSTIC_FIELD_CHAR_LIMIT>
- Expected output: <truncated>
- Actual output:   <truncated>
- Error message:   <truncated>

## Timing
- Elapsed: 600 seconds (10 min 0 sec)              ("untimed" if elapsedSeconds null)
- Target: 2100 seconds (35 min)
- Timer used: yes | no

## Deterministic decision
- Rating: good
- Reason code: leetcode-good
- Confidence: 0.80
- Lock reason: none | failed | hard-mode-overtime
- Warnings: untimed, no-practice-context           (joined with comma, omitted if empty)

## Practice context
- Session kind: first-solve | recall-review
- Submission source: leetcode-watcher | manual-overlay | collapsed-quick
- Previous rating: good                            (omitted if null)
- Best previous time: 1200 seconds (20 min)        (omitted if null)
- Latest attempt: rating=hard, isCorrect=false, elapsed=900s  (omitted if null)

## Your task
Recommend an FSRS rating for this attempt. Respond with JSON only.
```

### Determinism

- The builder is a pure function: same input → same output. No `Date.now()`,
  no `Math.random()`, no environment reads.
- Field order is fixed. Optional fields collapse cleanly (no empty lines).
- Number formatting is fixed: raw seconds first, parenthetical
  human-readable second.
- System message is a single template-literal string. No conditional
  includes — if conditional system content is needed later, add it
  explicitly.

### Truncation

`truncateText(value, limit, marker)` helper: returns `value` as-is when
`value.length <= limit`; otherwise
`value.slice(0, limit - marker.length) + marker`. Both markers are exported
so tests can assert on them.

### `'no-submission'` handling

- Submission section omits `### Code` and `### Failure diagnostics` blocks.
- Status line reads `Status: no-submission (manual review without LeetCode result)`.

## Normalizer + Fallback Factory

`src/features/leetcode-review-assistant/server/recommendation-normalizer.ts`:

```ts
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

export function buildFallbackRecommendation(
  deterministic: LeetCodeAssessmentDecision,
  error: { code: GenAiError; message: string } | null,
): AssessmentRecommendation {
  const baseRating: AssessmentRecommendationRating =
    deterministic.status === 'accepted' ? deterministic.rating : 'again'

  const reasonByCode: Record<GenAiError, string> = {
    'not-configured': 'AI is not configured.',
    auth: 'AI authentication failed.',
    'rate-limit': 'AI is rate-limited; try again shortly.',
    network: 'AI request could not reach the provider.',
    timeout: 'AI request timed out.',
    'invalid-output': 'AI returned output that did not validate.',
    unknown: 'AI request failed.',
  }
  const primaryReason =
    error !== null
      ? reasonByCode[error.code]
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

The normalizer is pure and never throws. The fallback factory is pure and
deterministic. Together they guarantee the orchestrator can always return a
safe recommendation regardless of provider behavior.

## Orchestrator

`src/features/leetcode-review-assistant/server/recommendation-service.ts`:

```ts
import { generateJson, type GenAiGenerateJsonResult } from '@/features/genai'

import { assessmentRecommendationSchema } from '../domain/recommendation-schema'
import { buildAssessmentPrompt } from './build-assessment-prompt'
import {
  buildFallbackRecommendation,
  normalizeRecommendation,
} from './recommendation-normalizer'
import type {
  AssessmentRecommendation,
  RecommendAssessmentInput,
  RecommendAssessmentOutput,
} from '../domain/recommendation-types'

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
      recommendation: buildFallbackRecommendation(
        input.deterministicDecision,
        { code: result.code, message: result.message },
      ),
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

`generateJson` returns a tagged result and only throws on caller-cancellation
(`AbortError`); the orchestrator does not wrap it in try/catch. `AbortError`
propagates to #6's runtime endpoint, which translates cancellation into its
own response shape.

The `input.providerConfig` is spread into `generateJson`; the `apiKey`
literal never appears in this file. The architecture-boundary test from #4
stays clean.

## Testing Fixtures

`src/features/leetcode-review-assistant/testing/recommendation-fixtures.ts`
exports factory builders for every input type. The top-level builder is
`makeRecommendAssessmentInput(overrides?)`; specialized factories
(`makeProblem`, `makeAcceptedSubmission`, `makeFailedSubmission`,
`makeNoSubmission`, `makeTiming`, `makeAcceptedDecision`,
`makeFailedDecision`, `makeStrictTimingLockedDecision`,
`makeRecallSessionContext`, `makeFirstSolveSessionContext`,
`makeProviderConfig`, `makeProviderMetadata`, `makeValidRecommendation`)
compose into it.

Default fixtures represent a typical accepted recall solve: difficulty
`'medium'`, language `'TypeScript'`, deterministic rating `'good'`, fresh
practice context with a previous-best time.

The fixture file uses `'sk-test-fixture'` as the apiKey string. This appears
in test files only, which are excluded from the architecture-boundary scan.

`testing/index.ts` re-exports all factories so #6's runtime-handler tests can
import them when exercising the genuine end-to-end path.

## Test Plan

All Vitest, colocated next to source, no live network.

### `domain/recommendation-schema.test.ts` (8 cases)

- Canonical valid recommendation parses cleanly.
- Recommendation with an extra unknown field fails (`.strict()`).
- Evidence array with 6 items fails (max 5).
- `primaryReason` longer than 200 chars fails.
- Complexity string longer than 80 chars fails.
- `promptVersion: 'leetcode-v2'` fails.
- `recommendedRating: 'maybe'` fails.
- `confidence: 'unknown'` fails.

### `server/build-assessment-prompt.test.ts` (9 cases)

- Snapshot: accepted submission with full context (code, runtime, memory,
  practice context, etc.).
- Snapshot: wrong-answer submission with failingTestcase + expected/actual/
  errorMessage.
- Snapshot: no-submission (manual-overlay path) showing omitted blocks.
- Truncation: statement longer than `STATEMENT_CHAR_LIMIT` is bounded with
  marker present exactly once.
- Truncation: code longer than `CODE_CHAR_LIMIT` bounded with code marker.
- Truncation: failingTestcase longer than `DIAGNOSTIC_FIELD_CHAR_LIMIT`
  bounded.
- Determinism: same input twice produces identical `system` + `user` strings.
- System message contains `PROMPT_VERSION`.
- System message contains the six non-negotiable rule numbers (catches
  accidental rule deletion).

### `server/recommendation-normalizer.test.ts` (~15 cases)

Normalizer table:

| Scenario | AI rating | Deterministic lockReason | Expected |
|---|---|---|---|
| failed lock | `'good'` | `'failed'` | rating `'again'`, shouldUpdateRating false |
| failed lock + AI says again | `'again'` | `'failed'` | rating `'again'`, shouldUpdateRating false |
| hard-mode-overtime | `'easy'` | `'hard-mode-overtime'` | rating `'again'`, shouldUpdateRating false |
| matching rating | `'good'` | rating `'good'`, lockReason null | passthrough except shouldUpdateRating false |
| different rating, no lock | `'hard'` | rating `'good'`, lockReason null | passthrough including AI's shouldUpdateRating |
| blocked deterministic | `'easy'` | `status: 'blocked'` | full passthrough (defensive branch) |

`buildFallbackRecommendation`:

- Each of the 7 `GenAiError` codes maps to the documented `primaryReason`.
- `error: null` produces `'AI recommendation unavailable.'`.
- Recommendation has `confidence: 'low'`, empty arrays,
  `shouldUpdateRating: false`, correct `promptVersion`.
- `recommendedRating` matches the deterministic decision's `rating` when
  accepted; defaults to `'again'` when blocked.

### `server/recommendation-service.test.ts` (~8 cases)

`generateJson` is mocked at the module boundary.

- **AI success path** — mocked `generateJson` returns
  `{status:'success', data: validRecommendation, providerMetadata}`. Assert
  `output.status === 'ai'`, the recommendation passes through the normalizer,
  `providerMetadata` flows through.
- **Normalizer interaction** — same success path but
  `deterministicDecision.lockReason === 'failed'`. Assert the output's
  `recommendedRating === 'again'`.
- **AI error → fallback** — table-driven across 6 error codes
  (`auth`, `rate-limit`, `network`, `timeout`, `invalid-output`, `unknown`).
  Each asserts `output.status === 'fallback'`, the recommendation's
  `recommendedRating` matches deterministic, the `error.code` is preserved.
- **Caller cancellation** — `generateJson` throws `AbortError`. Assert the
  service re-raises (does not return a fallback).
- **Call-shape verification** — asserts `generateJson` was called with the
  expected request shape: spread of `providerConfig` (including
  `apiKey: 'sk-test-fixture'`), the built prompt, and
  `assessmentRecommendationSchema`.

## Acceptance Criteria Mapping

- "Prompt builder is deterministic for the same input." →
  `build-assessment-prompt.test.ts` — explicit "same input twice"
  determinism test.
- "Output schema rejects extra fields." → `recommendation-schema.test.ts`
  — `.strict()` + extra-field test.
- "Failed submissions normalize to `Again` even if provider returns another
  rating." → `recommendation-normalizer.test.ts` — first two table rows.
- "Hard-mode lock normalizes to the locked deterministic rating." →
  `recommendation-normalizer.test.ts` — hard-mode-overtime row.
- "Recommendation output is safe for display in overlay." → Schema bounds
  every string ≤200 chars, complexity ≤80, arrays ≤5. Tests in
  `recommendation-schema.test.ts` enforce. Fallback recommendation has no
  fabricated content.
- "AI output does not mutate practice logs or user notes." →
  `recommendation-service.ts` has no write paths — it only reads input and
  returns a recommendation. The schema has no field that could carry a
  log/note write. Implementer does not import any repository or write
  function.

## Architecture-Boundary Compliance

- Cross-feature imports from `#6`'s code to this feature will target
  `@/features/leetcode-review-assistant/server/recommendation-service`,
  matching the `server/*service` allowlist.
- The root barrel `src/features/leetcode-review-assistant/index.ts`
  re-exports only `recommendAssessment` + public types. No `./server` deep
  re-export.
- The `apiKey` literal token does not appear anywhere in
  `src/features/leetcode-review-assistant/` production source. Test fixtures
  use `'sk-test-fixture'` and live in `.test.ts(x)` files excluded from the
  source-level scan. The architecture-boundary test added in #4 enforces
  this at CI time.

## Dependencies

Depends on: #1 (provides `LeetCodeAssessmentDecision`), #2 (provides
`OverlayAssessmentSessionContext`), #3 (provides `generateJson`,
`GenAiProviderConfig`, `GenAiError`, `GenAiProviderMetadata`). All merged.

Unblocks: #6 (runtime endpoint calls `recommendAssessment`), #7 (overlay
hook consumes the recommendation), #8 (recommendation component renders it).

## Out-of-Scope Notes

- `not-configured` is a `GenAiError` code but should never reach
  `recommendAssessment` in practice — #6's runtime endpoint checks
  `loadActiveProviderConfig` first and returns `not-configured` to the
  content script before calling this service. The fallback factory still
  handles the code defensively in case the flow ever changes.
- Per-provider model selection (e.g., default model per provider) is the
  user's job via the settings UI (#4). The service receives a fully-resolved
  `providerConfig` and trusts it.
- No telemetry: `providerMetadata.durationMs` and `totalTokens` flow to the
  caller, but this feature doesn't log or persist anything.
