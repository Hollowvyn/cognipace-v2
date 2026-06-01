# GenAI Provider Network Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a background-only `src/features/genai/` module that returns validated JSON from OpenAI, Anthropic, or Gemini through a single typed interface.

**Architecture:** Three per-provider adapters in `server/providers/` each export `requestJson(request)`. A tiny facade `generateJson(request)` in `server/genai-client.ts` switches on `request.provider`. All adapters share `fetchWithTimeout`, `mapHttpStatusToGenAiError`, and `redactErrorMessage` from `server/providers/shared.ts`. Caller passes a Zod schema; `zodToProviderJsonSchema` converts it with per-provider quirks (OpenAI requires `additionalProperties: false` + full `required[]`; Gemini disallows `additionalProperties`; Anthropic passes through). Result is a tagged union; nothing throws on network/auth errors.

**Tech Stack:** TypeScript, Vitest, Zod 4 (`z.toJSONSchema` built-in, no new dep), native `fetch` + `AbortController`. WXT (Chrome MV3) for context; runs in the background service worker only.

**Spec:** `docs/superpowers/specs/2026-06-01-genai-provider-network-layer-design.md`

**Provider doc references** (verified 2026-06-01; implementer should re-verify in Task 4–6 against the same URLs):
- OpenAI Responses API — https://developers.openai.com/api/docs/api-reference/responses
- Anthropic Messages API — https://docs.anthropic.com/en/api/messages and https://docs.anthropic.com/en/docs/build-with-claude/structured-outputs
- Gemini generateContent — https://ai.google.dev/gemini-api/docs/structured-output

---

## File Plan

**Create:**
- `src/features/genai/domain/genai-types.ts`
- `src/features/genai/domain/genai-types.test.ts`
- `src/features/genai/domain/index.ts`
- `src/features/genai/server/providers/shared.ts`
- `src/features/genai/server/providers/shared.test.ts`
- `src/features/genai/server/providers/openai.ts`
- `src/features/genai/server/providers/openai.test.ts`
- `src/features/genai/server/providers/anthropic.ts`
- `src/features/genai/server/providers/anthropic.test.ts`
- `src/features/genai/server/providers/gemini.ts`
- `src/features/genai/server/providers/gemini.test.ts`
- `src/features/genai/server/json-schema.ts`
- `src/features/genai/server/json-schema.test.ts`
- `src/features/genai/server/genai-client.ts`
- `src/features/genai/server/genai-client.test.ts`
- `src/features/genai/server/index.ts`
- `src/features/genai/testing/genai-fixtures.ts`
- `src/features/genai/testing/index.ts`
- `src/features/genai/index.ts`

**Modify:** None. This is a greenfield feature folder.

**Conventions:**
- Test files sit next to source.
- Run a single test file with `npx vitest run <path>`.
- Run a single test by name with `npx vitest run <path> -t "<name>"`.
- Full validation: `npm run check`.
- All commit messages follow conventional commits.

---

## Task 1: Domain types + root barrel

**Files:**
- Create: `src/features/genai/domain/genai-types.ts`
- Create: `src/features/genai/domain/genai-types.test.ts`
- Create: `src/features/genai/domain/index.ts`
- Create: `src/features/genai/index.ts` (placeholder — Task 7 fills in the `generateJson` re-export)

This task only adds types. No runtime behavior. The placeholder root barrel exists so the feature is importable from day 1.

- [ ] **Step 1: Write the surface-stability test**

Create `src/features/genai/domain/genai-types.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { genAiErrorCodes, genAiProviderIds } from './genai-types'

describe('genai domain surface', () => {
  it('locks the provider id order', () => {
    expect(genAiProviderIds).toEqual(['openai', 'anthropic', 'gemini'])
  })

  it('includes every documented error code', () => {
    expect(new Set(genAiErrorCodes)).toEqual(
      new Set([
        'not-configured',
        'auth',
        'rate-limit',
        'network',
        'timeout',
        'invalid-output',
        'unknown',
      ]),
    )
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/features/genai/domain/genai-types.test.ts`
Expected: FAIL with `Failed to resolve import "./genai-types"`.

- [ ] **Step 3: Create `genai-types.ts`**

Create `src/features/genai/domain/genai-types.ts`:

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

- [ ] **Step 4: Create the domain barrel**

Create `src/features/genai/domain/index.ts`:

```ts
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
} from './genai-types'
```

- [ ] **Step 5: Create the root barrel (placeholder)**

Create `src/features/genai/index.ts`:

```ts
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

Task 7 will add `export { generateJson } from './server'` once the facade exists.

- [ ] **Step 6: Run the test and typecheck**

Run: `npx vitest run src/features/genai/domain/genai-types.test.ts`
Expected: PASS, 2 tests.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```sh
git add src/features/genai/domain src/features/genai/index.ts
git commit -m "feat(genai): add provider network layer domain types"
```

---

## Task 2: Shared helpers (`fetchWithTimeout`, status mapping, error redaction)

**Files:**
- Create: `src/features/genai/server/providers/shared.ts`
- Create: `src/features/genai/server/providers/shared.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/genai/server/providers/shared.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  GenAiTimeoutError,
  fetchWithTimeout,
  mapHttpStatusToGenAiError,
  redactErrorMessage,
} from './shared'

describe('mapHttpStatusToGenAiError', () => {
  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate-limit'],
    [500, 'network'],
    [502, 'network'],
    [503, 'network'],
    [400, 'unknown'],
    [404, 'unknown'],
  ] as const)('maps HTTP %s to %s', (status, expected) => {
    expect(mapHttpStatusToGenAiError(status)).toBe(expected)
  })

  it.each([200, 201, 204])('returns null for 2xx status %s', (status) => {
    expect(mapHttpStatusToGenAiError(status)).toBeNull()
  })
})

describe('redactErrorMessage', () => {
  it('formats an HTTP failure with status', () => {
    expect(
      redactErrorMessage({ provider: 'openai', cause: 'http', status: 429 }),
    ).toBe('openai request failed: HTTP 429')
  })

  it('formats a timeout', () => {
    expect(
      redactErrorMessage({ provider: 'anthropic', cause: 'timeout' }),
    ).toBe('anthropic request timed out')
  })

  it('formats a network failure', () => {
    expect(redactErrorMessage({ provider: 'gemini', cause: 'network' })).toBe(
      'gemini network request failed',
    )
  })

  it('formats an invalid-output failure', () => {
    expect(
      redactErrorMessage({ provider: 'openai', cause: 'invalid-output' }),
    ).toBe('openai returned output that failed schema validation')
  })

  it('formats unknown with a safe detail', () => {
    expect(
      redactErrorMessage({
        provider: 'openai',
        cause: 'unknown',
        detail: 'CORS preflight rejected',
      }),
    ).toBe('openai request failed: CORS preflight rejected')
  })

  it('omits trailing colon when no detail is provided', () => {
    expect(redactErrorMessage({ provider: 'openai', cause: 'unknown' })).toBe(
      'openai request failed',
    )
  })
})

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('resolves with the Response when fetch completes before timeout', async () => {
    const response = new Response('{}', { status: 200 })
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(response)

    const result = await fetchWithTimeout(
      'https://example.test/x',
      {},
      { timeoutMs: 5000 },
    )

    expect(result).toBe(response)
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it('rejects with GenAiTimeoutError when fetch hangs past the timeout', async () => {
    let abortReason: unknown = null
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            abortReason = (init.signal as AbortSignal & { reason?: unknown })
              .reason
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )

    const pending = fetchWithTimeout(
      'https://example.test/x',
      {},
      { timeoutMs: 5000 },
    )

    await vi.advanceTimersByTimeAsync(5000)

    await expect(pending).rejects.toBeInstanceOf(GenAiTimeoutError)
    expect(abortReason).toBeInstanceOf(GenAiTimeoutError)
  })

  it('re-throws the caller signal AbortError untouched', async () => {
    const callerController = new AbortController()
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )

    const pending = fetchWithTimeout(
      'https://example.test/x',
      {},
      { timeoutMs: 5000, externalSignal: callerController.signal },
    )

    callerController.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await expect(pending).rejects.not.toBeInstanceOf(GenAiTimeoutError)
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/features/genai/server/providers/shared.test.ts`
Expected: FAIL with `Failed to resolve import "./shared"`.

- [ ] **Step 3: Implement `shared.ts`**

Create `src/features/genai/server/providers/shared.ts`:

```ts
import type { GenAiError, GenAiProviderId } from '../../domain'

export class GenAiTimeoutError extends Error {
  readonly tag = 'GenAiTimeoutError' as const

  constructor(message = 'GenAI request timed out') {
    super(message)
    this.name = 'GenAiTimeoutError'
  }
}

export type FetchWithTimeoutOptions = {
  timeoutMs: number
  externalSignal?: AbortSignal
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  options: FetchWithTimeoutOptions,
): Promise<Response> {
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => {
    timeoutController.abort(new GenAiTimeoutError())
  }, options.timeoutMs)

  const composedSignal = composeSignals(
    timeoutController.signal,
    options.externalSignal,
  )

  try {
    return await fetch(url, { ...init, signal: composedSignal })
  } catch (error) {
    if (timeoutController.signal.aborted) {
      const reason = timeoutController.signal.reason
      throw reason instanceof GenAiTimeoutError ? reason : new GenAiTimeoutError()
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

function composeSignals(
  primary: AbortSignal,
  secondary: AbortSignal | undefined,
): AbortSignal {
  if (!secondary) {
    return primary
  }
  if (secondary.aborted) {
    return secondary
  }
  const merged = new AbortController()
  primary.addEventListener('abort', () => merged.abort(primary.reason), {
    once: true,
  })
  secondary.addEventListener('abort', () => merged.abort(secondary.reason), {
    once: true,
  })
  return merged.signal
}

export function mapHttpStatusToGenAiError(status: number): GenAiError | null {
  if (status >= 200 && status < 300) {
    return null
  }
  if (status === 401 || status === 403) {
    return 'auth'
  }
  if (status === 429) {
    return 'rate-limit'
  }
  if (status >= 500 && status < 600) {
    return 'network'
  }
  return 'unknown'
}

export type RedactErrorMessageInput = {
  provider: GenAiProviderId
  cause: 'http' | 'timeout' | 'network' | 'invalid-output' | 'unknown'
  status?: number
  /** Short, controlled, secret-free string from the caller; appended verbatim. */
  detail?: string
}

export function redactErrorMessage(input: RedactErrorMessageInput): string {
  switch (input.cause) {
    case 'http':
      return `${input.provider} request failed: HTTP ${input.status ?? 'unknown'}`
    case 'timeout':
      return `${input.provider} request timed out`
    case 'network':
      return `${input.provider} network request failed`
    case 'invalid-output':
      return `${input.provider} returned output that failed schema validation`
    case 'unknown':
      return input.detail
        ? `${input.provider} request failed: ${input.detail}`
        : `${input.provider} request failed`
  }
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx vitest run src/features/genai/server/providers/shared.test.ts`
Expected: PASS (20 tests after `it.each` expansion: 11 `mapHttpStatusToGenAiError` + 6 `redactErrorMessage` + 3 `fetchWithTimeout`).

- [ ] **Step 5: Commit**

```sh
git add src/features/genai/server/providers/shared.ts \
        src/features/genai/server/providers/shared.test.ts
git commit -m "feat(genai): add shared fetch-with-timeout and error helpers"
```

---

## Task 3: Zod → JSON Schema converter (`zodToProviderJsonSchema`)

**Files:**
- Create: `src/features/genai/server/json-schema.ts`
- Create: `src/features/genai/server/json-schema.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/genai/server/json-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { zodToProviderJsonSchema } from './json-schema'

const recommendationSchema = z.object({
  recommendedRating: z.enum(['again', 'hard', 'good', 'easy']),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  evidence: z.array(z.string()),
  complexity: z.object({
    time: z.string(),
    space: z.string(),
  }),
})

describe('zodToProviderJsonSchema', () => {
  it('produces an object schema for OpenAI with additionalProperties:false and full required[] at every level', () => {
    const schema = zodToProviderJsonSchema(recommendationSchema, 'openai') as {
      type: string
      additionalProperties?: boolean
      required?: string[]
      properties: { complexity: { additionalProperties?: boolean; required?: string[] } }
    }

    expect(schema.type).toBe('object')
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toEqual(
      expect.arrayContaining([
        'recommendedRating',
        'confidence',
        'summary',
        'evidence',
        'complexity',
      ]),
    )
    expect(schema.properties.complexity.additionalProperties).toBe(false)
    expect(schema.properties.complexity.required).toEqual(
      expect.arrayContaining(['time', 'space']),
    )
  })

  it('passes the schema through largely unchanged for Anthropic', () => {
    const schema = zodToProviderJsonSchema(
      recommendationSchema,
      'anthropic',
    ) as { type: string; properties: Record<string, unknown> }
    expect(schema.type).toBe('object')
    expect(schema.properties).toHaveProperty('recommendedRating')
    expect(schema.properties).toHaveProperty('complexity')
  })

  it('removes additionalProperties everywhere for Gemini', () => {
    const schema = zodToProviderJsonSchema(recommendationSchema, 'gemini')
    expect(JSON.stringify(schema)).not.toContain('additionalProperties')
  })

  it('keeps enum constraints across all providers', () => {
    for (const provider of ['openai', 'anthropic', 'gemini'] as const) {
      const schema = JSON.stringify(
        zodToProviderJsonSchema(recommendationSchema, provider),
      )
      expect(schema).toContain('again')
      expect(schema).toContain('easy')
    }
  })

  it('preserves nullable fields under OpenAI strictness (key remains required, type becomes union)', () => {
    const schema = z.object({
      note: z.string().nullable(),
    })
    const result = zodToProviderJsonSchema(schema, 'openai') as {
      required: string[]
      properties: { note: { type?: unknown } }
    }
    expect(result.required).toEqual(['note'])
    // Zod 4 emits nullable as { type: ['string', 'null'] } or anyOf — we just
    // assert the key stayed required (the precise emission shape is Zod's call).
    expect(result.properties.note.type).toBeDefined()
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/features/genai/server/json-schema.test.ts`
Expected: FAIL with `Failed to resolve import "./json-schema"`.

- [ ] **Step 3: Implement `json-schema.ts`**

Create `src/features/genai/server/json-schema.ts`:

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

function applyOpenAiStrictness(node: unknown): unknown {
  if (!isObjectLike(node)) {
    return node
  }
  if (Array.isArray(node)) {
    return node.map(applyOpenAiStrictness)
  }
  const result: Record<string, unknown> = { ...node }

  if (result.type === 'object' && isPropertiesObject(result.properties)) {
    result.additionalProperties = false
    result.required = Object.keys(result.properties)
    const nextProps: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(result.properties)) {
      nextProps[key] = applyOpenAiStrictness(value)
    }
    result.properties = nextProps
  }

  if (result.type === 'array' && result.items !== undefined) {
    result.items = applyOpenAiStrictness(result.items)
  }

  return result
}

function stripGeminiUnsupported(node: unknown): unknown {
  if (!isObjectLike(node)) {
    return node
  }
  if (Array.isArray(node)) {
    return node.map(stripGeminiUnsupported)
  }
  const result: Record<string, unknown> = { ...node }

  delete result.additionalProperties
  delete result.$ref

  if (
    typeof result.format === 'string' &&
    !geminiAllowedFormats.has(result.format)
  ) {
    delete result.format
  }

  if (isPropertiesObject(result.properties)) {
    const nextProps: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(result.properties)) {
      nextProps[key] = stripGeminiUnsupported(value)
    }
    result.properties = nextProps
  }

  if (result.items !== undefined) {
    result.items = stripGeminiUnsupported(result.items)
  }

  return result
}

const geminiAllowedFormats = new Set(['date-time', 'date', 'time', 'enum'])

function isObjectLike(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null
}

function isPropertiesObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx vitest run src/features/genai/server/json-schema.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```sh
git add src/features/genai/server/json-schema.ts \
        src/features/genai/server/json-schema.test.ts
git commit -m "feat(genai): convert Zod schemas to per-provider JSON Schema"
```

---

## Task 4: OpenAI adapter + fixture builder

**Files:**
- Create: `src/features/genai/server/providers/openai.ts`
- Create: `src/features/genai/server/providers/openai.test.ts`
- Create: `src/features/genai/testing/genai-fixtures.ts` (initial: OpenAI helpers only; Tasks 5 and 6 append Anthropic and Gemini)

**OpenAI Responses API contract** (verify against https://developers.openai.com/api/docs/api-reference/responses if anything in the test fails):
- Endpoint: `POST {baseUrl ?? 'https://api.openai.com/v1'}/responses`
- Headers: `Authorization: Bearer ${apiKey}`, `Content-Type: application/json`
- Body: `{ model, instructions: prompt.system, input: prompt.user, text: { format: { type: 'json_schema', name: 'response', strict: true, schema: <provider-tuned> } }, temperature: temperature ?? 0.2 }`
- Response on 200: `{ id, model, output: Array<{ type, ...}>, usage: { input_tokens, output_tokens, total_tokens } }`
- Output JSON text path: find the first `output[]` item with `type === 'message'`, then its `content[]` item with `type === 'output_text'`, then `.text` (a JSON-encoded string).

- [ ] **Step 1: Create the OpenAI fixture helper**

Create `src/features/genai/testing/genai-fixtures.ts`:

```ts
import type { GenAiProviderId } from '../domain'

export function makeOpenAiSuccessResponse<T>(payload: T): Response {
  const body = {
    id: 'resp_test_1',
    object: 'response',
    model: 'gpt-test',
    output: [
      {
        id: 'msg_test_1',
        type: 'message',
        status: 'completed',
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text: JSON.stringify(payload),
            annotations: [],
          },
        ],
      },
    ],
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
    },
  }
  return jsonResponse(body, 200)
}

export function makeProviderErrorResponse(
  provider: GenAiProviderId,
  status: number,
  body: unknown = { error: { message: `${provider} error` } },
): Response {
  return jsonResponse(body, status)
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

(Tasks 5 and 6 append `makeAnthropicSuccessResponse` and `makeGeminiSuccessResponse` to this file.)

- [ ] **Step 2: Write the failing adapter tests**

Create `src/features/genai/server/providers/openai.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import type { GenAiGenerateJsonRequest } from '../../domain'
import {
  makeOpenAiSuccessResponse,
  makeProviderErrorResponse,
} from '../../testing/genai-fixtures'
import { requestJson } from './openai'

const schema = z.object({
  rating: z.enum(['again', 'hard', 'good', 'easy']),
  confidence: z.number(),
})
type Payload = z.infer<typeof schema>

const API_KEY = 'sk-test-secret-1234567890'

function buildRequest(
  overrides: Partial<GenAiGenerateJsonRequest<Payload>> = {},
): GenAiGenerateJsonRequest<Payload> {
  return {
    provider: 'openai',
    model: 'gpt-test',
    apiKey: API_KEY,
    prompt: { system: 'sys', user: 'user' },
    schema,
    ...overrides,
  }
}

describe('openai requestJson', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function expectNoKeyLeak(result: { message?: string }) {
    expect(result.message ?? '').not.toContain(API_KEY)
  }

  it('returns success with parsed data and metadata on 200', async () => {
    const payload: Payload = { rating: 'good', confidence: 0.9 }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeOpenAiSuccessResponse(payload),
    )

    const result = await requestJson(buildRequest())

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.data).toEqual(payload)
      expect(result.providerMetadata).toMatchObject({
        provider: 'openai',
        model: 'gpt-test',
        totalTokens: 150,
      })
      expect(result.providerMetadata.durationMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('returns invalid-output when schema validation fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeOpenAiSuccessResponse({ rating: 'maybe', confidence: 0.5 }),
    )

    const result = await requestJson(buildRequest())

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe('invalid-output')
      await expectNoKeyLeak(result)
    }
  })

  it('returns invalid-output when the model returns non-JSON text', async () => {
    const body = {
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: 'not json {' }],
        },
      ],
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200 }),
    )

    const result = await requestJson(buildRequest())

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe('invalid-output')
      await expectNoKeyLeak(result)
    }
  })

  it.each([
    [401, 'auth'],
    [429, 'rate-limit'],
    [503, 'network'],
  ] as const)('maps HTTP %s to %s', async (status, code) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeProviderErrorResponse('openai', status),
    )

    const result = await requestJson(buildRequest())

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe(code)
      await expectNoKeyLeak(result)
    }
  })

  it('returns network on a thrown TypeError from fetch', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('fetch failed'),
    )

    const result = await requestJson(buildRequest())

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe('network')
      await expectNoKeyLeak(result)
    }
  })

  it('returns timeout when fetch hangs past timeoutMs', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )

    const pending = requestJson(buildRequest({ timeoutMs: 1000 }))
    await vi.advanceTimersByTimeAsync(1000)
    const result = await pending

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe('timeout')
      await expectNoKeyLeak(result)
    }
  })

  it('re-throws caller-cancelled AbortError instead of reporting it', async () => {
    const controller = new AbortController()
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )

    const pending = requestJson(buildRequest({ signal: controller.signal }))
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('sends the prompt and schema in the OpenAI Responses body shape', async () => {
    const payload: Payload = { rating: 'good', confidence: 0.9 }
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(makeOpenAiSuccessResponse(payload))

    await requestJson(buildRequest())

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe('https://api.openai.com/v1/responses')
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${API_KEY}`,
    )
    const body = JSON.parse(init?.body as string) as Record<string, unknown>
    expect(body.model).toBe('gpt-test')
    expect(body.instructions).toBe('sys')
    expect(body.input).toBe('user')
    expect(body.text).toMatchObject({
      format: { type: 'json_schema', name: 'response', strict: true },
    })
  })
})
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `npx vitest run src/features/genai/server/providers/openai.test.ts`
Expected: FAIL with `Failed to resolve import "./openai"`.

- [ ] **Step 4: Implement `openai.ts`**

Create `src/features/genai/server/providers/openai.ts`:

```ts
import type {
  GenAiGenerateJsonRequest,
  GenAiGenerateJsonResult,
  GenAiProviderMetadata,
} from '../../domain'
import { zodToProviderJsonSchema } from '../json-schema'
import {
  GenAiTimeoutError,
  fetchWithTimeout,
  mapHttpStatusToGenAiError,
  redactErrorMessage,
} from './shared'

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_TEMPERATURE = 0.2

export async function requestJson<T>(
  request: GenAiGenerateJsonRequest<T>,
): Promise<GenAiGenerateJsonResult<T>> {
  const startedAt = Date.now()
  const baseUrl = request.baseUrl ?? DEFAULT_BASE_URL
  const url = `${baseUrl.replace(/\/+$/, '')}/responses`

  const body = {
    model: request.model,
    instructions: request.prompt.system,
    input: request.prompt.user,
    temperature: request.temperature ?? DEFAULT_TEMPERATURE,
    text: {
      format: {
        type: 'json_schema',
        name: 'response',
        strict: true,
        schema: zodToProviderJsonSchema(request.schema, 'openai'),
      },
    },
  }

  let response: Response
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${request.apiKey}`,
        },
        body: JSON.stringify(body),
      },
      {
        timeoutMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        externalSignal: request.signal,
      },
    )
  } catch (error) {
    return handleFetchException(error, request, startedAt)
  }

  return handleResponse(response, request, startedAt)
}

async function handleResponse<T>(
  response: Response,
  request: GenAiGenerateJsonRequest<T>,
  startedAt: number,
): Promise<GenAiGenerateJsonResult<T>> {
  const httpError = mapHttpStatusToGenAiError(response.status)
  if (httpError) {
    return {
      status: 'error',
      code: httpError,
      message: redactErrorMessage({
        provider: 'openai',
        cause: 'http',
        status: response.status,
      }),
      providerMetadata: {
        provider: 'openai',
        model: request.model,
        durationMs: Date.now() - startedAt,
      },
    }
  }

  let envelope: unknown
  try {
    envelope = await response.json()
  } catch {
    return invalidOutput(request, startedAt)
  }

  const text = extractText(envelope)
  if (text === null) {
    return invalidOutput(request, startedAt)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return invalidOutput(request, startedAt)
  }

  const validated = request.schema.safeParse(parsed)
  if (!validated.success) {
    return invalidOutput(request, startedAt)
  }

  return {
    status: 'success',
    data: validated.data,
    providerMetadata: buildSuccessMetadata(envelope, request, startedAt),
  }
}

function extractText(envelope: unknown): string | null {
  if (!isObject(envelope)) {
    return null
  }
  const output = envelope.output
  if (!Array.isArray(output)) {
    return null
  }
  for (const item of output) {
    if (!isObject(item) || item.type !== 'message') {
      continue
    }
    const content = item.content
    if (!Array.isArray(content)) {
      continue
    }
    for (const part of content) {
      if (isObject(part) && part.type === 'output_text' && typeof part.text === 'string') {
        return part.text
      }
    }
  }
  return null
}

function buildSuccessMetadata<T>(
  envelope: unknown,
  request: GenAiGenerateJsonRequest<T>,
  startedAt: number,
): GenAiProviderMetadata {
  const meta: GenAiProviderMetadata = {
    provider: 'openai',
    model: request.model,
    durationMs: Date.now() - startedAt,
  }
  if (isObject(envelope)) {
    if (typeof envelope.model === 'string') {
      meta.modelVersion = envelope.model
    }
    const usage = envelope.usage
    if (isObject(usage) && typeof usage.total_tokens === 'number') {
      meta.totalTokens = usage.total_tokens
    }
  }
  return meta
}

function invalidOutput<T>(
  request: GenAiGenerateJsonRequest<T>,
  startedAt: number,
): GenAiGenerateJsonResult<T> {
  return {
    status: 'error',
    code: 'invalid-output',
    message: redactErrorMessage({ provider: 'openai', cause: 'invalid-output' }),
    providerMetadata: {
      provider: 'openai',
      model: request.model,
      durationMs: Date.now() - startedAt,
    },
  }
}

function handleFetchException<T>(
  error: unknown,
  request: GenAiGenerateJsonRequest<T>,
  startedAt: number,
): GenAiGenerateJsonResult<T> {
  if (error instanceof GenAiTimeoutError) {
    return {
      status: 'error',
      code: 'timeout',
      message: redactErrorMessage({ provider: 'openai', cause: 'timeout' }),
      providerMetadata: {
        provider: 'openai',
        model: request.model,
        durationMs: Date.now() - startedAt,
      },
    }
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    throw error
  }
  return {
    status: 'error',
    code: 'network',
    message: redactErrorMessage({ provider: 'openai', cause: 'network' }),
    providerMetadata: {
      provider: 'openai',
      model: request.model,
      durationMs: Date.now() - startedAt,
    },
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `npx vitest run src/features/genai/server/providers/openai.test.ts`
Expected: PASS (11 tests after `it.each` expansion: 3 HTTP-map cases + 8 named).

- [ ] **Step 6: Commit**

```sh
git add src/features/genai/server/providers/openai.ts \
        src/features/genai/server/providers/openai.test.ts \
        src/features/genai/testing/genai-fixtures.ts
git commit -m "feat(genai): add OpenAI Responses adapter and shared fixtures"
```

---

## Task 5: Anthropic adapter

**Files:**
- Create: `src/features/genai/server/providers/anthropic.ts`
- Create: `src/features/genai/server/providers/anthropic.test.ts`
- Modify: `src/features/genai/testing/genai-fixtures.ts` (append `makeAnthropicSuccessResponse`)

**Anthropic Messages API contract** (verify against https://docs.anthropic.com/en/api/messages and https://docs.anthropic.com/en/docs/build-with-claude/structured-outputs if anything in the test fails):
- Endpoint: `POST {baseUrl ?? 'https://api.anthropic.com'}/v1/messages`
- Headers: `x-api-key: ${apiKey}`, `anthropic-version: 2023-06-01`, `Content-Type: application/json`
- Body: `{ model, max_tokens: 4096, system: prompt.system, messages: [{ role: 'user', content: prompt.user }], temperature: temperature ?? 0.2, output_config: { format: { type: 'json_schema', schema: <provider-tuned> } } }`
- Response on 200: `{ id, type: 'message', role: 'assistant', model, content: [{ type: 'text', text: '<json string>' }], stop_reason, usage: { input_tokens, output_tokens } }`
- Output JSON text path: find the first `content[]` item with `type === 'text'`, then `.text`.

- [ ] **Step 1: Append the Anthropic fixture helper**

Open `src/features/genai/testing/genai-fixtures.ts` and add this exported function (place it after `makeOpenAiSuccessResponse`):

```ts
export function makeAnthropicSuccessResponse<T>(payload: T): Response {
  const body = {
    id: 'msg_test_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-test',
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 50 },
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 2: Write the failing adapter tests**

Create `src/features/genai/server/providers/anthropic.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import type { GenAiGenerateJsonRequest } from '../../domain'
import {
  makeAnthropicSuccessResponse,
  makeProviderErrorResponse,
} from '../../testing/genai-fixtures'
import { requestJson } from './anthropic'

const schema = z.object({
  rating: z.enum(['again', 'hard', 'good', 'easy']),
  confidence: z.number(),
})
type Payload = z.infer<typeof schema>

const API_KEY = 'sk-ant-secret-1234567890'

function buildRequest(
  overrides: Partial<GenAiGenerateJsonRequest<Payload>> = {},
): GenAiGenerateJsonRequest<Payload> {
  return {
    provider: 'anthropic',
    model: 'claude-test',
    apiKey: API_KEY,
    prompt: { system: 'sys', user: 'user' },
    schema,
    ...overrides,
  }
}

describe('anthropic requestJson', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function expectNoKeyLeak(result: { message?: string }) {
    expect(result.message ?? '').not.toContain(API_KEY)
  }

  it('returns success with parsed data and metadata on 200', async () => {
    const payload: Payload = { rating: 'good', confidence: 0.9 }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeAnthropicSuccessResponse(payload),
    )

    const result = await requestJson(buildRequest())

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.data).toEqual(payload)
      expect(result.providerMetadata).toMatchObject({
        provider: 'anthropic',
        model: 'claude-test',
        totalTokens: 150,
      })
    }
  })

  it('returns invalid-output when schema validation fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeAnthropicSuccessResponse({ rating: 'maybe', confidence: 0.5 }),
    )

    const result = await requestJson(buildRequest())
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe('invalid-output')
      await expectNoKeyLeak(result)
    }
  })

  it('returns invalid-output when the model returns non-JSON text', async () => {
    const body = {
      content: [{ type: 'text', text: 'not json {' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200 }),
    )

    const result = await requestJson(buildRequest())
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe('invalid-output')
      await expectNoKeyLeak(result)
    }
  })

  it.each([
    [401, 'auth'],
    [429, 'rate-limit'],
    [503, 'network'],
  ] as const)('maps HTTP %s to %s', async (status, code) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeProviderErrorResponse('anthropic', status),
    )

    const result = await requestJson(buildRequest())
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe(code)
      await expectNoKeyLeak(result)
    }
  })

  it('returns network on a thrown TypeError from fetch', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('fetch failed'),
    )

    const result = await requestJson(buildRequest())
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe('network')
      await expectNoKeyLeak(result)
    }
  })

  it('returns timeout when fetch hangs past timeoutMs', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )

    const pending = requestJson(buildRequest({ timeoutMs: 1000 }))
    await vi.advanceTimersByTimeAsync(1000)
    const result = await pending

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe('timeout')
      await expectNoKeyLeak(result)
    }
  })

  it('re-throws caller-cancelled AbortError instead of reporting it', async () => {
    const controller = new AbortController()
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )

    const pending = requestJson(buildRequest({ signal: controller.signal }))
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('sends the prompt and schema in the Anthropic Messages body shape', async () => {
    const payload: Payload = { rating: 'good', confidence: 0.9 }
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(makeAnthropicSuccessResponse(payload))

    await requestJson(buildRequest())

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const headers = init?.headers as Record<string, string>
    expect(headers['x-api-key']).toBe(API_KEY)
    expect(headers['anthropic-version']).toBe('2023-06-01')
    const body = JSON.parse(init?.body as string) as Record<string, unknown>
    expect(body.model).toBe('claude-test')
    expect(body.system).toBe('sys')
    expect(body.messages).toEqual([{ role: 'user', content: 'user' }])
    expect(body.output_config).toMatchObject({
      format: { type: 'json_schema' },
    })
  })
})
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `npx vitest run src/features/genai/server/providers/anthropic.test.ts`
Expected: FAIL with `Failed to resolve import "./anthropic"`.

- [ ] **Step 4: Implement `anthropic.ts`**

Create `src/features/genai/server/providers/anthropic.ts`:

```ts
import type {
  GenAiGenerateJsonRequest,
  GenAiGenerateJsonResult,
  GenAiProviderMetadata,
} from '../../domain'
import { zodToProviderJsonSchema } from '../json-schema'
import {
  GenAiTimeoutError,
  fetchWithTimeout,
  mapHttpStatusToGenAiError,
  redactErrorMessage,
} from './shared'

const DEFAULT_BASE_URL = 'https://api.anthropic.com'
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_TEMPERATURE = 0.2
const DEFAULT_MAX_TOKENS = 4096
const ANTHROPIC_VERSION = '2023-06-01'

export async function requestJson<T>(
  request: GenAiGenerateJsonRequest<T>,
): Promise<GenAiGenerateJsonResult<T>> {
  const startedAt = Date.now()
  const baseUrl = request.baseUrl ?? DEFAULT_BASE_URL
  const url = `${baseUrl.replace(/\/+$/, '')}/v1/messages`

  const body = {
    model: request.model,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: request.prompt.system,
    messages: [{ role: 'user', content: request.prompt.user }],
    temperature: request.temperature ?? DEFAULT_TEMPERATURE,
    output_config: {
      format: {
        type: 'json_schema',
        schema: zodToProviderJsonSchema(request.schema, 'anthropic'),
      },
    },
  }

  let response: Response
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': request.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      },
      {
        timeoutMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        externalSignal: request.signal,
      },
    )
  } catch (error) {
    return handleFetchException(error, request, startedAt)
  }

  return handleResponse(response, request, startedAt)
}

async function handleResponse<T>(
  response: Response,
  request: GenAiGenerateJsonRequest<T>,
  startedAt: number,
): Promise<GenAiGenerateJsonResult<T>> {
  const httpError = mapHttpStatusToGenAiError(response.status)
  if (httpError) {
    return {
      status: 'error',
      code: httpError,
      message: redactErrorMessage({
        provider: 'anthropic',
        cause: 'http',
        status: response.status,
      }),
      providerMetadata: {
        provider: 'anthropic',
        model: request.model,
        durationMs: Date.now() - startedAt,
      },
    }
  }

  let envelope: unknown
  try {
    envelope = await response.json()
  } catch {
    return invalidOutput(request, startedAt)
  }

  const text = extractText(envelope)
  if (text === null) {
    return invalidOutput(request, startedAt)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return invalidOutput(request, startedAt)
  }

  const validated = request.schema.safeParse(parsed)
  if (!validated.success) {
    return invalidOutput(request, startedAt)
  }

  return {
    status: 'success',
    data: validated.data,
    providerMetadata: buildSuccessMetadata(envelope, request, startedAt),
  }
}

function extractText(envelope: unknown): string | null {
  if (!isObject(envelope)) {
    return null
  }
  const content = envelope.content
  if (!Array.isArray(content)) {
    return null
  }
  for (const part of content) {
    if (isObject(part) && part.type === 'text' && typeof part.text === 'string') {
      return part.text
    }
  }
  return null
}

function buildSuccessMetadata<T>(
  envelope: unknown,
  request: GenAiGenerateJsonRequest<T>,
  startedAt: number,
): GenAiProviderMetadata {
  const meta: GenAiProviderMetadata = {
    provider: 'anthropic',
    model: request.model,
    durationMs: Date.now() - startedAt,
  }
  if (isObject(envelope)) {
    if (typeof envelope.model === 'string') {
      meta.modelVersion = envelope.model
    }
    const usage = envelope.usage
    if (isObject(usage)) {
      const inTokens = typeof usage.input_tokens === 'number' ? usage.input_tokens : 0
      const outTokens = typeof usage.output_tokens === 'number' ? usage.output_tokens : 0
      if (inTokens || outTokens) {
        meta.totalTokens = inTokens + outTokens
      }
    }
  }
  return meta
}

function invalidOutput<T>(
  request: GenAiGenerateJsonRequest<T>,
  startedAt: number,
): GenAiGenerateJsonResult<T> {
  return {
    status: 'error',
    code: 'invalid-output',
    message: redactErrorMessage({ provider: 'anthropic', cause: 'invalid-output' }),
    providerMetadata: {
      provider: 'anthropic',
      model: request.model,
      durationMs: Date.now() - startedAt,
    },
  }
}

function handleFetchException<T>(
  error: unknown,
  request: GenAiGenerateJsonRequest<T>,
  startedAt: number,
): GenAiGenerateJsonResult<T> {
  if (error instanceof GenAiTimeoutError) {
    return {
      status: 'error',
      code: 'timeout',
      message: redactErrorMessage({ provider: 'anthropic', cause: 'timeout' }),
      providerMetadata: {
        provider: 'anthropic',
        model: request.model,
        durationMs: Date.now() - startedAt,
      },
    }
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    throw error
  }
  return {
    status: 'error',
    code: 'network',
    message: redactErrorMessage({ provider: 'anthropic', cause: 'network' }),
    providerMetadata: {
      provider: 'anthropic',
      model: request.model,
      durationMs: Date.now() - startedAt,
    },
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `npx vitest run src/features/genai/server/providers/anthropic.test.ts`
Expected: PASS (11 tests after `it.each` expansion).

- [ ] **Step 6: Commit**

```sh
git add src/features/genai/server/providers/anthropic.ts \
        src/features/genai/server/providers/anthropic.test.ts \
        src/features/genai/testing/genai-fixtures.ts
git commit -m "feat(genai): add Anthropic Messages adapter"
```

---

## Task 6: Gemini adapter

**Files:**
- Create: `src/features/genai/server/providers/gemini.ts`
- Create: `src/features/genai/server/providers/gemini.test.ts`
- Modify: `src/features/genai/testing/genai-fixtures.ts` (append `makeGeminiSuccessResponse`)

**Gemini generateContent API contract** (verify against https://ai.google.dev/gemini-api/docs/structured-output if anything in the test fails):
- Endpoint: `POST {baseUrl ?? 'https://generativelanguage.googleapis.com'}/v1beta/models/${model}:generateContent`
- Headers: `x-goog-api-key: ${apiKey}`, `Content-Type: application/json`
- Body: `{ contents: [{ role: 'user', parts: [{ text: prompt.user }] }], systemInstruction: { parts: [{ text: prompt.system }] }, generationConfig: { temperature: temperature ?? 0.2, responseMimeType: 'application/json', responseSchema: <provider-tuned> } }`
- Response on 200: `{ candidates: [{ content: { parts: [{ text: '<json string>' }], role: 'model' } }], usageMetadata: { promptTokenCount, candidatesTokenCount, totalTokenCount }, modelVersion? }`
- Output JSON text path: `candidates[0].content.parts[0].text`

- [ ] **Step 1: Append the Gemini fixture helper**

Open `src/features/genai/testing/genai-fixtures.ts` and add this exported function (place it after `makeAnthropicSuccessResponse`):

```ts
export function makeGeminiSuccessResponse<T>(payload: T): Response {
  const body = {
    candidates: [
      {
        content: {
          role: 'model',
          parts: [{ text: JSON.stringify(payload) }],
        },
        finishReason: 'STOP',
      },
    ],
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 50,
      totalTokenCount: 150,
    },
    modelVersion: 'gemini-test-001',
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 2: Write the failing adapter tests**

Create `src/features/genai/server/providers/gemini.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import type { GenAiGenerateJsonRequest } from '../../domain'
import {
  makeGeminiSuccessResponse,
  makeProviderErrorResponse,
} from '../../testing/genai-fixtures'
import { requestJson } from './gemini'

const schema = z.object({
  rating: z.enum(['again', 'hard', 'good', 'easy']),
  confidence: z.number(),
})
type Payload = z.infer<typeof schema>

const API_KEY = 'AIzaSyTestSecret1234567890'

function buildRequest(
  overrides: Partial<GenAiGenerateJsonRequest<Payload>> = {},
): GenAiGenerateJsonRequest<Payload> {
  return {
    provider: 'gemini',
    model: 'gemini-test',
    apiKey: API_KEY,
    prompt: { system: 'sys', user: 'user' },
    schema,
    ...overrides,
  }
}

describe('gemini requestJson', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function expectNoKeyLeak(result: { message?: string }) {
    expect(result.message ?? '').not.toContain(API_KEY)
  }

  it('returns success with parsed data and metadata on 200', async () => {
    const payload: Payload = { rating: 'good', confidence: 0.9 }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeGeminiSuccessResponse(payload),
    )

    const result = await requestJson(buildRequest())

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.data).toEqual(payload)
      expect(result.providerMetadata).toMatchObject({
        provider: 'gemini',
        model: 'gemini-test',
        totalTokens: 150,
        modelVersion: 'gemini-test-001',
      })
    }
  })

  it('returns invalid-output when schema validation fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeGeminiSuccessResponse({ rating: 'maybe', confidence: 0.5 }),
    )

    const result = await requestJson(buildRequest())
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe('invalid-output')
      await expectNoKeyLeak(result)
    }
  })

  it('returns invalid-output when the model returns non-JSON text', async () => {
    const body = {
      candidates: [
        { content: { parts: [{ text: 'not json {' }], role: 'model' } },
      ],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200 }),
    )

    const result = await requestJson(buildRequest())
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe('invalid-output')
      await expectNoKeyLeak(result)
    }
  })

  it.each([
    [401, 'auth'],
    [429, 'rate-limit'],
    [503, 'network'],
  ] as const)('maps HTTP %s to %s', async (status, code) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeProviderErrorResponse('gemini', status),
    )

    const result = await requestJson(buildRequest())
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe(code)
      await expectNoKeyLeak(result)
    }
  })

  it('returns network on a thrown TypeError from fetch', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('fetch failed'),
    )

    const result = await requestJson(buildRequest())
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe('network')
      await expectNoKeyLeak(result)
    }
  })

  it('returns timeout when fetch hangs past timeoutMs', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )

    const pending = requestJson(buildRequest({ timeoutMs: 1000 }))
    await vi.advanceTimersByTimeAsync(1000)
    const result = await pending

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.code).toBe('timeout')
      await expectNoKeyLeak(result)
    }
  })

  it('re-throws caller-cancelled AbortError instead of reporting it', async () => {
    const controller = new AbortController()
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )

    const pending = requestJson(buildRequest({ signal: controller.signal }))
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('sends the prompt and schema in the Gemini generateContent body shape', async () => {
    const payload: Payload = { rating: 'good', confidence: 0.9 }
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(makeGeminiSuccessResponse(payload))

    await requestJson(buildRequest())

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent',
    )
    const headers = init?.headers as Record<string, string>
    expect(headers['x-goog-api-key']).toBe(API_KEY)
    const body = JSON.parse(init?.body as string) as Record<string, unknown>
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'sys' }] })
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'user' }] },
    ])
    expect(body.generationConfig).toMatchObject({
      responseMimeType: 'application/json',
    })
  })
})
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `npx vitest run src/features/genai/server/providers/gemini.test.ts`
Expected: FAIL with `Failed to resolve import "./gemini"`.

- [ ] **Step 4: Implement `gemini.ts`**

Create `src/features/genai/server/providers/gemini.ts`:

```ts
import type {
  GenAiGenerateJsonRequest,
  GenAiGenerateJsonResult,
  GenAiProviderMetadata,
} from '../../domain'
import { zodToProviderJsonSchema } from '../json-schema'
import {
  GenAiTimeoutError,
  fetchWithTimeout,
  mapHttpStatusToGenAiError,
  redactErrorMessage,
} from './shared'

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com'
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_TEMPERATURE = 0.2

export async function requestJson<T>(
  request: GenAiGenerateJsonRequest<T>,
): Promise<GenAiGenerateJsonResult<T>> {
  const startedAt = Date.now()
  const baseUrl = request.baseUrl ?? DEFAULT_BASE_URL
  const url = `${baseUrl.replace(/\/+$/, '')}/v1beta/models/${request.model}:generateContent`

  const body = {
    systemInstruction: { parts: [{ text: request.prompt.system }] },
    contents: [{ role: 'user', parts: [{ text: request.prompt.user }] }],
    generationConfig: {
      temperature: request.temperature ?? DEFAULT_TEMPERATURE,
      responseMimeType: 'application/json',
      responseSchema: zodToProviderJsonSchema(request.schema, 'gemini'),
    },
  }

  let response: Response
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': request.apiKey,
        },
        body: JSON.stringify(body),
      },
      {
        timeoutMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        externalSignal: request.signal,
      },
    )
  } catch (error) {
    return handleFetchException(error, request, startedAt)
  }

  return handleResponse(response, request, startedAt)
}

async function handleResponse<T>(
  response: Response,
  request: GenAiGenerateJsonRequest<T>,
  startedAt: number,
): Promise<GenAiGenerateJsonResult<T>> {
  const httpError = mapHttpStatusToGenAiError(response.status)
  if (httpError) {
    return {
      status: 'error',
      code: httpError,
      message: redactErrorMessage({
        provider: 'gemini',
        cause: 'http',
        status: response.status,
      }),
      providerMetadata: {
        provider: 'gemini',
        model: request.model,
        durationMs: Date.now() - startedAt,
      },
    }
  }

  let envelope: unknown
  try {
    envelope = await response.json()
  } catch {
    return invalidOutput(request, startedAt)
  }

  const text = extractText(envelope)
  if (text === null) {
    return invalidOutput(request, startedAt)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return invalidOutput(request, startedAt)
  }

  const validated = request.schema.safeParse(parsed)
  if (!validated.success) {
    return invalidOutput(request, startedAt)
  }

  return {
    status: 'success',
    data: validated.data,
    providerMetadata: buildSuccessMetadata(envelope, request, startedAt),
  }
}

function extractText(envelope: unknown): string | null {
  if (!isObject(envelope)) {
    return null
  }
  const candidates = envelope.candidates
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null
  }
  const first = candidates[0]
  if (!isObject(first)) {
    return null
  }
  const content = first.content
  if (!isObject(content)) {
    return null
  }
  const parts = content.parts
  if (!Array.isArray(parts) || parts.length === 0) {
    return null
  }
  const part = parts[0]
  if (isObject(part) && typeof part.text === 'string') {
    return part.text
  }
  return null
}

function buildSuccessMetadata<T>(
  envelope: unknown,
  request: GenAiGenerateJsonRequest<T>,
  startedAt: number,
): GenAiProviderMetadata {
  const meta: GenAiProviderMetadata = {
    provider: 'gemini',
    model: request.model,
    durationMs: Date.now() - startedAt,
  }
  if (isObject(envelope)) {
    if (typeof envelope.modelVersion === 'string') {
      meta.modelVersion = envelope.modelVersion
    }
    const usage = envelope.usageMetadata
    if (isObject(usage) && typeof usage.totalTokenCount === 'number') {
      meta.totalTokens = usage.totalTokenCount
    }
  }
  return meta
}

function invalidOutput<T>(
  request: GenAiGenerateJsonRequest<T>,
  startedAt: number,
): GenAiGenerateJsonResult<T> {
  return {
    status: 'error',
    code: 'invalid-output',
    message: redactErrorMessage({ provider: 'gemini', cause: 'invalid-output' }),
    providerMetadata: {
      provider: 'gemini',
      model: request.model,
      durationMs: Date.now() - startedAt,
    },
  }
}

function handleFetchException<T>(
  error: unknown,
  request: GenAiGenerateJsonRequest<T>,
  startedAt: number,
): GenAiGenerateJsonResult<T> {
  if (error instanceof GenAiTimeoutError) {
    return {
      status: 'error',
      code: 'timeout',
      message: redactErrorMessage({ provider: 'gemini', cause: 'timeout' }),
      providerMetadata: {
        provider: 'gemini',
        model: request.model,
        durationMs: Date.now() - startedAt,
      },
    }
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    throw error
  }
  return {
    status: 'error',
    code: 'network',
    message: redactErrorMessage({ provider: 'gemini', cause: 'network' }),
    providerMetadata: {
      provider: 'gemini',
      model: request.model,
      durationMs: Date.now() - startedAt,
    },
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `npx vitest run src/features/genai/server/providers/gemini.test.ts`
Expected: PASS (11 tests after `it.each` expansion).

- [ ] **Step 6: Commit**

```sh
git add src/features/genai/server/providers/gemini.ts \
        src/features/genai/server/providers/gemini.test.ts \
        src/features/genai/testing/genai-fixtures.ts
git commit -m "feat(genai): add Gemini generateContent adapter"
```

---

## Task 7: Facade + barrels

**Files:**
- Create: `src/features/genai/server/genai-client.ts`
- Create: `src/features/genai/server/genai-client.test.ts`
- Create: `src/features/genai/server/index.ts`
- Create: `src/features/genai/testing/index.ts`
- Modify: `src/features/genai/index.ts` (add `generateJson` export)

- [ ] **Step 1: Write the failing facade test**

Create `src/features/genai/server/genai-client.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run src/features/genai/server/genai-client.test.ts`
Expected: FAIL with `Failed to resolve import "./genai-client"`.

- [ ] **Step 3: Implement `genai-client.ts`**

Create `src/features/genai/server/genai-client.ts`:

```ts
import type {
  GenAiGenerateJsonRequest,
  GenAiGenerateJsonResult,
} from '../domain'

import { requestJson as anthropicRequestJson } from './providers/anthropic'
import { requestJson as geminiRequestJson } from './providers/gemini'
import { requestJson as openaiRequestJson } from './providers/openai'

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
    default:
      return {
        status: 'error',
        code: 'unknown',
        message: `Unrecognized provider: ${String(request.provider)}`,
        providerMetadata: {
          provider: request.provider,
          model: request.model,
          durationMs: 0,
        },
      }
  }
}
```

- [ ] **Step 4: Create the `server/index.ts` barrel**

Create `src/features/genai/server/index.ts`:

```ts
export { generateJson } from './genai-client'
```

- [ ] **Step 5: Create the `testing/index.ts` barrel**

Create `src/features/genai/testing/index.ts`:

```ts
export {
  makeAnthropicSuccessResponse,
  makeGeminiSuccessResponse,
  makeOpenAiSuccessResponse,
  makeProviderErrorResponse,
} from './genai-fixtures'
```

- [ ] **Step 6: Update the root barrel**

Open `src/features/genai/index.ts` and replace its contents with:

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

- [ ] **Step 7: Run the facade test and the full feature suite**

Run: `npx vitest run src/features/genai/server/genai-client.test.ts`
Expected: PASS, 4 tests.

Run: `npx vitest run src/features/genai`
Expected: PASS across all 7 test files in the feature.

- [ ] **Step 8: Commit**

```sh
git add src/features/genai/server/genai-client.ts \
        src/features/genai/server/genai-client.test.ts \
        src/features/genai/server/index.ts \
        src/features/genai/testing/index.ts \
        src/features/genai/index.ts
git commit -m "feat(genai): expose generateJson facade and testing fixtures barrel"
```

---

## Task 8: Whole-project validation

**Files:** none modified (unless Step 2 catches something)

- [ ] **Step 1: Run the full check**

Run: `npm run check`
Expected: PASS for all four phases (drizzle, typecheck, lint, vitest).

- [ ] **Step 2: Resolve any failures**

If any phase fails, read the output and fix the root cause. Common cases:
- An ESLint import-order violation in any of the new files → reformat the imports per the existing convention (alphabetical within groups, blank line between external and internal).
- A TypeScript strict-mode warning on `unknown` narrowing in the extract/parse helpers → tighten the guard with a `typeof` check.
- A barrel missing one of the new exports → add it.

Re-run `npm run check` until it passes. If you make fixes, commit them with a focused message such as `fix(genai): align lint formatting in provider adapters`.

If `package-lock.json` shows as modified in `git status`, discard those auto-changes with `git checkout -- package-lock.json` (npm sometimes touches it during `wxt prepare`).

- [ ] **Step 3: Confirm clean state**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

Run: `git log --oneline -10`
Expected (most recent first):
- `feat(genai): expose generateJson facade and testing fixtures barrel`
- `feat(genai): add Gemini generateContent adapter`
- `feat(genai): add Anthropic Messages adapter`
- `feat(genai): add OpenAI Responses adapter and shared fixtures`
- `feat(genai): convert Zod schemas to per-provider JSON Schema`
- `feat(genai): add shared fetch-with-timeout and error helpers`
- `feat(genai): add provider network layer domain types`
- (optionally) a `fix:` commit from Step 2
- `docs: design GenAI provider network layer (#3)`

Implementation complete.
