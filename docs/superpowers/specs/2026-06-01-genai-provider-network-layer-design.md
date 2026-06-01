# GenAI Provider Network Layer Design

## Status

Approved design from brainstorming on 2026-06-01. This is a planning artifact
for issue #3 (Create background-only GenAI provider network layer). Current
product and architecture docs remain the source of truth until the
implementation lands. This is the first of four specs covering the GenAI
plumbing cluster (#3, #4, #5, #6) — each ships as its own PR. #4, #5, and #6
consume the contracts defined here without modifying them.

## Context

CogniPace's deterministic assessment policy (issue #1) produces a typed
decision with `confidence`, `reason`, and `warnings`. Issue #2 wires real
practice context into that pipeline. The next cluster (issues #3–#6) builds an
AI recommendation layer that consumes the deterministic decision and produces
a structured AI recommendation surfaced in the overlay.

This issue (#3) is the foundation: a background-only network layer that
multiple AI providers conform to. Provider-specific request shapes must not
leak into assessment, overlay, or the LeetCode review assistant. The layer
returns a normalized, schema-validated `GenAiGenerateJsonResult<T>` regardless
of which provider was used.

`features/genai/` does not exist yet. Nothing in the codebase calls AI
providers today.

## Decisions

- One feature folder: `src/features/genai/`. Three subfolders: `domain/`
  (types only), `server/` (background-only adapters + facade + helpers),
  `testing/` (typed fixtures for downstream tests).
- One public function: `generateJson(request)` exported from `server/index.ts`
  and re-exported at the feature root. No factory, no class. Adapters are an
  implementation detail.
- Three provider adapters land in this issue: `openai`, `anthropic`, `gemini`.
  Each is independently TDD'd with mocked `fetch`. No live network in tests.
- Callers pass a Zod schema. The layer (a) converts it to a provider-tuned
  JSON Schema for structured output, (b) parses + validates the model's reply
  with the same schema. Single source of truth.
- Prompt is single-turn: `{ system, user }`. Few-shot / multi-turn is a YAGNI
  extension for later if needed.
- Result is a tagged union: `{ status: 'success', data, providerMetadata }` or
  `{ status: 'error', code, message, providerMetadata }`. Callers must
  pattern-match; nothing throws on a network or auth failure.
- The seven error codes from the issue are adopted verbatim:
  `not-configured | auth | rate-limit | network | timeout | invalid-output | unknown`.
- `not-configured` is raised by #4's settings loader / #6's runtime handler
  before `generateJson` runs. Adapters never raise it.
- No retries in MVP. Rate-limited or transient network errors propagate to
  the caller, which decides whether to retry. Out of scope here.
- `api/` is intentionally empty for this issue. Runtime contracts between the
  content script and background go in #6.
- Use Zod 4's built-in `z.toJSONSchema()` (pinned `^4.4.3` in
  `package.json`). No new dependency.

## Goals

- Give the AI cluster a single typed interface that produces validated JSON
  from any of three commercial providers.
- Keep provider-specific HTTP shapes, headers, and envelopes invisible to
  callers.
- Make it trivial to add a fourth provider later (local-model adapter,
  OpenAI-compatible proxy) by adding one file in `server/providers/` and a
  case in the facade switch.
- Centralize error normalization so caller features never branch on
  provider-specific status codes or error shapes.

## Non-Goals

- No prompt construction. That's #5.
- No settings UI or secret storage. That's #4.
- No runtime endpoint between content script and background. That's #6.
- No retries, backoff, or rate-limit cooldown. Caller decides.
- No streaming. The first interface is request/response JSON only.
- No request batching, caching, or deduplication.
- No model selection logic. The caller picks the model.
- No telemetry or usage tracking beyond the per-call `durationMs` and optional
  `totalTokens` in `providerMetadata`.

## File Layout

```
src/features/genai/
  domain/
    genai-types.ts             // const arrays + types
    genai-types.test.ts        // surface-stability test only
    index.ts                   // barrel
  server/
    providers/
      openai.ts                // requestJson(input)
      openai.test.ts
      anthropic.ts
      anthropic.test.ts
      gemini.ts
      gemini.test.ts
      shared.ts                // fetchWithTimeout, mapHttpStatusToGenAiError, redactErrorMessage
      shared.test.ts
    json-schema.ts             // zodToProviderJsonSchema(schema, provider)
    json-schema.test.ts
    genai-client.ts            // generateJson(request) — facade
    genai-client.test.ts
    index.ts                   // re-exports generateJson
  testing/
    genai-fixtures.ts          // typed mock Response builders
    index.ts                   // re-exports the fixture builders
  index.ts                     // feature barrel — generateJson + public types
```

`server/providers/*.ts` files do NOT export through any barrel. Only the
facade reaches them. The fixture builders are re-exported through
`src/features/genai/testing/index.ts` so downstream tests in #5 can import
from `@/features/genai/testing` without reaching into the file directly.

## Public Contracts

`src/features/genai/domain/genai-types.ts`:

```ts
import type { ZodType } from 'zod'

export const genAiProviderIds = ['openai', 'anthropic', 'gemini'] as const
export type GenAiProviderId = (typeof genAiProviderIds)[number]

export const genAiErrorCodes = [
  'not-configured',
  'auth',
  'rate-limit',
  'network',
  'timeout',
  'invalid-output',
  'unknown',
] as const
export type GenAiError = (typeof genAiErrorCodes)[number]

export type GenAiProviderConfig = {
  provider: GenAiProviderId
  model: string
  apiKey: string
  /** Optional override for proxies, self-hosted, OpenAI-compatible endpoints. */
  baseUrl?: string
}

export type GenAiPrompt = {
  system: string
  user: string
}

export type GenAiGenerateJsonRequest<T> = GenAiProviderConfig & {
  prompt: GenAiPrompt
  schema: ZodType<T>
  /** Inclusive 0–2 range; provider clamps. Default 0.2. */
  temperature?: number
  /** Default 30000. */
  timeoutMs?: number
  /** Caller's optional cancellation signal. Composed with the internal timeout. */
  signal?: AbortSignal
}

export type GenAiProviderMetadata = {
  provider: GenAiProviderId
  model: string
  /** Provider-reported model/version string when present in the response. */
  modelVersion?: string
  /** Whole-call duration in ms (start of fetch to result return). */
  durationMs: number
  /** Total tokens (input + output) when the provider reports usage. */
  totalTokens?: number
}

export type GenAiGenerateJsonResult<T> =
  | {
      status: 'success'
      data: T
      providerMetadata: GenAiProviderMetadata
    }
  | {
      status: 'error'
      code: GenAiError
      /** Safe to log. Never contains the API key, response headers, or raw body. */
      message: string
      providerMetadata: Pick<
        GenAiProviderMetadata,
        'provider' | 'model' | 'durationMs'
      >
    }
```

`src/features/genai/domain/index.ts` re-exports every const array and type.

`src/features/genai/index.ts` re-exports:

```ts
export { generateJson } from './server'
export {
  genAiErrorCodes,
  genAiProviderIds,
  type GenAiError,
  type GenAiGenerateJsonRequest,
  type GenAiGenerateJsonResult,
  type GenAiPrompt,
  type GenAiProviderConfig,
  type GenAiProviderId,
  type GenAiProviderMetadata,
} from './domain'
```

The `apiKey` field is part of `GenAiProviderConfig` (input) and never appears
on `GenAiProviderMetadata` (output). The whole `server/` tree runs in the
background service worker only; #4's settings loader assembles this config
server-side. The error variant uses `Pick<GenAiProviderMetadata, 'provider' |
'model' | 'durationMs'>` because `modelVersion` and `totalTokens` may not be
known on error paths (e.g., the request never reached the model); it's not a
key-redaction mechanism.

## Adapter Contract

Each adapter exports one function:

```ts
export async function requestJson<T>(
  request: GenAiGenerateJsonRequest<T>,
): Promise<GenAiGenerateJsonResult<T>>
```

Implementation in three steps:

1. **Build the HTTP request** — provider-specific `URL`, headers
   (`Authorization: Bearer …` for OpenAI; `x-api-key: …` + `anthropic-version`
   for Anthropic; `?key=` query string for Gemini), and a body containing
   `prompt.system`, `prompt.user`, `temperature ?? 0.2`, and the
   structured-output config built via `zodToProviderJsonSchema(request.schema,
   request.provider)`.
2. **Execute via `fetchWithTimeout`** — see Shared Helpers below.
3. **Parse + validate** — extract the model's JSON-encoded text from the
   provider's envelope (provider-specific path), `JSON.parse` it, run
   `request.schema.safeParse(parsed)`. Build a `GenAiGenerateJsonResult<T>`
   based on the outcome.

Adapters never reach for `globalThis.fetch` directly; they go through
`fetchWithTimeout` so timeout/abort handling stays consistent.

### Per-Provider Envelope Notes

Implementer pins exact request shapes by consulting current docs (Context7 /
WebFetch) during the plan's first adapter task. These notes capture the
intended endpoints; small naming differences from official docs do not change
this design.

- **OpenAI** — Responses API at `POST {baseUrl}/responses`. Structured output
  via `response_format: { type: 'json_schema', json_schema: { name, strict:
  true, schema } }`. Output text at `response.output[0].content[0].text`.
  Default `baseUrl` is `https://api.openai.com/v1`.
- **Anthropic** — Messages API at `POST {baseUrl}/v1/messages`. Headers
  include `x-api-key` and `anthropic-version`. System prompt goes in
  top-level `system`; user prompt goes in `messages: [{ role: 'user',
  content: prompt.user }]`. Structured output via the current Messages API
  JSON-schema mechanism. Default `baseUrl` is `https://api.anthropic.com`.
- **Gemini** — `POST {baseUrl}/v1beta/models/{model}:generateContent?key={apiKey}`.
  Structured output via `generationConfig.responseMimeType:
  'application/json'` and `generationConfig.responseSchema`. Output at
  `response.candidates[0].content.parts[0].text`. Default `baseUrl` is
  `https://generativelanguage.googleapis.com`.

## Shared Helpers

`src/features/genai/server/providers/shared.ts`:

```ts
export class GenAiTimeoutError extends Error {
  readonly tag = 'GenAiTimeoutError'
}

export type FetchWithTimeoutOptions = {
  timeoutMs: number
  externalSignal?: AbortSignal
}

/**
 * Composes an internal AbortController (for timeout) with the optional caller
 * signal. Throws GenAiTimeoutError on internal timeout. Re-throws the caller's
 * AbortError untouched so adapters can distinguish caller-cancel from timeout.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  options: FetchWithTimeoutOptions,
): Promise<Response>

/**
 * 401/403 → 'auth'. 429 → 'rate-limit'. 5xx → 'network'. 2xx → null.
 * Other 4xx → 'unknown' (caller decides whether to short-circuit).
 */
export function mapHttpStatusToGenAiError(status: number): GenAiError | null

/**
 * Produces a deterministic, secret-free message string for logs and the
 * Result.message field. Format: `${provider} request failed: HTTP ${status}` or
 * `${provider} request failed: ${reason}`. Never includes API keys, headers,
 * or raw response bodies.
 */
export function redactErrorMessage(input: {
  provider: GenAiProviderId
  cause: 'http' | 'timeout' | 'network' | 'invalid-output' | 'unknown'
  status?: number
  detail?: string
}): string
```

## Facade

`src/features/genai/server/genai-client.ts`:

```ts
import { requestJson as openaiRequestJson } from './providers/openai'
import { requestJson as anthropicRequestJson } from './providers/anthropic'
import { requestJson as geminiRequestJson } from './providers/gemini'

import type {
  GenAiGenerateJsonRequest,
  GenAiGenerateJsonResult,
} from '../domain'

export async function generateJson<T>(
  request: GenAiGenerateJsonRequest<T>,
): Promise<GenAiGenerateJsonResult<T>> {
  switch (request.provider) {
    case 'openai':
      return openaiRequestJson(request)
    case 'anthropic':
      return anthropicRequestJson(request)
    case 'gemini':
      return geminiRequestJson(request)
  }
}
```

`server/index.ts` re-exports `generateJson`. No other server symbols are
re-exported.

## Zod → JSON Schema Conversion

`src/features/genai/server/json-schema.ts` exports one function:

```ts
export function zodToProviderJsonSchema(
  schema: ZodType<unknown>,
  provider: GenAiProviderId,
): unknown
```

Implementation:

```ts
import { z, type ZodType } from 'zod'
import type { GenAiProviderId } from '../domain'

export function zodToProviderJsonSchema(
  schema: ZodType<unknown>,
  provider: GenAiProviderId,
): unknown {
  const raw = z.toJSONSchema(schema)
  switch (provider) {
    case 'openai':
      return applyOpenAiStrictness(raw)
    case 'anthropic':
      return raw
    case 'gemini':
      return stripGeminiUnsupported(raw)
  }
}

function applyOpenAiStrictness(node: unknown): unknown
function stripGeminiUnsupported(node: unknown): unknown
```

Per-provider rules:

| Quirk | OpenAI | Anthropic | Gemini |
|---|---|---|---|
| Top level must be `type: 'object'` | Required | Required | Required |
| `additionalProperties: false` everywhere | Injected by `applyOpenAiStrictness` | Pass-through | Removed by `stripGeminiUnsupported` |
| All properties must be in `required[]` | Injected by `applyOpenAiStrictness` | Pass-through | Pass-through |
| Unsupported keys removed | Not needed | Not needed | Strips `additionalProperties`, `$ref`, `format` keys other than `enum`/numeric |
| Wrapper for transport | Adapter wraps in `{ name, strict: true, schema }` for `response_format` | Adapter inlines | Adapter inlines |

`applyOpenAiStrictness` walks the schema tree. For every node with
`type === 'object'`:
- Set `additionalProperties: false` if absent.
- Set `required` to the array of all keys in `properties`.
- Recurse into each property value.

`stripGeminiUnsupported` walks the schema tree. For every object node, delete
`additionalProperties` and any keys in a small allowlist of removable
unsupported keys (`$ref`, `format` when value is not in
`['date-time','date','time','enum']`).

`z.optional()` interacts with OpenAI's "all keys required" rule poorly. The
project convention: use `.nullable()` for fields that may be absent, not
`.optional()`. The OpenAI normalizer treats `.nullable()` as a `{ type: ['X',
'null'] }` union (Zod's default JSON Schema emission) and keeps the key in
`required`. If a downstream schema needs a genuinely optional field, the
implementer expands `applyOpenAiStrictness` then with explicit test coverage.

## Testing Strategy

All Vitest, no live network. Tests stub `globalThis.fetch` with `vi.fn()` and
construct `Response` objects via `testing/genai-fixtures.ts`.

### `server/providers/shared.test.ts`

- `fetchWithTimeout` rejects with `GenAiTimeoutError` after `timeoutMs`
  (uses `vi.useFakeTimers()` and `vi.advanceTimersByTime`).
- `fetchWithTimeout` resolves with the `Response` when fetch completes
  before the timeout.
- `fetchWithTimeout` re-throws the caller's `AbortError` (from
  `externalSignal`) distinctly from `GenAiTimeoutError`.
- `mapHttpStatusToGenAiError` is table-driven:
  401→`auth`, 403→`auth`, 429→`rate-limit`, 500→`network`, 502→`network`,
  503→`network`, 200→`null`, 204→`null`, 400→`unknown`, 404→`unknown`.
- `redactErrorMessage` produces a deterministic format string per `cause`
  value (asserted on exact wording), and the function signature accepts only
  `provider | cause | status | detail` — there is no path to receive headers
  or response bodies in the first place. The apiKey-not-leaked invariant is
  enforced in each adapter test (next section), not here.

### `server/providers/{openai,anthropic,gemini}.test.ts`

Each adapter has the same nine test cases:

1. **success** — `fetch` returns 200 with a canned envelope. Assert
   `status === 'success'`, `data` matches the Zod schema, `providerMetadata`
   has `provider`, `model`, `durationMs` (truthy), and `totalTokens` /
   `modelVersion` when the canned response contains them.
2. **schema mismatch** — 200 with a JSON payload missing a required field.
   Assert `code === 'invalid-output'`.
3. **invalid JSON** — 200 with non-JSON text in the model-content slot.
   Assert `code === 'invalid-output'`.
4. **401** → `auth`.
5. **429** → `rate-limit`.
6. **503** → `network`.
7. **network failure** — `fetch` rejects with `new TypeError('fetch failed')`.
   Assert `network`.
8. **timeout** — `fetch` returns a never-resolving Promise; advance fake
   timers past `timeoutMs`. Assert `timeout`.
9. **caller-cancelled** — pass a `signal` whose controller `.abort()` is
   called before `fetch` resolves. Assert the function rejects with
   `AbortError` (caller-cancel propagates, not reported as a `Result`).

All nine cases additionally assert `result.message` does NOT contain the
fixture's `apiKey` string. This guards the redaction invariant per adapter.

### `server/json-schema.test.ts`

- Round-trip: a representative schema (the eventual #5 recommendation schema:
  `{ recommendedRating, confidence, summary, primaryReason, evidence,
  complexity, improvementPoints, edgeCaseNotes, shouldUpdateRating,
  promptVersion }` shape) converts under each of the three providers.
- OpenAI: nested objects in the output have `additionalProperties: false`
  and `required: [...all property keys]` at every level.
- Gemini: the output has no `additionalProperties` key anywhere.
- Anthropic: snapshot test confirming the pass-through shape is stable.
- `z.nullable()` field round-trips correctly under OpenAI's strictness rule.

### `server/genai-client.test.ts`

- Dispatches to the right adapter per `request.provider` (verified via
  `vi.mock('./providers/openai', ...)` etc.).
- Unknown provider (only constructible via cast) returns
  `{ status: 'error', code: 'unknown' }`.

### `domain/genai-types.test.ts`

- `genAiProviderIds` equals `['openai', 'anthropic', 'gemini']` (exact order).
- `genAiErrorCodes` has all 7 codes (set membership, not order).

### `testing/genai-fixtures.ts`

Not a test file. Exports for #5:

```ts
export function makeOpenAiSuccessResponse<T>(payload: T): Response
export function makeAnthropicSuccessResponse<T>(payload: T): Response
export function makeGeminiSuccessResponse<T>(payload: T): Response
export function makeProviderErrorResponse(
  provider: GenAiProviderId,
  status: number,
  body?: unknown,
): Response
```

Each builder wraps the `payload` in the provider's envelope shape so consumer
tests can drive realistic responses through the adapter under test.

## Acceptance Criteria Mapping

- "Supports `openai`, `anthropic`, and `gemini`." → Adapter Contract +
  Per-Provider Envelope Notes; one TDD'd adapter per provider.
- "Returns a normalized `GenAiGenerateJsonResult<T>`." → Public Contracts
  section.
- "Provider adapters are independently unit-tested with mocked fetch." →
  Testing Strategy → adapter test files (9 cases each).
- "Provider keys are read only in background/server code." → File Layout
  (`server/` is background-only) + Public Contracts (`Pick<…>` on error
  variant strips `apiKey`).
- "No provider-specific response shape leaks into caller features." →
  Adapter Contract (envelope parsing happens inside the adapter, never
  exposed) + Facade (only `generateJson` is re-exported).

## Dependencies

Depends on: none. Runs in parallel with #4 once the
`GenAiProviderConfig` shape in this spec is agreed (it is, after sign-off).

Unblocks: #4 (settings consume the same `GenAiProviderConfig`), #5 (assistant
calls `generateJson`), #6 (runtime endpoint orchestrates #4 + #5 over this
layer).
