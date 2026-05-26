# GitHub Gist Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build GitHub Gist pseudo-sync v1 with reusable local secret storage and a shared REST/GraphQL transport layer.

**Architecture:** Add `platform/http` for external network transport and `platform/secrets` for trusted-context local secrets. Keep TanStack Query v5 as the React server-state layer for queries, mutations, caching, cancellation, and invalidation; it composes with request functions and does not replace the API client. Add `lib/github/api` request declarations and a new `features/sync` feature for Gist sync orchestration, while keeping React behind feature runtime APIs. Migrate LeetCode REST/GraphQL calls onto the shared HTTP transport without changing `features/leetcode-capture` ownership or user behavior.

**Tech Stack:** WXT Chrome MV3, React 19, TypeScript, Zod, TanStack Query, Chrome storage/runtime APIs, Vitest, existing SQLite WASM/Drizzle backup contracts.

---

## File Structure

Create:

- `src/platform/http/http-error.ts` - normalized HTTP error types and status helpers.
- `src/platform/http/redaction.ts` - redacts auth headers, API keys, and sensitive URLs.
- `src/platform/http/json.ts` - safe JSON parsing and body serialization helpers.
- `src/platform/http/http-client.ts` - configured fetch wrapper with injected fetch support.
- `src/platform/http/rest-client.ts` - JSON REST helper over `http-client`.
- `src/platform/http/graphql-client.ts` - GraphQL POST helper over `http-client`.
- `src/platform/http/index.ts` - public infrastructure exports.
- `src/platform/http/http-client.test.ts` - transport, parsing, error, redaction tests.
- `src/platform/secrets/secret-contracts.ts` - provider IDs, Zod schemas, public status types.
- `src/platform/secrets/secret-redaction.ts` - one-way status fingerprint helper.
- `src/platform/secrets/secret-store.ts` - Chrome local secret store and access-level restriction.
- `src/platform/secrets/index.ts` - public infrastructure exports.
- `src/platform/secrets/secret-store.test.ts` - storage, status, deletion, access restriction tests.
- `src/lib/github/api/gist-contracts.ts` - GitHub and CogniPace Gist response/request schemas.
- `src/lib/github/api/gist-requests.ts` - request declaration functions for GitHub Gist REST calls.
- `src/lib/github/api/github-client.ts` - GitHub API facade used by sync service.
- `src/lib/github/api/index.ts` - GitHub API exports.
- `src/lib/github/index.ts` - product integration exports.
- `src/lib/github/api/github-client.test.ts` - request shape and error mapping tests.
- `src/features/sync/api/sync-contracts.ts` - runtime contracts and status schemas.
- `src/features/sync/api/sync-api.ts` - dashboard hooks and `sync.checkOnOpen` caller.
- `src/features/sync/api/sync-serializers.ts` - runtime response schema parsers for sync status and action results.
- `src/features/sync/hooks/use-github-sync-controller.ts` - feature-owned hook that composes sync status, mutations, pending state, and panel actions.
- `src/features/sync/domain/sync-envelope.ts` - sync envelope parser/builders.
- `src/features/sync/domain/sync-status.ts` - status view model and error types.
- `src/features/sync/domain/sync-conflict.ts` - conflict model helpers.
- `src/features/sync/data/sync-metadata-store.ts` - Chrome local sync metadata persistence.
- `src/features/sync/server/sync-service.ts` - Gist sync orchestration.
- `src/features/sync/components/github-sync-panel.tsx` - Settings/Data Management sync panel.
- `src/features/sync/components/github-sync-settings-section.tsx` - sync-owned Data Management section container that renders the panel.
- `src/features/sync/index.ts` - public feature exports.
- `src/features/sync/domain/sync-envelope.test.ts` - envelope validation tests.
- `src/features/sync/data/sync-metadata-store.test.ts` - metadata store tests.
- `src/features/sync/server/sync-service.test.ts` - sync flow tests.
- `src/features/sync/api/sync-api.test.tsx` - runtime hook tests.
- `src/features/sync/components/github-sync-panel.test.tsx` - high-signal panel workflow tests.
- `src/features/sync/components/github-sync-settings-section.test.tsx` - verifies the container hook renders and wires the presentational panel.

Modify:

- `wxt.config.ts` - add GitHub API host access or optional host permission support.
- `src/app/providers/query-client.ts` - set TanStack Query v5 defaults for local-first extension runtime reads and mutations.
- `src/entrypoints/background.ts` - restrict storage access before registering handlers.
- `src/extension/messaging.ts` - add sync runtime protocol.
- `src/extension/background/runtime-policy.ts` - authorize sync methods by surface.
- `src/extension/background/register-handlers.ts` - register sync handlers and schedule mutation-triggered sync.
- `src/extension/background/register-handlers.test.ts` - cover sync handler and mutation behavior.
- `src/extension/background/runtime-policy.test.ts` - cover sync method surface access.
- `src/platform/query/cache-invalidation.ts` - add sync query invalidation support.
- `src/platform/query/query-keys.ts` - add central sync query keys.
- `src/features/backup/api/backup-contracts.ts` - expose `parseBackupFileForCurrentApp` for sync pull validation.
- `src/features/backup/server/backup-service.ts` - expose current backup validation/restore helpers to sync service.
- `src/features/backup/components/data-management-screen.tsx` - render the sync feature section boundary.
- `src/features/backup/components/data-management-screen.test.tsx` - verify sync section placement and backup secrecy.
- `src/lib/leetcode/core/graphql-client.ts` - delegate generic transport to `platform/http`.
- `src/lib/leetcode/content/problem-content-reader.ts` - use LeetCode API request declarations.
- `src/lib/leetcode/metadata/graphql-metadata-source.ts` - use LeetCode API request declarations.
- `src/lib/leetcode/submission/submission-result-api-source.ts` - use LeetCode REST request declarations.
- `src/lib/leetcode/remote/leetcode-fetch-remote-client.ts` - keep facade, wire through new request declarations.
- `src/lib/leetcode/api/leetcode-api.test.ts` - cover LeetCode GraphQL and REST request declarations through `platform/http`.
- `src/lib/leetcode/metadata/metadata-reader.test.ts` - keep metadata behavior assertions passing after transport migration.
- `src/lib/leetcode/content/problem-content-reader.test.ts` - keep content fallback behavior assertions passing after transport migration.
- `src/lib/leetcode/submission/submission-result-api-source.test.ts` - keep submission polling behavior assertions passing after transport migration.
- `docs/product.md` - record approved Gist sync behavior and unchanged non-goals.
- `docs/architecture.md` - document `platform/http`, `platform/secrets`, `features/sync`, and LeetCode boundary.
- `docs/testing.md` - add sync setup and cross-profile smoke tests.
- `docs/superpowers/README.md` - add this plan link.

Do not create a visible GenAI key UI in this implementation. Only GitHub Gist sync uses the new secret store in v1.

## TanStack Query v5 Position

TanStack Query is the web data-fetching layer for React surfaces, including data that ultimately comes from REST, GraphQL, SQLite-backed runtime handlers, or future GenAI calls. The v5 docs show `queryFn` and `mutationFn` composing with plain API functions such as `getTodos` and `postTodo`; they also show mutations invalidating matching query keys after successful writes. Apply that pattern here:

```txt
React component
-> feature API hook using useQuery/useMutation
-> extension runtime message
-> background feature service
-> lib request declaration
-> platform/http
```

Rules:

- Keep all React-visible async reads in `src/features/*/api` hooks built on `useQuery`.
- Keep all React-visible writes/actions in `src/features/*/api` hooks built on `useMutation`.
- Keep query keys in `src/platform/query/query-keys.ts` or feature-local exported key helpers that wrap those keys.
- Invalidate via `invalidateTaggedQueries` after mutations that change durable local data or after sync pulls.
- Pass TanStack Query cancellation signals through only where the query function calls `platform/http` directly. Runtime-message hooks can ignore the signal because background services own their own cancellation and serialization boundaries.
- Do not add a global default `queryFn`; CogniPace has typed runtime methods and typed request declarations, so every hook should name its fetcher function.
- Do not persist the TanStack Query cache in v1. SQLite plus Chrome local DB snapshots are the durable source of truth, and sync metadata/secrets must not leak into a query cache persister.
- Do not use `broadcastQueryClient` in v1. It is experimental and same-browser-tab cache broadcast is not the cross-profile Gist sync problem we are solving.
- Configure QueryClient network mode for local-first extension runtime behavior so local data and local mutations still run when the browser is offline; the background sync service records GitHub network failures as retryable sync status.

## React Architecture Pattern Decision

Use Bulletproof React feature ownership first, then choose component patterns only where they reduce real coupling.

Rules:

- `features/sync` owns all sync state, runtime hooks, mutation composition, status view models, and presentational sync components.
- `features/backup/components/data-management-screen.tsx` hosts the sync section visually, but it must only import one sync boundary component: `GitHubSyncSettingsSection`.
- Prefer custom hooks for reusable stateful logic. The sync panel controller belongs in `src/features/sync/hooks/use-github-sync-controller.ts`.
- Use a presentational/container split: `GitHubSyncSettingsSection` is the container, `GitHubSyncPanel` is the presentational component.
- Do not use HOCs for sync. Hooks provide the same reuse with less wrapper nesting and fewer prop collision risks.
- Do not use render props for sync. The panel does not need caller-defined rendering; hooks and normal props are clearer.
- Do not use the compound component pattern for the first sync panel. It is one cohesive settings panel, not a reusable tabs/menu/accordion primitive with shared implicit state.
- Use compound components later only for shared UI primitives that naturally coordinate subcomponents, such as a reusable settings disclosure, tab group, or menu.
- Keep component props small by passing one typed `status` object, one typed `actions` object, and scalar UI state such as `isPending`.

TypeScript rules:

- Validate all runtime, storage, GitHub, and sync-envelope inputs with Zod before use.
- Use `unknown` for external payloads until a schema parses them.
- Use discriminated unions for sync action results and sync error kinds.
- Use `satisfies` for maps such as runtime policy access, cache invalidation tags, status labels, and error-kind mappings.
- Do not use `any`, raw casts for external data, or stringly typed status handling when a literal union can model it.

Vitest rules:

- Favor behavior tests over snapshots.
- Use React Testing Library semantic queries for components.
- Test the sync service with injected dependencies rather than global network or real Chrome storage.
- Test `platform/http`, `platform/secrets`, GitHub request declarations, sync domain logic, runtime policy, and the settings container separately.

## Task 1: Shared HTTP Transport

**Files:**

- Create: `src/platform/http/http-error.ts`
- Create: `src/platform/http/redaction.ts`
- Create: `src/platform/http/json.ts`
- Create: `src/platform/http/http-client.ts`
- Create: `src/platform/http/rest-client.ts`
- Create: `src/platform/http/graphql-client.ts`
- Create: `src/platform/http/index.ts`
- Create: `src/platform/http/http-client.test.ts`

- [ ] **Step 1: Write failing transport tests**

Create `src/platform/http/http-client.test.ts` with these tests:

```ts
import { describe, expect, it, vi } from 'vitest'

import { createGraphQlRequest } from './graphql-client'
import { createHttpClient } from './http-client'
import { createRestRequest } from './rest-client'
import { redactHttpDebugValue } from './redaction'

describe('platform http client', () => {
  it('parses JSON responses through the injected fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const client = createHttpClient({ fetch: fetchMock })

    await expect(
      client.requestJson({
        url: 'https://api.example.test/resource',
        method: 'GET',
      }),
    ).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/resource',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('throws a normalized error with redacted request details', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'bad token sk-secret' }), {
        status: 401,
      }),
    )
    const client = createHttpClient({ fetch: fetchMock })

    await expect(
      client.requestJson({
        url: 'https://api.example.test/models?key=secret-key',
        method: 'GET',
        headers: { Authorization: 'Bearer ghp_secret' },
        sensitiveValues: ['ghp_secret', 'secret-key', 'sk-secret'],
      }),
    ).rejects.toMatchObject({
      name: 'HttpRequestError',
      status: 401,
    })
    await expect(
      client.requestJson({
        url: 'https://api.example.test/models?key=secret-key',
        method: 'GET',
        headers: { Authorization: 'Bearer ghp_secret' },
        sensitiveValues: ['ghp_secret', 'secret-key', 'sk-secret'],
      }),
    ).rejects.not.toThrow(/ghp_secret|secret-key|sk-secret/)
  })

  it('passes caller supplied AbortSignal through to fetch', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      )
    const signal = new AbortController().signal
    const client = createHttpClient({ fetch: fetchMock })

    await client.requestJson({
      url: 'https://api.example.test/resource',
      method: 'POST',
      signal,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/resource',
      expect.objectContaining({ signal }),
    )
  })

  it('builds REST JSON requests with shared transport', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'gist_1' }), { status: 200 }),
      )
    const request = createRestRequest<{ id: string }>({
      baseUrl: 'https://api.example.test',
      path: '/gists/gist_1',
      method: 'PATCH',
      body: { files: { 'cognipace-sync.json': { content: '{}' } } },
    })

    await expect(
      request(createHttpClient({ fetch: fetchMock })),
    ).resolves.toEqual({ id: 'gist_1' })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/gists/gist_1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          files: { 'cognipace-sync.json': { content: '{}' } },
        }),
      }),
    )
  })

  it('builds GraphQL POST requests with operation name and variables', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: { question: { title: 'Two Sum' } } }),
        {
          status: 200,
        },
      ),
    )
    const request = createGraphQlRequest({
      url: 'https://leetcode.com/graphql',
      query:
        'query getQuestion($titleSlug: String!) { question(titleSlug: $titleSlug) { title } }',
      variables: { titleSlug: 'two-sum' },
      operationName: 'getQuestion',
    })

    await expect(
      request(createHttpClient({ fetch: fetchMock })),
    ).resolves.toEqual({ data: { question: { title: 'Two Sum' } } })
  })

  it('redacts sensitive URL params and headers', () => {
    expect(
      redactHttpDebugValue(
        {
          url: 'https://api.example.test/models?key=abc123&safe=yes',
          headers: {
            Authorization: 'Bearer token',
            'x-api-key': 'secret',
            Accept: 'application/json',
          },
        },
        ['abc123', 'token', 'secret'],
      ),
    ).toEqual({
      url: 'https://api.example.test/models?key=[redacted]&safe=yes',
      headers: {
        Authorization: '[redacted]',
        'x-api-key': '[redacted]',
        Accept: 'application/json',
      },
    })
  })
})
```

- [ ] **Step 2: Run the failing transport tests**

Run:

```sh
npm run test -- src/platform/http/http-client.test.ts
```

Expected: fail because `src/platform/http/*` modules do not exist.

- [ ] **Step 3: Implement normalized HTTP errors**

Create `src/platform/http/http-error.ts`:

```ts
export type HttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'

export interface HttpRequestDebug {
  url: string
  method: HttpMethod
  status?: number | undefined
}

export class HttpRequestError extends Error {
  readonly name = 'HttpRequestError'

  constructor(
    message: string,
    readonly debug: HttpRequestDebug,
    readonly status?: number | undefined,
    readonly cause?: unknown,
  ) {
    super(message)
  }
}

export function isRetryableHttpStatus(status: number | undefined) {
  return (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  )
}
```

- [ ] **Step 4: Implement redaction helpers**

Create `src/platform/http/redaction.ts`:

```ts
const sensitiveHeaderNames = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'api-key',
])

const sensitiveSearchParamNames = new Set([
  'access_token',
  'api_key',
  'apikey',
  'key',
  'token',
])

export function redactString(
  value: string,
  sensitiveValues: readonly string[] = [],
) {
  let redacted = value

  for (const secret of sensitiveValues) {
    if (secret) {
      redacted = redacted.split(secret).join('[redacted]')
    }
  }

  return redacted
}

export function redactUrl(
  value: string,
  sensitiveValues: readonly string[] = [],
) {
  try {
    const url = new URL(value)
    for (const key of Array.from(url.searchParams.keys())) {
      if (sensitiveSearchParamNames.has(key.toLowerCase())) {
        url.searchParams.set(key, '[redacted]')
      }
    }
    return redactString(url.toString(), sensitiveValues)
  } catch {
    return redactString(value, sensitiveValues)
  }
}

export function redactHeaders(
  headers: HeadersInit | undefined,
  sensitiveValues: readonly string[] = [],
) {
  const output: Record<string, string> = {}
  const source = new Headers(headers)

  source.forEach((value, key) => {
    output[key] = sensitiveHeaderNames.has(key.toLowerCase())
      ? '[redacted]'
      : redactString(value, sensitiveValues)
  })

  return output
}

export function redactHttpDebugValue(
  value: { url: string; headers?: HeadersInit | undefined },
  sensitiveValues: readonly string[] = [],
) {
  return {
    url: redactUrl(value.url, sensitiveValues),
    headers: redactHeaders(value.headers, sensitiveValues),
  }
}
```

- [ ] **Step 5: Implement JSON helpers**

Create `src/platform/http/json.ts`:

```ts
export async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text()

  if (!text.trim()) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error('HTTP response body was not valid JSON.', {
      cause: error,
    })
  }
}

export function createJsonBody(value: unknown) {
  return value === undefined ? undefined : JSON.stringify(value)
}
```

- [ ] **Step 6: Implement the fetch-backed client**

Create `src/platform/http/http-client.ts`:

```ts
import {
  HttpRequestError,
  type HttpMethod,
  type HttpRequestDebug,
} from './http-error'
import { createJsonBody, readJsonResponse } from './json'
import { redactHttpDebugValue, redactString } from './redaction'

export interface HttpJsonRequest {
  url: string
  method: HttpMethod
  headers?: HeadersInit | undefined
  body?: unknown
  credentials?: RequestCredentials | undefined
  signal?: AbortSignal | undefined
  sensitiveValues?: readonly string[] | undefined
}

export interface HttpClient {
  requestJson<T = unknown>(request: HttpJsonRequest): Promise<T>
}

export function createHttpClient(
  options: { fetch?: typeof fetch | undefined } = {},
): HttpClient {
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis)

  if (!fetchImpl) {
    throw new Error('Fetch is not available.')
  }

  return {
    async requestJson<T = unknown>(request: HttpJsonRequest): Promise<T> {
      const headers = new Headers(request.headers)

      if (request.body !== undefined && !headers.has('content-type')) {
        headers.set('content-type', 'application/json')
      }

      const debug = createDebug(request)

      try {
        const response = await fetchImpl(request.url, {
          method: request.method,
          headers,
          body: createJsonBody(request.body),
          credentials: request.credentials,
          signal: request.signal,
        })
        const payload = await readJsonResponse(response)

        if (!response.ok) {
          throw new HttpRequestError(
            createHttpErrorMessage(
              response.status,
              payload,
              request.sensitiveValues,
            ),
            { ...debug, status: response.status },
            response.status,
            payload,
          )
        }

        return payload as T
      } catch (error) {
        if (error instanceof HttpRequestError) {
          throw error
        }

        throw new HttpRequestError(
          redactString(
            error instanceof Error ? error.message : String(error),
            request.sensitiveValues,
          ),
          debug,
          undefined,
          error,
        )
      }
    },
  }
}

function createDebug(request: HttpJsonRequest): HttpRequestDebug {
  const redacted = redactHttpDebugValue(
    { url: request.url, headers: request.headers },
    request.sensitiveValues,
  )

  return {
    url: redacted.url,
    method: request.method,
  }
}

function createHttpErrorMessage(
  status: number,
  payload: unknown,
  sensitiveValues: readonly string[] | undefined,
) {
  const message =
    isRecord(payload) && typeof payload.message === 'string'
      ? payload.message
      : `HTTP request failed with status ${status}.`

  return redactString(message, sensitiveValues)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
```

- [ ] **Step 7: Implement REST and GraphQL helpers**

Create `src/platform/http/rest-client.ts`:

```ts
import type { HttpClient, HttpJsonRequest } from './http-client'

export interface RestRequest<TResponse> {
  (client: HttpClient): Promise<TResponse>
}

export function createRestRequest<TResponse>(
  request: Omit<HttpJsonRequest, 'url'> & {
    baseUrl: string
    path: string
    searchParams?: Record<string, string | undefined> | undefined
  },
): RestRequest<TResponse> {
  return (client) => {
    const url = new URL(request.path, request.baseUrl)

    for (const [key, value] of Object.entries(request.searchParams ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, value)
      }
    }

    return client.requestJson<TResponse>({
      ...request,
      url: url.toString(),
    })
  }
}
```

Create `src/platform/http/graphql-client.ts`:

```ts
import type { HttpClient } from './http-client'

export interface GraphQlRequestInput {
  url: string
  query: string
  variables?: Record<string, unknown> | undefined
  operationName?: string | undefined
  headers?: HeadersInit | undefined
  credentials?: RequestCredentials | undefined
  signal?: AbortSignal | undefined
  sensitiveValues?: readonly string[] | undefined
}

export function createGraphQlRequest<TResponse = unknown>(
  request: GraphQlRequestInput,
) {
  return (client: HttpClient) =>
    client.requestJson<TResponse>({
      url: request.url,
      method: 'POST',
      headers: request.headers,
      credentials: request.credentials,
      signal: request.signal,
      sensitiveValues: request.sensitiveValues,
      body: {
        query: request.query,
        variables: request.variables ?? {},
        ...(request.operationName
          ? { operationName: request.operationName }
          : {}),
      },
    })
}
```

Create `src/platform/http/index.ts`:

```ts
export { HttpRequestError, isRetryableHttpStatus } from './http-error'
export type { HttpMethod, HttpRequestDebug } from './http-error'
export { createHttpClient } from './http-client'
export type { HttpClient, HttpJsonRequest } from './http-client'
export { createRestRequest } from './rest-client'
export type { RestRequest } from './rest-client'
export { createGraphQlRequest } from './graphql-client'
export type { GraphQlRequestInput } from './graphql-client'
export {
  redactHeaders,
  redactHttpDebugValue,
  redactString,
  redactUrl,
} from './redaction'
```

- [ ] **Step 8: Run transport tests**

Run:

```sh
npm run test -- src/platform/http/http-client.test.ts
```

Expected: pass.

- [ ] **Step 9: Commit transport layer**

```sh
git add src/platform/http
git commit -m "feat: add shared http transport"
```

## Task 2: Reusable Secret Store

**Files:**

- Create: `src/platform/secrets/secret-contracts.ts`
- Create: `src/platform/secrets/secret-redaction.ts`
- Create: `src/platform/secrets/secret-store.ts`
- Create: `src/platform/secrets/index.ts`
- Create: `src/platform/secrets/secret-store.test.ts`
- Modify: `src/entrypoints/background.ts`

- [ ] **Step 1: Write failing secret-store tests**

Create `src/platform/secrets/secret-store.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deleteSecret,
  getSecretStatus,
  readSecret,
  restrictSecretStorageAccess,
  saveSecret,
} from './secret-store'

const storage = new Map<string, unknown>()
const setAccessLevel = vi.fn()

beforeEach(() => {
  storage.clear()
  setAccessLevel.mockReset()
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        async get(keys: string[] | string) {
          const output: Record<string, unknown> = {}
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            output[key] = storage.get(key)
          }
          return output
        },
        async set(values: Record<string, unknown>) {
          for (const [key, value] of Object.entries(values)) {
            storage.set(key, value)
          }
        },
        async remove(keys: string[] | string) {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            storage.delete(key)
          }
        },
        setAccessLevel,
      },
    },
  })
})

describe('secret store', () => {
  it('stores and reads provider secrets from chrome local storage', async () => {
    await saveSecret('github:gist', 'ghp_secret')

    await expect(readSecret('github:gist')).resolves.toBe('ghp_secret')
  })

  it('returns status without exposing raw secret values', async () => {
    await saveSecret('github:gist', 'ghp_secret')

    const status = await getSecretStatus('github:gist')

    expect(status).toMatchObject({
      provider: 'github:gist',
      configured: true,
      updatedAt: expect.any(String),
      fingerprint: expect.any(String),
    })
    expect(JSON.stringify(status)).not.toContain('ghp_secret')
  })

  it('deletes secrets and clears configured status', async () => {
    await saveSecret('github:gist', 'ghp_secret')
    await deleteSecret('github:gist')

    await expect(readSecret('github:gist')).resolves.toBeNull()
    await expect(getSecretStatus('github:gist')).resolves.toMatchObject({
      configured: false,
      fingerprint: null,
    })
  })

  it('restricts local storage to trusted extension contexts', async () => {
    await restrictSecretStorageAccess()

    expect(setAccessLevel).toHaveBeenCalledWith({
      accessLevel: 'TRUSTED_CONTEXTS_ONLY',
    })
  })
})
```

- [ ] **Step 2: Run the failing secret tests**

Run:

```sh
npm run test -- src/platform/secrets/secret-store.test.ts
```

Expected: fail because `src/platform/secrets/*` modules do not exist.

- [ ] **Step 3: Implement secret contracts**

Create `src/platform/secrets/secret-contracts.ts`:

```ts
import { z } from 'zod'

export const secretProviderIdSchema = z.enum([
  'github:gist',
  'genai:openai',
  'genai:anthropic',
  'genai:google',
])

export type SecretProviderId = z.infer<typeof secretProviderIdSchema>

export const secretStatusSchema = z.strictObject({
  provider: secretProviderIdSchema,
  configured: z.boolean(),
  updatedAt: z.iso.datetime().nullable(),
  fingerprint: z.string().nullable(),
})

export type SecretStatus = z.infer<typeof secretStatusSchema>

export const storedSecretSchema = z.strictObject({
  provider: secretProviderIdSchema,
  value: z.string().min(1),
  updatedAt: z.iso.datetime(),
  fingerprint: z.string().min(8),
})

export type StoredSecret = z.infer<typeof storedSecretSchema>
```

- [ ] **Step 4: Implement one-way secret fingerprints**

Create `src/platform/secrets/secret-redaction.ts`:

```ts
export async function createSecretFingerprint(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')

  return hex.slice(0, 12)
}
```

- [ ] **Step 5: Implement Chrome local secret store**

Create `src/platform/secrets/secret-store.ts`:

```ts
import {
  secretStatusSchema,
  storedSecretSchema,
  type SecretProviderId,
  type SecretStatus,
  type StoredSecret,
} from './secret-contracts'
import { createSecretFingerprint } from './secret-redaction'

const secretKeyPrefix = 'cognipace_secret_v1:'

export async function restrictSecretStorageAccess() {
  const localStorage = readChromeLocalStorage()

  if (
    'setAccessLevel' in localStorage &&
    typeof localStorage.setAccessLevel === 'function'
  ) {
    await localStorage.setAccessLevel({
      accessLevel: 'TRUSTED_CONTEXTS_ONLY',
    })
  }
}

export async function saveSecret(
  provider: SecretProviderId,
  value: string,
  now = new Date(),
) {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    throw new Error('Secret value is required.')
  }

  const storedSecret = storedSecretSchema.parse({
    provider,
    value: normalizedValue,
    updatedAt: now.toISOString(),
    fingerprint: await createSecretFingerprint(normalizedValue),
  })

  await readChromeLocalStorage().set({
    [createSecretStorageKey(provider)]: storedSecret,
  })
}

export async function readSecret(provider: SecretProviderId) {
  const stored = await readStoredSecret(provider)
  return stored?.value ?? null
}

export async function deleteSecret(provider: SecretProviderId) {
  await readChromeLocalStorage().remove(createSecretStorageKey(provider))
}

export async function getSecretStatus(
  provider: SecretProviderId,
): Promise<SecretStatus> {
  const stored = await readStoredSecret(provider)

  return secretStatusSchema.parse({
    provider,
    configured: Boolean(stored),
    updatedAt: stored?.updatedAt ?? null,
    fingerprint: stored?.fingerprint ?? null,
  })
}

async function readStoredSecret(provider: SecretProviderId) {
  const result = await readChromeLocalStorage().get(
    createSecretStorageKey(provider),
  )
  const value = result[createSecretStorageKey(provider)]
  const parsed = storedSecretSchema.safeParse(value)

  return parsed.success ? parsed.data : null
}

function createSecretStorageKey(provider: SecretProviderId) {
  return `${secretKeyPrefix}${provider}`
}

function readChromeLocalStorage(): ChromeStorageLocal {
  if (
    typeof chrome === 'undefined' ||
    typeof chrome.storage === 'undefined' ||
    typeof chrome.storage.local === 'undefined'
  ) {
    throw new Error('chrome.storage.local is not available.')
  }

  return chrome.storage.local as ChromeStorageLocal
}

type ChromeStorageLocal = {
  get(keys: string[] | string): Promise<Record<string, unknown>>
  set(values: Record<string, unknown>): Promise<void>
  remove(keys: string[] | string): Promise<void>
  setAccessLevel?:
    | ((options: { accessLevel: 'TRUSTED_CONTEXTS_ONLY' }) => Promise<void>)
    | undefined
}
```

Create `src/platform/secrets/index.ts`:

```ts
export {
  secretProviderIdSchema,
  secretStatusSchema,
  storedSecretSchema,
} from './secret-contracts'
export type {
  SecretProviderId,
  SecretStatus,
  StoredSecret,
} from './secret-contracts'
export { createSecretFingerprint } from './secret-redaction'
export {
  deleteSecret,
  getSecretStatus,
  readSecret,
  restrictSecretStorageAccess,
  saveSecret,
} from './secret-store'
```

- [ ] **Step 6: Restrict storage access during background startup**

Modify `src/entrypoints/background.ts`:

```ts
import { defineBackground } from 'wxt/utils/define-background'

import { registerBackgroundHandlers } from '@/extension/background/register-handlers'
import { restrictSecretStorageAccess } from '@/platform/secrets'

export default defineBackground({
  type: 'module',
  main() {
    void restrictSecretStorageAccess()
    registerBackgroundHandlers()
  },
})
```

- [ ] **Step 7: Run secret tests**

Run:

```sh
npm run test -- src/platform/secrets/secret-store.test.ts
```

Expected: pass.

- [ ] **Step 8: Commit secret store**

```sh
git add src/platform/secrets src/entrypoints/background.ts
git commit -m "feat: add trusted local secret store"
```

## Task 3: GitHub Gist API Declarations

**Files:**

- Create: `src/lib/github/api/gist-contracts.ts`
- Create: `src/lib/github/api/gist-requests.ts`
- Create: `src/lib/github/api/github-client.ts`
- Create: `src/lib/github/api/index.ts`
- Create: `src/lib/github/index.ts`
- Create: `src/lib/github/api/github-client.test.ts`
- Modify: `wxt.config.ts`

- [ ] **Step 1: Verify current GitHub REST API version**

Use Context7 before editing this task:

```txt
Resolve library: GitHub REST API
Query: current required headers and API version for GET /user, GET /gists/{gist_id}, POST /gists, PATCH /gists/{gist_id}
```

Expected: use the documented `X-GitHub-Api-Version` value consistently in `gist-requests.ts`. If docs still show `2022-11-28`, use that value. If docs show a newer required version, use the newer value and record it in the test expected headers.

- [ ] **Step 2: Write failing GitHub client tests**

Create `src/lib/github/api/github-client.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { createHttpClient } from '@/platform/http'

import { createGitHubGistClient } from './github-client'

describe('GitHub Gist client', () => {
  it('validates tokens through the authenticated user endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ login: 'octocat' }), { status: 200 }),
      )
    const client = createGitHubGistClient({
      httpClient: createHttpClient({ fetch: fetchMock }),
      token: 'ghp_secret',
    })

    await expect(client.validateToken()).resolves.toEqual({
      ok: true,
      login: 'octocat',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/user',
      expect.objectContaining({
        method: 'GET',
        headers: expect.any(Headers),
      }),
    )
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
    expect(headers.get('authorization')).toBe('Bearer ghp_secret')
    expect(headers.get('accept')).toBe('application/vnd.github+json')
  })

  it('creates a private CogniPace sync gist', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'gist_1',
          html_url: 'https://gist.github.com/octocat/gist_1',
          updated_at: '2026-05-26T12:00:00Z',
          history: [
            { version: 'abc123', committed_at: '2026-05-26T12:00:00Z' },
          ],
          files: {
            'cognipace-sync.json': {
              filename: 'cognipace-sync.json',
              content: '{"app":"cognipace"}',
            },
          },
        }),
        { status: 201 },
      ),
    )
    const client = createGitHubGistClient({
      httpClient: createHttpClient({ fetch: fetchMock }),
      token: 'ghp_secret',
    })

    await expect(
      client.createSyncGist('{"app":"cognipace"}'),
    ).resolves.toMatchObject({
      id: 'gist_1',
      remoteVersion: 'abc123',
    })
    expect(
      JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string),
    ).toMatchObject({
      public: false,
      files: {
        'cognipace-sync.json': {
          content: '{"app":"cognipace"}',
        },
      },
    })
  })

  it('maps auth failures without leaking tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Bad credentials ghp_secret' }), {
        status: 401,
      }),
    )
    const client = createGitHubGistClient({
      httpClient: createHttpClient({ fetch: fetchMock }),
      token: 'ghp_secret',
    })

    await expect(client.validateToken()).rejects.toMatchObject({
      status: 401,
    })
    await expect(client.validateToken()).rejects.not.toThrow(/ghp_secret/)
  })
})
```

- [ ] **Step 3: Run failing GitHub tests**

Run:

```sh
npm run test -- src/lib/github/api/github-client.test.ts
```

Expected: fail because GitHub modules do not exist.

- [ ] **Step 4: Implement GitHub schemas**

Create `src/lib/github/api/gist-contracts.ts`:

```ts
import { z } from 'zod'

export const githubUserSchema = z.strictObject({
  login: z.string().min(1),
})

const gistFileSchema = z
  .object({
    filename: z.string().optional(),
    content: z.string().optional(),
    truncated: z.boolean().optional(),
  })
  .passthrough()

const gistHistoryEntrySchema = z
  .object({
    version: z.string().min(1),
    committed_at: z.iso.datetime().optional(),
  })
  .passthrough()

export const githubGistSchema = z
  .object({
    id: z.string().min(1),
    html_url: z.string().url().optional(),
    updated_at: z.iso.datetime(),
    files: z.record(z.string(), gistFileSchema),
    history: z.array(gistHistoryEntrySchema).optional(),
  })
  .passthrough()

export type GitHubUser = z.infer<typeof githubUserSchema>
export type GitHubGist = z.infer<typeof githubGistSchema>

export const cognipaceGistFileName = 'cognipace-sync.json'

export type GitHubGistSummary = {
  id: string
  htmlUrl: string | null
  updatedAt: string
  remoteVersion: string | null
  content: string | null
}
```

- [ ] **Step 5: Implement request declarations**

Create `src/lib/github/api/gist-requests.ts`:

```ts
import { createRestRequest, type HttpClient } from '@/platform/http'

import {
  cognipaceGistFileName,
  githubGistSchema,
  githubUserSchema,
  type GitHubGistSummary,
} from './gist-contracts'

const githubBaseUrl = 'https://api.github.com'
const githubApiVersion = '2022-11-28'

export function createGitHubHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': githubApiVersion,
  }
}

export async function validateGitHubToken(input: {
  httpClient: HttpClient
  token: string
}) {
  const response = await createRestRequest<unknown>({
    baseUrl: githubBaseUrl,
    path: '/user',
    method: 'GET',
    headers: createGitHubHeaders(input.token),
    sensitiveValues: [input.token],
  })(input.httpClient)
  const user = githubUserSchema.parse(response)

  return { ok: true as const, login: user.login }
}

export async function getGitHubGist(input: {
  httpClient: HttpClient
  token: string
  gistId: string
}) {
  const response = await createRestRequest<unknown>({
    baseUrl: githubBaseUrl,
    path: `/gists/${encodeURIComponent(input.gistId)}`,
    method: 'GET',
    headers: createGitHubHeaders(input.token),
    sensitiveValues: [input.token],
  })(input.httpClient)

  return summarizeGist(githubGistSchema.parse(response))
}

export async function createGitHubGist(input: {
  httpClient: HttpClient
  token: string
  content: string
}) {
  const response = await createRestRequest<unknown>({
    baseUrl: githubBaseUrl,
    path: '/gists',
    method: 'POST',
    headers: createGitHubHeaders(input.token),
    body: {
      description: 'CogniPace sync data',
      public: false,
      files: {
        [cognipaceGistFileName]: {
          content: input.content,
        },
      },
    },
    sensitiveValues: [input.token],
  })(input.httpClient)

  return summarizeGist(githubGistSchema.parse(response))
}

export async function updateGitHubGistFile(input: {
  httpClient: HttpClient
  token: string
  gistId: string
  content: string
}) {
  const response = await createRestRequest<unknown>({
    baseUrl: githubBaseUrl,
    path: `/gists/${encodeURIComponent(input.gistId)}`,
    method: 'PATCH',
    headers: createGitHubHeaders(input.token),
    body: {
      files: {
        [cognipaceGistFileName]: {
          content: input.content,
        },
      },
    },
    sensitiveValues: [input.token],
  })(input.httpClient)

  return summarizeGist(githubGistSchema.parse(response))
}

function summarizeGist(
  gist: ReturnType<typeof githubGistSchema.parse>,
): GitHubGistSummary {
  const syncFile = gist.files[cognipaceGistFileName]
  const latestHistory = gist.history?.[0]

  return {
    id: gist.id,
    htmlUrl: gist.html_url ?? null,
    updatedAt: gist.updated_at,
    remoteVersion: latestHistory?.version ?? null,
    content: syncFile?.content ?? null,
  }
}
```

If the Context7 verification in Step 1 gives a different required API version, replace `githubApiVersion` and update the test expectation before running tests.

- [ ] **Step 6: Implement GitHub client facade**

Create `src/lib/github/api/github-client.ts`:

```ts
import { createHttpClient, type HttpClient } from '@/platform/http'

import {
  createGitHubGist,
  getGitHubGist,
  updateGitHubGistFile,
  validateGitHubToken,
} from './gist-requests'

export interface GitHubGistClient {
  validateToken(): Promise<{ ok: true; login: string }>
  getGist(gistId: string): Promise<Awaited<ReturnType<typeof getGitHubGist>>>
  createSyncGist(
    content: string,
  ): Promise<Awaited<ReturnType<typeof createGitHubGist>>>
  updateSyncGist(
    gistId: string,
    content: string,
  ): Promise<Awaited<ReturnType<typeof updateGitHubGistFile>>>
}

export function createGitHubGistClient(input: {
  token: string
  httpClient?: HttpClient | undefined
}): GitHubGistClient {
  const httpClient = input.httpClient ?? createHttpClient()

  return {
    validateToken: () =>
      validateGitHubToken({ httpClient, token: input.token }),
    getGist: (gistId) =>
      getGitHubGist({ httpClient, token: input.token, gistId }),
    createSyncGist: (content) =>
      createGitHubGist({ httpClient, token: input.token, content }),
    updateSyncGist: (gistId, content) =>
      updateGitHubGistFile({ httpClient, token: input.token, gistId, content }),
  }
}
```

Create `src/lib/github/api/index.ts`:

```ts
export { createGitHubGistClient } from './github-client'
export type { GitHubGistClient } from './github-client'
export {
  cognipaceGistFileName,
  githubGistSchema,
  githubUserSchema,
} from './gist-contracts'
export type {
  GitHubGist,
  GitHubGistSummary,
  GitHubUser,
} from './gist-contracts'
```

Create `src/lib/github/index.ts`:

```ts
export * from './api'
```

- [ ] **Step 7: Add GitHub host permission**

Modify `wxt.config.ts` so `host_permissions` includes GitHub API access:

```ts
host_permissions: [
  'https://leetcode.com/*',
  'https://www.leetcode.com/*',
  'https://api.github.com/*',
],
```

Keep this permission narrow. Do not add `https://github.com/*` unless a later implementation step proves it is required.

- [ ] **Step 8: Run GitHub tests**

Run:

```sh
npm run test -- src/lib/github/api/github-client.test.ts
```

Expected: pass.

- [ ] **Step 9: Commit GitHub client**

```sh
git add src/lib/github wxt.config.ts
git commit -m "feat: add github gist api client"
```

## Task 4: Sync Contracts, Envelope, And Metadata Store

**Files:**

- Create: `src/features/sync/api/sync-contracts.ts`
- Create: `src/features/sync/api/sync-serializers.ts`
- Create: `src/features/sync/domain/sync-envelope.ts`
- Create: `src/features/sync/domain/sync-status.ts`
- Create: `src/features/sync/domain/sync-conflict.ts`
- Create: `src/features/sync/data/sync-metadata-store.ts`
- Create: `src/features/sync/domain/sync-envelope.test.ts`
- Create: `src/features/sync/data/sync-metadata-store.test.ts`

- [ ] **Step 1: Write failing sync envelope tests**

Create `src/features/sync/domain/sync-envelope.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { backupSchemaVersion, type BackupFile } from '@/features/backup'

import {
  buildSyncEnvelope,
  parseSyncEnvelopeForCurrentApp,
  syncEnvelopeVersion,
} from './sync-envelope'

const backup: BackupFile = {
  schemaVersion: backupSchemaVersion,
  app: 'cognipace',
  exportedAt: '2026-05-26T12:00:00.000Z',
  source: { appVersion: '0.0.0' },
  data: {
    problems: [],
    topics: [],
    companies: [],
    problemTopics: [],
    problemCompanies: [],
    practice: {
      problemPractice: [],
      fsrsCards: [],
      reviewAttempts: [],
    },
    tracks: {
      tracks: [],
      groups: [],
      memberships: [],
      progress: [],
      session: [],
    },
    settings: [],
  },
}

describe('sync envelope', () => {
  it('wraps a CogniPace backup with sync metadata', () => {
    expect(
      buildSyncEnvelope({
        backup,
        exportedAt: new Date('2026-05-26T12:00:01.000Z'),
        dataUpdatedAt: '2026-05-26T12:00:00.000Z',
      }),
    ).toMatchObject({
      syncEnvelopeVersion,
      app: 'cognipace',
      exportedAt: '2026-05-26T12:00:01.000Z',
      dataUpdatedAt: '2026-05-26T12:00:00.000Z',
      backup,
    })
  })

  it('rejects future sync envelope versions before restore', () => {
    expect(() =>
      parseSyncEnvelopeForCurrentApp({
        syncEnvelopeVersion: syncEnvelopeVersion + 1,
        app: 'cognipace',
        exportedAt: '2026-05-26T12:00:00.000Z',
        dataUpdatedAt: '2026-05-26T12:00:00.000Z',
        backup,
      }),
    ).toThrow('Unsupported sync envelope version')
  })
})
```

- [ ] **Step 2: Write failing metadata store tests**

Create `src/features/sync/data/sync-metadata-store.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearSyncMetadata,
  markLocalDataChanged,
  readSyncMetadata,
  writeSyncMetadata,
} from './sync-metadata-store'

const storage = new Map<string, unknown>()

beforeEach(() => {
  storage.clear()
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        async get(keys: string[] | string) {
          const output: Record<string, unknown> = {}
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            output[key] = storage.get(key)
          }
          return output
        },
        async set(values: Record<string, unknown>) {
          for (const [key, value] of Object.entries(values)) {
            storage.set(key, value)
          }
        },
        async remove(keys: string[] | string) {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            storage.delete(key)
          }
        },
      },
    },
  })
})

describe('sync metadata store', () => {
  it('defaults to disabled clean metadata', async () => {
    await expect(readSyncMetadata()).resolves.toMatchObject({
      enabled: false,
      gistId: null,
      dirtySinceLastSync: false,
      conflict: null,
    })
  })

  it('persists metadata patches', async () => {
    await writeSyncMetadata({
      enabled: true,
      gistId: 'gist_1',
      lastRemoteVersion: 'remote_1',
    })

    await expect(readSyncMetadata()).resolves.toMatchObject({
      enabled: true,
      gistId: 'gist_1',
      lastRemoteVersion: 'remote_1',
    })
  })

  it('marks local durable data dirty with timestamp', async () => {
    await markLocalDataChanged(new Date('2026-05-26T12:00:00.000Z'))

    await expect(readSyncMetadata()).resolves.toMatchObject({
      dirtySinceLastSync: true,
      localDataUpdatedAt: '2026-05-26T12:00:00.000Z',
    })
  })

  it('clears metadata', async () => {
    await writeSyncMetadata({ enabled: true, gistId: 'gist_1' })
    await clearSyncMetadata()

    await expect(readSyncMetadata()).resolves.toMatchObject({
      enabled: false,
      gistId: null,
    })
  })
})
```

- [ ] **Step 3: Run failing sync domain tests**

Run:

```sh
npm run test -- src/features/sync/domain/sync-envelope.test.ts src/features/sync/data/sync-metadata-store.test.ts
```

Expected: fail because sync modules do not exist.

- [ ] **Step 4: Implement sync status and conflict domain types**

Create `src/features/sync/domain/sync-status.ts`:

```ts
export type SyncDirection = 'no-change' | 'pull' | 'push'

export type SyncErrorKind =
  | 'auth'
  | 'conflict'
  | 'gist-missing'
  | 'network'
  | 'rate-limit'
  | 'remote-invalid'
  | 'schema-unsupported'
  | 'unknown'

export interface SyncErrorSummary {
  kind: SyncErrorKind
  message: string
  occurredAt: string
  retryable: boolean
}

export interface SyncStatus {
  enabled: boolean
  configured: boolean
  tokenConfigured: boolean
  gistId: string | null
  isSyncing: boolean
  lastSyncAt: string | null
  lastSyncDirection: SyncDirection | null
  lastError: SyncErrorSummary | null
  conflict: SyncConflictSummary | null
}

export interface SyncConflictSummary {
  detectedAt: string
  localDataUpdatedAt: string | null
  remoteUpdatedAt: string | null
  remoteVersion: string | null
}
```

Create `src/features/sync/domain/sync-conflict.ts`:

```ts
import type { SyncConflictSummary } from './sync-status'

export function createSyncConflict(input: {
  detectedAt: Date
  localDataUpdatedAt: string | null
  remoteUpdatedAt: string | null
  remoteVersion: string | null
}): SyncConflictSummary {
  return {
    detectedAt: input.detectedAt.toISOString(),
    localDataUpdatedAt: input.localDataUpdatedAt,
    remoteUpdatedAt: input.remoteUpdatedAt,
    remoteVersion: input.remoteVersion,
  }
}
```

- [ ] **Step 5: Implement sync contracts**

Create `src/features/sync/api/sync-contracts.ts`:

```ts
import { z } from 'zod'

import { secretStatusSchema } from '@/platform/secrets'

export const syncSurfaceSchema = z.enum([
  'popup',
  'dashboard',
  'content-script',
])

export const syncRequestSchema = z.strictObject({
  surface: syncSurfaceSchema,
})

export const syncGithubTokenRequestSchema = z.strictObject({
  surface: z.literal('dashboard'),
  token: z.string().trim().min(1),
})

export const syncGithubGistRequestSchema = z.strictObject({
  surface: z.literal('dashboard'),
  gistId: z.string().trim().min(1),
})

export const syncSetEnabledRequestSchema = z.strictObject({
  surface: z.literal('dashboard'),
  enabled: z.boolean(),
})

export const syncResolveConflictRequestSchema = z.strictObject({
  surface: z.literal('dashboard'),
  resolution: z.enum(['pull-remote', 'push-local']),
})

export const syncErrorSummarySchema = z.strictObject({
  kind: z.enum([
    'auth',
    'conflict',
    'gist-missing',
    'network',
    'rate-limit',
    'remote-invalid',
    'schema-unsupported',
    'unknown',
  ]),
  message: z.string(),
  occurredAt: z.iso.datetime(),
  retryable: z.boolean(),
})

export const syncConflictSummarySchema = z.strictObject({
  detectedAt: z.iso.datetime(),
  localDataUpdatedAt: z.iso.datetime().nullable(),
  remoteUpdatedAt: z.iso.datetime().nullable(),
  remoteVersion: z.string().nullable(),
})

export const syncStatusSchema = z.strictObject({
  enabled: z.boolean(),
  configured: z.boolean(),
  tokenConfigured: z.boolean(),
  tokenStatus: secretStatusSchema,
  gistId: z.string().nullable(),
  isSyncing: z.boolean(),
  lastSyncAt: z.iso.datetime().nullable(),
  lastSyncDirection: z.enum(['push', 'pull', 'no-change']).nullable(),
  lastError: syncErrorSummarySchema.nullable(),
  conflict: syncConflictSummarySchema.nullable(),
})

export const syncActionResultSchema = z.strictObject({
  status: syncStatusSchema,
  message: z.string(),
})

export type SyncRequest = z.infer<typeof syncRequestSchema>
export type SyncGithubTokenRequest = z.infer<
  typeof syncGithubTokenRequestSchema
>
export type SyncGithubGistRequest = z.infer<typeof syncGithubGistRequestSchema>
export type SyncSetEnabledRequest = z.infer<typeof syncSetEnabledRequestSchema>
export type SyncResolveConflictRequest = z.infer<
  typeof syncResolveConflictRequestSchema
>
export type SerializedSyncStatus = z.infer<typeof syncStatusSchema>
export type SyncActionResult = z.infer<typeof syncActionResultSchema>
```

Create `src/features/sync/api/sync-serializers.ts`:

```ts
import { syncActionResultSchema, syncStatusSchema } from './sync-contracts'
import type { SyncActionResult, SerializedSyncStatus } from './sync-contracts'

export function serializeSyncStatus(status: SerializedSyncStatus) {
  return syncStatusSchema.parse(status)
}

export function serializeSyncActionResult(result: SyncActionResult) {
  return syncActionResultSchema.parse(result)
}
```

- [ ] **Step 6: Implement sync envelope**

Create `src/features/sync/domain/sync-envelope.ts`:

```ts
import { z } from 'zod'

import {
  backupFileSchema,
  parseBackupFileForCurrentApp,
  type BackupFile,
} from '@/features/backup'

export const syncEnvelopeVersion = 1

export const syncEnvelopeSchema = z.strictObject({
  syncEnvelopeVersion: z.literal(syncEnvelopeVersion),
  app: z.literal('cognipace'),
  exportedAt: z.iso.datetime(),
  dataUpdatedAt: z.iso.datetime(),
  backup: backupFileSchema,
})

export type SyncEnvelope = z.infer<typeof syncEnvelopeSchema>

const envelopePreflightSchema = z.object({
  syncEnvelopeVersion: z.number().int(),
  app: z.string(),
})

export function buildSyncEnvelope(input: {
  backup: BackupFile
  exportedAt?: Date | undefined
  dataUpdatedAt: string
}): SyncEnvelope {
  const exportedAt = input.exportedAt ?? new Date()

  return syncEnvelopeSchema.parse({
    syncEnvelopeVersion,
    app: 'cognipace',
    exportedAt: exportedAt.toISOString(),
    dataUpdatedAt: input.dataUpdatedAt,
    backup: input.backup,
  })
}

export function parseSyncEnvelopeForCurrentApp(input: unknown): SyncEnvelope {
  const envelope = envelopePreflightSchema.parse(input)

  if (envelope.app !== 'cognipace') {
    throw new Error('Selected Gist file is not a CogniPace sync file.')
  }

  if (envelope.syncEnvelopeVersion !== syncEnvelopeVersion) {
    throw new Error(
      `Unsupported sync envelope version ${envelope.syncEnvelopeVersion}.`,
    )
  }

  const parsed = syncEnvelopeSchema.parse(input)
  parseBackupFileForCurrentApp(parsed.backup)

  return parsed
}
```

- [ ] **Step 7: Implement sync metadata store**

Create `src/features/sync/data/sync-metadata-store.ts`:

```ts
import { z } from 'zod'

import {
  syncConflictSummarySchema,
  syncErrorSummarySchema,
} from '../api/sync-contracts'

const syncMetadataKey = 'cognipace_sync_metadata_v1'

const syncMetadataSchema = z.strictObject({
  enabled: z.boolean(),
  gistId: z.string().nullable(),
  lastSyncAt: z.iso.datetime().nullable(),
  lastSyncDirection: z.enum(['push', 'pull', 'no-change']).nullable(),
  lastRemoteVersion: z.string().nullable(),
  lastRemoteUpdatedAt: z.iso.datetime().nullable(),
  localDataUpdatedAt: z.iso.datetime().nullable(),
  dirtySinceLastSync: z.boolean(),
  lastError: syncErrorSummarySchema.nullable(),
  conflict: syncConflictSummarySchema.nullable(),
})

export type SyncMetadata = z.infer<typeof syncMetadataSchema>

export const defaultSyncMetadata: SyncMetadata = {
  enabled: false,
  gistId: null,
  lastSyncAt: null,
  lastSyncDirection: null,
  lastRemoteVersion: null,
  lastRemoteUpdatedAt: null,
  localDataUpdatedAt: null,
  dirtySinceLastSync: false,
  lastError: null,
  conflict: null,
}

export async function readSyncMetadata(): Promise<SyncMetadata> {
  const result = await readChromeLocalStorage().get(syncMetadataKey)
  const parsed = syncMetadataSchema.safeParse(result[syncMetadataKey])

  return parsed.success ? parsed.data : defaultSyncMetadata
}

export async function writeSyncMetadata(patch: Partial<SyncMetadata>) {
  const current = await readSyncMetadata()
  const next = syncMetadataSchema.parse({ ...current, ...patch })

  await readChromeLocalStorage().set({ [syncMetadataKey]: next })

  return next
}

export async function clearSyncMetadata() {
  await readChromeLocalStorage().remove(syncMetadataKey)
}

export function markLocalDataChanged(now = new Date()) {
  return writeSyncMetadata({
    localDataUpdatedAt: now.toISOString(),
    dirtySinceLastSync: true,
    lastError: null,
  })
}

function readChromeLocalStorage(): ChromeStorageLocal {
  if (
    typeof chrome === 'undefined' ||
    typeof chrome.storage === 'undefined' ||
    typeof chrome.storage.local === 'undefined'
  ) {
    throw new Error('chrome.storage.local is not available.')
  }

  return chrome.storage.local as ChromeStorageLocal
}

type ChromeStorageLocal = {
  get(keys: string[] | string): Promise<Record<string, unknown>>
  set(values: Record<string, unknown>): Promise<void>
  remove(keys: string[] | string): Promise<void>
}
```

- [ ] **Step 8: Run sync domain tests**

Run:

```sh
npm run test -- src/features/sync/domain/sync-envelope.test.ts src/features/sync/data/sync-metadata-store.test.ts
```

Expected: pass.

- [ ] **Step 9: Commit sync contracts and metadata**

```sh
git add src/features/sync
git commit -m "feat: add sync contracts and metadata"
```

## Task 5: Sync Service

**Files:**

- Create: `src/features/sync/server/sync-service.ts`
- Create: `src/features/sync/server/sync-service.test.ts`
- Modify: `src/features/backup/server/backup-service.ts`

- [ ] **Step 1: Write failing sync service tests**

Create `src/features/sync/server/sync-service.test.ts` with dependency-injected tests:

```ts
import { describe, expect, it, vi } from 'vitest'

import { backupSchemaVersion, type BackupFile } from '@/features/backup'

import { defaultSyncMetadata } from '../data/sync-metadata-store'
import { buildSyncEnvelope } from '../domain/sync-envelope'
import { createSyncService } from './sync-service'

const backup: BackupFile = {
  schemaVersion: backupSchemaVersion,
  app: 'cognipace',
  exportedAt: '2026-05-26T12:00:00.000Z',
  source: { appVersion: '0.0.0' },
  data: {
    problems: [],
    topics: [],
    companies: [],
    problemTopics: [],
    problemCompanies: [],
    practice: { problemPractice: [], fsrsCards: [], reviewAttempts: [] },
    tracks: {
      tracks: [],
      groups: [],
      memberships: [],
      progress: [],
      session: [],
    },
    settings: [],
  },
}

function createHarness() {
  let metadata = { ...defaultSyncMetadata }
  const restoreFullBackup = vi.fn()
  const exportFullBackup = vi.fn().mockResolvedValue(backup)
  const flushDbSnapshot = vi.fn()
  const broadcastInvalidation = vi.fn()
  const githubClient = {
    validateToken: vi.fn().mockResolvedValue({ ok: true, login: 'octocat' }),
    getGist: vi.fn(),
    createSyncGist: vi.fn(),
    updateSyncGist: vi.fn(),
  }
  const service = createSyncService({
    readToken: vi.fn().mockResolvedValue('ghp_secret'),
    saveToken: vi.fn(),
    deleteToken: vi.fn(),
    getTokenStatus: vi.fn().mockResolvedValue({
      provider: 'github:gist',
      configured: true,
      updatedAt: '2026-05-26T12:00:00.000Z',
      fingerprint: 'abcdef123456',
    }),
    createGitHubClient: () => githubClient,
    readMetadata: vi.fn(async () => metadata),
    writeMetadata: vi.fn(async (patch) => {
      metadata = { ...metadata, ...patch }
      return metadata
    }),
    exportFullBackup,
    restoreFullBackup,
    flushDbSnapshot,
    broadcastInvalidation,
    now: () => new Date('2026-05-26T12:30:00.000Z'),
  })

  return {
    service,
    githubClient,
    getMetadata: () => metadata,
    setMetadata: (patch: Partial<typeof metadata>) => {
      metadata = { ...metadata, ...patch }
    },
    restoreFullBackup,
    exportFullBackup,
    flushDbSnapshot,
    broadcastInvalidation,
  }
}

describe('sync service', () => {
  it('creates a private Gist from current backup', async () => {
    const harness = createHarness()
    harness.githubClient.createSyncGist.mockResolvedValue({
      id: 'gist_1',
      htmlUrl: 'https://gist.github.com/gist_1',
      updatedAt: '2026-05-26T12:30:00Z',
      remoteVersion: 'remote_1',
      content: '{}',
    })

    await expect(harness.service.createGithubGist()).resolves.toMatchObject({
      message: 'GitHub Gist created.',
    })
    expect(harness.githubClient.createSyncGist).toHaveBeenCalledWith(
      expect.stringContaining('"app": "cognipace"'),
    )
    expect(harness.getMetadata()).toMatchObject({
      enabled: true,
      gistId: 'gist_1',
      dirtySinceLastSync: false,
      lastRemoteVersion: 'remote_1',
      lastSyncDirection: 'push',
    })
  })

  it('auto-pulls clean local data when remote is newer', async () => {
    const harness = createHarness()
    harness.setMetadata({
      enabled: true,
      gistId: 'gist_1',
      dirtySinceLastSync: false,
      lastRemoteVersion: 'remote_1',
    })
    const envelope = buildSyncEnvelope({
      backup,
      dataUpdatedAt: '2026-05-26T12:10:00.000Z',
    })
    harness.githubClient.getGist.mockResolvedValue({
      id: 'gist_1',
      htmlUrl: null,
      updatedAt: '2026-05-26T12:10:00.000Z',
      remoteVersion: 'remote_2',
      content: JSON.stringify(envelope),
    })

    await harness.service.checkOnOpen()

    expect(harness.restoreFullBackup).toHaveBeenCalledWith(backup)
    expect(harness.flushDbSnapshot).toHaveBeenCalled()
    expect(harness.broadcastInvalidation).toHaveBeenCalled()
    expect(harness.getMetadata()).toMatchObject({
      dirtySinceLastSync: false,
      lastRemoteVersion: 'remote_2',
      lastSyncDirection: 'pull',
    })
  })

  it('marks conflict when local and remote both changed', async () => {
    const harness = createHarness()
    harness.setMetadata({
      enabled: true,
      gistId: 'gist_1',
      dirtySinceLastSync: true,
      localDataUpdatedAt: '2026-05-26T12:15:00.000Z',
      lastRemoteVersion: 'remote_1',
    })
    const envelope = buildSyncEnvelope({
      backup,
      dataUpdatedAt: '2026-05-26T12:20:00.000Z',
    })
    harness.githubClient.getGist.mockResolvedValue({
      id: 'gist_1',
      htmlUrl: null,
      updatedAt: '2026-05-26T12:20:00.000Z',
      remoteVersion: 'remote_2',
      content: JSON.stringify(envelope),
    })

    await harness.service.checkOnOpen()

    expect(harness.restoreFullBackup).not.toHaveBeenCalled()
    expect(harness.githubClient.updateSyncGist).not.toHaveBeenCalled()
    expect(harness.getMetadata().conflict).toMatchObject({
      remoteVersion: 'remote_2',
    })
  })

  it('records retryable push errors without throwing local mutation failures', async () => {
    const harness = createHarness()
    harness.setMetadata({
      enabled: true,
      gistId: 'gist_1',
      dirtySinceLastSync: true,
      lastRemoteVersion: 'remote_1',
    })
    harness.githubClient.getGist.mockResolvedValue({
      id: 'gist_1',
      htmlUrl: null,
      updatedAt: '2026-05-26T12:00:00.000Z',
      remoteVersion: 'remote_1',
      content: JSON.stringify(
        buildSyncEnvelope({
          backup,
          dataUpdatedAt: '2026-05-26T12:00:00.000Z',
        }),
      ),
    })
    harness.githubClient.updateSyncGist.mockRejectedValue(
      new Error('rate limit'),
    )

    await expect(harness.service.syncAfterMutation()).resolves.toBeNull()
    expect(harness.getMetadata().lastError).toMatchObject({
      retryable: true,
    })
    expect(harness.getMetadata().dirtySinceLastSync).toBe(true)
  })
})
```

- [ ] **Step 2: Run failing sync service tests**

Run:

```sh
npm run test -- src/features/sync/server/sync-service.test.ts
```

Expected: fail because `sync-service.ts` does not exist.

- [ ] **Step 3: Add backup service wrappers for sync**

Modify `src/features/backup/server/backup-service.ts` by adding these exports:

```ts
export async function restoreValidatedBackupData(
  db: Db,
  backup: BackupFile,
): Promise<BackupSummary> {
  validateBackupReferences(backup.data)
  const summary = createBackupSummary(backup)

  await clearAndRestoreBackupData(db, backup.data)

  return summary
}
```

Keep existing `restoreFullBackup(db, input)` behavior unchanged and implement it by parsing the unknown input, then calling `restoreValidatedBackupData(db, backup)`.

- [ ] **Step 4: Implement sync service factory**

Create `src/features/sync/server/sync-service.ts` with dependency injection:

```ts
import type { BackupFile, BackupSummary } from '@/features/backup'
import {
  exportFullBackup,
  restoreValidatedBackupData,
} from '@/features/backup/server/backup-service'
import { createGitHubGistClient, type GitHubGistClient } from '@/lib/github'
import type { Db } from '@/platform/db'
import { flushDbSnapshot } from '@/platform/db'
import {
  deleteSecret,
  getSecretStatus,
  readSecret,
  saveSecret,
  type SecretStatus,
} from '@/platform/secrets'

import type {
  SyncActionResult,
  SerializedSyncStatus,
} from '../api/sync-contracts'
import {
  defaultSyncMetadata,
  markLocalDataChanged,
  readSyncMetadata,
  writeSyncMetadata,
  type SyncMetadata,
} from '../data/sync-metadata-store'
import { createSyncConflict } from '../domain/sync-conflict'
import {
  buildSyncEnvelope,
  parseSyncEnvelopeForCurrentApp,
} from '../domain/sync-envelope'

type GitHubGistSummary = Awaited<ReturnType<GitHubGistClient['getGist']>>

export function createSyncService(deps: SyncServiceDependencies) {
  let syncInProgress = false

  async function getStatus(): Promise<SerializedSyncStatus> {
    const [metadata, tokenStatus] = await Promise.all([
      deps.readMetadata(),
      deps.getTokenStatus(),
    ])

    return createStatus(metadata, tokenStatus, syncInProgress)
  }

  async function validateGithubToken(token: string): Promise<SyncActionResult> {
    const client = deps.createGitHubClient(token)
    await client.validateToken()

    return {
      status: await getStatus(),
      message: 'GitHub token validated.',
    }
  }

  async function saveGithubToken(token: string): Promise<SyncActionResult> {
    const client = deps.createGitHubClient(token)
    await client.validateToken()
    await deps.saveToken(token)

    return {
      status: await getStatus(),
      message: 'GitHub token saved.',
    }
  }

  async function deleteGithubToken(): Promise<SyncActionResult> {
    await deps.deleteToken()
    await deps.writeMetadata({
      enabled: false,
      lastError: null,
      conflict: null,
    })

    return {
      status: await getStatus(),
      message: 'GitHub token deleted.',
    }
  }

  async function createGithubGist(): Promise<SyncActionResult> {
    return runExclusive(async () => {
      const client = await readConfiguredClient()
      const content = await createLocalEnvelopeContent()
      const gist = await client.createSyncGist(content)
      await recordPush(gist, 'GitHub Gist created.')

      return {
        status: await getStatus(),
        message: 'GitHub Gist created.',
      }
    })
  }

  async function connectGithubGist(gistId: string): Promise<SyncActionResult> {
    return runExclusive(async () => {
      const client = await readConfiguredClient()
      const gist = await client.getGist(gistId)
      const metadata = await deps.readMetadata()

      await deps.writeMetadata({
        enabled: true,
        gistId,
        lastRemoteVersion: gist.remoteVersion,
        lastRemoteUpdatedAt: gist.updatedAt,
        lastError: null,
      })

      if (!gist.content) {
        return createGithubGist()
      }

      if (!metadata.dirtySinceLastSync && !metadata.localDataUpdatedAt) {
        await pullRemote(gist)
        return {
          status: await getStatus(),
          message: 'GitHub Gist connected and pulled.',
        }
      }

      await deps.writeMetadata({
        conflict: createSyncConflict({
          detectedAt: deps.now(),
          localDataUpdatedAt: metadata.localDataUpdatedAt,
          remoteUpdatedAt: gist.updatedAt,
          remoteVersion: gist.remoteVersion,
        }),
      })

      return {
        status: await getStatus(),
        message: 'Choose whether to pull remote data or push local data.',
      }
    })
  }

  async function setEnabled(enabled: boolean): Promise<SyncActionResult> {
    await deps.writeMetadata({ enabled })

    return {
      status: await getStatus(),
      message: enabled ? 'GitHub sync enabled.' : 'GitHub sync disabled.',
    }
  }

  async function checkOnOpen(): Promise<SyncActionResult | null> {
    return runExclusive(async () => syncCore('open'))
  }

  async function syncNow(): Promise<SyncActionResult | null> {
    return runExclusive(async () => syncCore('manual'))
  }

  async function syncAfterMutation(): Promise<null> {
    try {
      await runExclusive(async () => syncCore('mutation'))
    } catch (error) {
      await recordError(error, true)
    }

    return null
  }

  async function resolveConflict(resolution: 'pull-remote' | 'push-local') {
    return runExclusive(async () => {
      const metadata = await deps.readMetadata()
      if (!metadata.gistId) {
        throw new Error('GitHub Gist is not configured.')
      }
      const client = await readConfiguredClient()

      if (resolution === 'pull-remote') {
        const gist = await client.getGist(metadata.gistId)
        await pullRemote(gist)
        return {
          status: await getStatus(),
          message: 'Remote data pulled.',
        }
      }

      const content = await createLocalEnvelopeContent()
      const gist = await client.updateSyncGist(metadata.gistId, content)
      await recordPush(gist, 'Local data pushed.')
      return {
        status: await getStatus(),
        message: 'Local data pushed.',
      }
    })
  }

  async function syncCore(reason: 'manual' | 'mutation' | 'open') {
    const metadata = await deps.readMetadata()

    if (!metadata.enabled || !metadata.gistId || metadata.conflict) {
      return null
    }

    const client = await readConfiguredClient()
    const remote = await client.getGist(metadata.gistId)

    if (
      remote.remoteVersion &&
      remote.remoteVersion !== metadata.lastRemoteVersion
    ) {
      if (metadata.dirtySinceLastSync) {
        await deps.writeMetadata({
          conflict: createSyncConflict({
            detectedAt: deps.now(),
            localDataUpdatedAt: metadata.localDataUpdatedAt,
            remoteUpdatedAt: remote.updatedAt,
            remoteVersion: remote.remoteVersion,
          }),
          lastError: null,
        })
        return {
          status: await getStatus(),
          message: 'Sync conflict detected.',
        }
      }

      await pullRemote(remote)
      return {
        status: await getStatus(),
        message: 'Remote data pulled.',
      }
    }

    if (metadata.dirtySinceLastSync) {
      const content = await createLocalEnvelopeContent()
      const updated = await client.updateSyncGist(metadata.gistId, content)
      await recordPush(updated, 'Local data pushed.')
      return {
        status: await getStatus(),
        message: 'Local data pushed.',
      }
    }

    await deps.writeMetadata({
      lastSyncAt: deps.now().toISOString(),
      lastSyncDirection: 'no-change',
      lastError: null,
    })

    return reason === 'manual'
      ? { status: await getStatus(), message: 'Already in sync.' }
      : null
  }

  async function pullRemote(gist: GitHubGistSummary) {
    if (!gist.content) {
      throw new Error('GitHub Gist does not contain CogniPace sync data.')
    }

    const envelope = parseSyncEnvelopeForCurrentApp(JSON.parse(gist.content))
    await deps.restoreFullBackup(envelope.backup)
    await deps.flushDbSnapshot()
    await deps.broadcastInvalidation()
    await deps.writeMetadata({
      enabled: true,
      gistId: gist.id,
      lastSyncAt: deps.now().toISOString(),
      lastSyncDirection: 'pull',
      lastRemoteVersion: gist.remoteVersion,
      lastRemoteUpdatedAt: gist.updatedAt,
      localDataUpdatedAt: envelope.dataUpdatedAt,
      dirtySinceLastSync: false,
      conflict: null,
      lastError: null,
    })
  }

  async function recordPush(gist: GitHubGistSummary, _message: string) {
    await deps.writeMetadata({
      enabled: true,
      gistId: gist.id,
      lastSyncAt: deps.now().toISOString(),
      lastSyncDirection: 'push',
      lastRemoteVersion: gist.remoteVersion,
      lastRemoteUpdatedAt: gist.updatedAt,
      dirtySinceLastSync: false,
      conflict: null,
      lastError: null,
    })
  }

  async function createLocalEnvelopeContent() {
    const metadata = await deps.readMetadata()
    const dataUpdatedAt =
      metadata.localDataUpdatedAt ?? deps.now().toISOString()
    const backup = await deps.exportFullBackup()

    return JSON.stringify(
      buildSyncEnvelope({
        backup,
        dataUpdatedAt,
        exportedAt: deps.now(),
      }),
      null,
      2,
    )
  }

  async function readConfiguredClient() {
    const token = await deps.readToken()
    if (!token) {
      throw new Error('GitHub token is not configured.')
    }
    return deps.createGitHubClient(token)
  }

  async function recordError(error: unknown, retryable: boolean) {
    await deps.writeMetadata({
      lastError: {
        kind: classifySyncError(error),
        message: error instanceof Error ? error.message : String(error),
        occurredAt: deps.now().toISOString(),
        retryable,
      },
    })
  }

  async function runExclusive<T>(work: () => Promise<T>) {
    if (syncInProgress) {
      throw new Error('Sync already in progress.')
    }

    syncInProgress = true
    try {
      return await work()
    } catch (error) {
      await recordError(error, true)
      throw error
    } finally {
      syncInProgress = false
    }
  }

  return {
    checkOnOpen,
    connectGithubGist,
    createGithubGist,
    deleteGithubToken,
    getStatus,
    resolveConflict,
    saveGithubToken,
    setEnabled,
    syncAfterMutation,
    syncNow,
    validateGithubToken,
  }
}

export function createBackgroundSyncService(
  db: Db,
  broadcastInvalidation: () => Promise<unknown>,
) {
  return createSyncService({
    readToken: () => readSecret('github:gist'),
    saveToken: (token) => saveSecret('github:gist', token),
    deleteToken: () => deleteSecret('github:gist'),
    getTokenStatus: () => getSecretStatus('github:gist'),
    createGitHubClient: (token) => createGitHubGistClient({ token }),
    readMetadata: readSyncMetadata,
    writeMetadata: writeSyncMetadata,
    exportFullBackup: () => exportFullBackup(db),
    restoreFullBackup: (backup) => restoreValidatedBackupData(db, backup),
    flushDbSnapshot,
    broadcastInvalidation,
    now: () => new Date(),
  })
}

export function markSyncLocalDataChanged(now = new Date()) {
  return markLocalDataChanged(now)
}

type SyncServiceDependencies = {
  readToken: () => Promise<string | null>
  saveToken: (token: string) => Promise<unknown>
  deleteToken: () => Promise<unknown>
  getTokenStatus: () => Promise<SecretStatus>
  createGitHubClient: (token: string) => GitHubGistClient
  readMetadata: () => Promise<SyncMetadata>
  writeMetadata: (patch: Partial<SyncMetadata>) => Promise<SyncMetadata>
  exportFullBackup: () => Promise<BackupFile>
  restoreFullBackup: (backup: BackupFile) => Promise<BackupSummary>
  flushDbSnapshot: () => Promise<unknown>
  broadcastInvalidation: () => Promise<unknown> | unknown
  now: () => Date
}

function createStatus(
  metadata: SyncMetadata,
  tokenStatus: SecretStatus,
  isSyncing: boolean,
): SerializedSyncStatus {
  return {
    enabled: metadata.enabled,
    configured: tokenStatus.configured && Boolean(metadata.gistId),
    tokenConfigured: tokenStatus.configured,
    tokenStatus,
    gistId: metadata.gistId,
    isSyncing,
    lastSyncAt: metadata.lastSyncAt,
    lastSyncDirection: metadata.lastSyncDirection,
    lastError: metadata.lastError,
    conflict: metadata.conflict,
  }
}

function classifySyncError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase()
  if (
    message.includes('credential') ||
    message.includes('token') ||
    message.includes('auth')
  )
    return 'auth'
  if (message.includes('rate limit') || message.includes('429'))
    return 'rate-limit'
  if (message.includes('not found') || message.includes('404'))
    return 'gist-missing'
  if (message.includes('unsupported')) return 'schema-unsupported'
  if (message.includes('sync file') || message.includes('json'))
    return 'remote-invalid'
  return 'unknown'
}
```

- [ ] **Step 5: Run sync service tests**

Run:

```sh
npm run test -- src/features/sync/server/sync-service.test.ts
```

Expected: pass after imports and lint issues are resolved.

- [ ] **Step 6: Commit sync service**

```sh
git add src/features/sync/server src/features/backup/server/backup-service.ts
git commit -m "feat: add github sync service"
```

## Task 6: Runtime Integration And Mutation Sync Scheduling

**Files:**

- Modify: `src/extension/messaging.ts`
- Modify: `src/extension/background/runtime-policy.ts`
- Modify: `src/extension/background/register-handlers.ts`
- Modify: `src/extension/background/runtime-policy.test.ts`
- Modify: `src/extension/background/register-handlers.test.ts`
- Modify: `src/features/sync/index.ts`

- [ ] **Step 1: Add sync feature API/domain exports**

Create or update `src/features/sync/index.ts`:

```ts
export {
  syncActionResultSchema,
  syncGithubGistRequestSchema,
  syncGithubTokenRequestSchema,
  syncRequestSchema,
  syncResolveConflictRequestSchema,
  syncSetEnabledRequestSchema,
  syncStatusSchema,
} from './api/sync-contracts'
export type {
  SerializedSyncStatus,
  SyncActionResult,
  SyncGithubGistRequest,
  SyncGithubTokenRequest,
  SyncRequest,
  SyncResolveConflictRequest,
  SyncSetEnabledRequest,
} from './api/sync-contracts'
```

- [ ] **Step 2: Add sync protocol to messaging**

Modify `src/extension/messaging.ts`:

```ts
import type {
  SerializedSyncStatus,
  SyncActionResult,
  SyncGithubGistRequest,
  SyncGithubTokenRequest,
  SyncRequest,
  SyncResolveConflictRequest,
  SyncSetEnabledRequest,
} from '@/features/sync'
export {
  syncActionResultSchema,
  syncGithubGistRequestSchema,
  syncGithubTokenRequestSchema,
  syncRequestSchema,
  syncResolveConflictRequestSchema,
  syncSetEnabledRequestSchema,
  syncStatusSchema,
} from '@/features/sync'
```

Add to `ProtocolMap`:

```ts
'sync.getStatus'(request: SyncRequest): SerializedSyncStatus
'sync.validateGithubToken'(request: SyncGithubTokenRequest): SyncActionResult
'sync.saveGithubToken'(request: SyncGithubTokenRequest): SyncActionResult
'sync.deleteGithubToken'(request: SyncRequest): SyncActionResult
'sync.createGithubGist'(request: SyncRequest): SyncActionResult
'sync.connectGithubGist'(request: SyncGithubGistRequest): SyncActionResult
'sync.setEnabled'(request: SyncSetEnabledRequest): SyncActionResult
'sync.checkOnOpen'(request: SyncRequest): SyncActionResult | null
'sync.syncNow'(request: SyncRequest): SyncActionResult | null
'sync.resolveConflict'(request: SyncResolveConflictRequest): SyncActionResult
```

- [ ] **Step 3: Update runtime policy tests**

Add assertions to `src/extension/background/runtime-policy.test.ts`:

```ts
expect(canCallExtensionMethod('sync.getStatus', 'dashboard')).toBe(true)
expect(canCallExtensionMethod('sync.getStatus', 'popup')).toBe(true)
expect(canCallExtensionMethod('sync.getStatus', 'content-script')).toBe(true)
expect(canCallExtensionMethod('sync.saveGithubToken', 'dashboard')).toBe(true)
expect(canCallExtensionMethod('sync.saveGithubToken', 'popup')).toBe(false)
expect(canCallExtensionMethod('sync.checkOnOpen', 'content-script')).toBe(true)
expect(canCallExtensionMethod('sync.resolveConflict', 'dashboard')).toBe(true)
expect(canCallExtensionMethod('sync.resolveConflict', 'content-script')).toBe(
  false,
)
```

- [ ] **Step 4: Update runtime policy**

Modify `methodSurfaceAccess` in `src/extension/background/runtime-policy.ts`:

```ts
'sync.getStatus': ['popup', 'dashboard', 'content-script'],
'sync.validateGithubToken': ['dashboard'],
'sync.saveGithubToken': ['dashboard'],
'sync.deleteGithubToken': ['dashboard'],
'sync.createGithubGist': ['dashboard'],
'sync.connectGithubGist': ['dashboard'],
'sync.setEnabled': ['dashboard'],
'sync.checkOnOpen': ['popup', 'dashboard', 'content-script'],
'sync.syncNow': ['dashboard'],
'sync.resolveConflict': ['dashboard'],
```

- [ ] **Step 5: Register sync handlers**

Modify `src/extension/background/register-handlers.ts` imports:

```ts
import {
  syncActionResultSchema,
  syncGithubGistRequestSchema,
  syncGithubTokenRequestSchema,
  syncRequestSchema,
  syncResolveConflictRequestSchema,
  syncSetEnabledRequestSchema,
  syncStatusSchema,
} from '@/extension/messaging'
import {
  createBackgroundSyncService,
  markSyncLocalDataChanged,
} from '@/features/sync/server/sync-service'
```

Add helper:

```ts
function createSyncServiceForDb(db: Db) {
  return createBackgroundSyncService(db, () =>
    broadcastDataManagementInvalidation('dashboard'),
  )
}
```

Register handlers before feature mutation handlers:

```ts
onMessage('sync.getStatus', ({ data, sender }) => {
  const request = syncRequestSchema.parse(data)
  assertCanSenderCallExtensionMethod('sync.getStatus', request.surface, sender)
  return getAppDb().then(async ({ db }) =>
    syncStatusSchema.parse(await createSyncServiceForDb(db).getStatus()),
  )
})
```

Repeat the same parse-authorize-service-parse shape for the remaining sync methods. Each dashboard action result must be parsed with `syncActionResultSchema`. `sync.checkOnOpen` and `sync.syncNow` may return `null`; when non-null, parse with `syncActionResultSchema`.

- [ ] **Step 6: Add mutation dirty marking and async sync scheduling**

Modify `runDbMutation` in `src/extension/background/register-handlers.ts`:

```ts
type DbMutationSyncMode = 'mark-dirty' | 'none'

function runDbMutation<T>(
  write: (db: Db) => Promise<T>,
  afterFlush?: (result: T) => unknown,
  options: { syncMode?: DbMutationSyncMode } = {},
) {
  const syncMode = options.syncMode ?? 'mark-dirty'
  const queued = dbMutationQueue.then(async () => {
    const { db } = await getAppDb()
    const result = await write(db)

    if (syncMode === 'mark-dirty') {
      await markSyncLocalDataChanged()
    }

    await flushDbSnapshot()
    await afterFlush?.(result)

    if (syncMode === 'mark-dirty') {
      scheduleSyncAfterMutation(db)
    }

    return result
  })
```

Add debounced scheduler in the same file:

```ts
let syncAfterMutationTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSyncAfterMutation(db: Db) {
  if (syncAfterMutationTimer) {
    clearTimeout(syncAfterMutationTimer)
  }

  syncAfterMutationTimer = setTimeout(() => {
    syncAfterMutationTimer = null
    void createSyncServiceForDb(db).syncAfterMutation()
  }, 500)
}
```

Sync pull and pull-based conflict resolution are handled by `createBackgroundSyncService` from Task 5. Do not route those restores through `runDbMutation`; the sync service restores the backup, flushes the DB snapshot, broadcasts invalidation, and records clean sync metadata without calling `markSyncLocalDataChanged`.

- [ ] **Step 7: Run runtime tests**

Run:

```sh
npm run test -- src/extension/background/runtime-policy.test.ts src/extension/background/register-handlers.test.ts
```

Expected: pass.

- [ ] **Step 8: Commit runtime integration**

```sh
git add src/extension src/features/sync/index.ts
git commit -m "feat: wire sync runtime handlers"
```

## Task 7: Sync API Hooks And Settings UI

**Files:**

- Create: `src/features/sync/api/sync-api.ts`
- Create: `src/features/sync/api/sync-api.test.tsx`
- Create: `src/features/sync/hooks/use-github-sync-controller.ts`
- Create: `src/features/sync/components/github-sync-panel.tsx`
- Create: `src/features/sync/components/github-sync-panel.test.tsx`
- Create: `src/features/sync/components/github-sync-settings-section.tsx`
- Create: `src/features/sync/components/github-sync-settings-section.test.tsx`
- Modify: `src/app/providers/query-client.ts`
- Modify: `src/platform/query/cache-invalidation.ts`
- Modify: `src/platform/query/query-keys.ts`
- Modify: `src/features/sync/index.ts`
- Modify: `src/features/backup/components/data-management-screen.tsx`
- Modify: `src/features/backup/components/data-management-screen.test.tsx`

- [ ] **Step 1: Write failing sync API hook tests**

Create `src/features/sync/api/sync-api.test.tsx`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'

import {
  checkSyncOnOpenViaRuntime,
  connectGithubGistViaRuntime,
  saveGithubTokenViaRuntime,
} from './sync-api'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('sync API', () => {
  it('sends token saves through the dashboard runtime boundary', async () => {
    vi.mocked(sendMessage).mockResolvedValue({ ok: true })

    await saveGithubTokenViaRuntime('ghp_secret')

    expect(sendMessage).toHaveBeenCalledWith('sync.saveGithubToken', {
      surface: 'dashboard',
      token: 'ghp_secret',
    })
  })

  it('sends existing Gist connection through the runtime boundary', async () => {
    vi.mocked(sendMessage).mockResolvedValue({ ok: true })

    await connectGithubGistViaRuntime('gist_1')

    expect(sendMessage).toHaveBeenCalledWith('sync.connectGithubGist', {
      surface: 'dashboard',
      gistId: 'gist_1',
    })
  })

  it('allows safe sync checks from non-dashboard surfaces', async () => {
    vi.mocked(sendMessage).mockResolvedValue(null)

    await checkSyncOnOpenViaRuntime('content-script')

    expect(sendMessage).toHaveBeenCalledWith('sync.checkOnOpen', {
      surface: 'content-script',
    })
  })
})
```

- [ ] **Step 2: Set TanStack Query defaults for local-first extension runtime calls**

Modify `src/app/providers/query-client.ts`:

```ts
import { QueryClient } from '@tanstack/react-query'

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'offlineFirst',
        retry: 1,
        staleTime: 30_000,
      },
      mutations: {
        networkMode: 'offlineFirst',
      },
    },
  })
}
```

Expected: local extension runtime reads and local-first mutations execute while offline; GitHub sync network errors are produced by the background sync service and returned as sync status.

- [ ] **Step 3: Implement sync API hooks**

Modify `src/platform/query/query-keys.ts`:

```ts
export const queryKeys = {
  appShell: {
    all: ['app-shell-data'] as const,
    popup: () => [...queryKeys.appShell.all, 'popup'] as const,
    dashboard: () => [...queryKeys.appShell.all, 'dashboard'] as const,
    overlay: (problemSlug?: string | null) =>
      [...queryKeys.appShell.all, 'overlay', problemSlug ?? null] as const,
  },
  practice: {
    all: ['practice-details'] as const,
    details: (problemSlug: string, at?: string | null) =>
      [...queryKeys.practice.all, problemSlug, at ?? null] as const,
  },
  problems: {
    all: ['problems'] as const,
    library: (at?: string | null) =>
      [...queryKeys.problems.all, 'library', at ?? 'now'] as const,
    edit: (problemSlug: string) =>
      [...queryKeys.problems.all, 'edit', problemSlug] as const,
  },
  queue: {
    all: ['today-queue'] as const,
    today: (at?: string | null) =>
      [...queryKeys.queue.all, at ?? 'now'] as const,
  },
  settings: {
    all: ['settings'] as const,
  },
  sync: {
    all: ['sync'] as const,
    status: (surface: string = 'dashboard') =>
      [...queryKeys.sync.all, 'status', surface] as const,
  },
  tracks: {
    all: ['tracks'] as const,
    active: (surface?: string | null) =>
      [...queryKeys.tracks.all, 'active', surface ?? null] as const,
    workspace: (at?: string | null) =>
      [...queryKeys.tracks.all, 'workspace', at ?? 'now'] as const,
    edit: (trackId?: string | null) =>
      [...queryKeys.tracks.all, 'edit', trackId ?? 'new'] as const,
  },
} as const
```

Modify `src/platform/query/cache-invalidation.ts`:

```ts
export const cacheInvalidationTags = [
  'app-shell',
  'practice',
  'problems',
  'queue',
  'settings',
  'sync',
  'tracks',
] as const
```

Add the sync entry to `queryKeysByInvalidationTag`:

```ts
sync: [queryKeys.sync.all],
```

Create `src/features/sync/api/sync-api.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { sendMessage, type UiSurface } from '@/extension/messaging'
import {
  invalidateTaggedQueries,
  type CacheInvalidationTag,
} from '@/platform/query/cache-invalidation'
import { queryKeys } from '@/platform/query/query-keys'

export const syncQueryKeys = queryKeys.sync

const broadSyncInvalidationTags = [
  'settings',
  'problems',
  'practice',
  'queue',
  'tracks',
  'app-shell',
] as const satisfies readonly CacheInvalidationTag[]

export function getSyncStatusViaRuntime(surface: UiSurface = 'dashboard') {
  return sendMessage('sync.getStatus', { surface })
}

export function validateGithubTokenViaRuntime(token: string) {
  return sendMessage('sync.validateGithubToken', {
    surface: 'dashboard',
    token,
  })
}

export function saveGithubTokenViaRuntime(token: string) {
  return sendMessage('sync.saveGithubToken', { surface: 'dashboard', token })
}

export function deleteGithubTokenViaRuntime() {
  return sendMessage('sync.deleteGithubToken', { surface: 'dashboard' })
}

export function createGithubGistViaRuntime() {
  return sendMessage('sync.createGithubGist', { surface: 'dashboard' })
}

export function connectGithubGistViaRuntime(gistId: string) {
  return sendMessage('sync.connectGithubGist', { surface: 'dashboard', gistId })
}

export function setSyncEnabledViaRuntime(enabled: boolean) {
  return sendMessage('sync.setEnabled', { surface: 'dashboard', enabled })
}

export function syncNowViaRuntime() {
  return sendMessage('sync.syncNow', { surface: 'dashboard' })
}

export function resolveSyncConflictViaRuntime(
  resolution: 'pull-remote' | 'push-local',
) {
  return sendMessage('sync.resolveConflict', {
    surface: 'dashboard',
    resolution,
  })
}

export function checkSyncOnOpenViaRuntime(surface: UiSurface) {
  return sendMessage('sync.checkOnOpen', { surface })
}

export function useSyncStatus() {
  return useQuery({
    queryKey: syncQueryKeys.status('dashboard'),
    queryFn: () => getSyncStatusViaRuntime('dashboard'),
  })
}

export function useSyncAction<TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  options: { invalidateData?: boolean } = {},
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: syncQueryKeys.all })
      if (options.invalidateData) {
        invalidateTaggedQueries(queryClient, broadSyncInvalidationTags)
      }
    },
  })
}
```

- [ ] **Step 4: Implement sync controller hook**

Create `src/features/sync/hooks/use-github-sync-controller.ts`:

```ts
import {
  connectGithubGistViaRuntime,
  createGithubGistViaRuntime,
  deleteGithubTokenViaRuntime,
  resolveSyncConflictViaRuntime,
  saveGithubTokenViaRuntime,
  syncNowViaRuntime,
  useSyncAction,
  useSyncStatus,
  validateGithubTokenViaRuntime,
} from '../api/sync-api'
import type { GitHubSyncPanelActions } from '../components/github-sync-panel'

export function useGithubSyncController() {
  const status = useSyncStatus()
  const validateToken = useSyncAction((token: string) =>
    validateGithubTokenViaRuntime(token),
  )
  const saveToken = useSyncAction((token: string) =>
    saveGithubTokenViaRuntime(token),
  )
  const createGist = useSyncAction(() => createGithubGistViaRuntime())
  const connectGist = useSyncAction((gistId: string) =>
    connectGithubGistViaRuntime(gistId),
  )
  const deleteToken = useSyncAction(() => deleteGithubTokenViaRuntime())
  const syncNow = useSyncAction(() => syncNowViaRuntime(), {
    invalidateData: true,
  })
  const resolveConflict = useSyncAction(
    (resolution: 'pull-remote' | 'push-local') =>
      resolveSyncConflictViaRuntime(resolution),
    {
      invalidateData: true,
    },
  )

  const actions = {
    onConnectGist: (gistId) => connectGist.mutateAsync(gistId),
    onCreateGist: () => createGist.mutateAsync(),
    onDeleteToken: () => deleteToken.mutateAsync(),
    onResolveConflict: (resolution) => resolveConflict.mutateAsync(resolution),
    onSaveToken: (token) => saveToken.mutateAsync(token),
    onSyncNow: () => syncNow.mutateAsync(),
    onValidateToken: (token) => validateToken.mutateAsync(token),
  } satisfies GitHubSyncPanelActions

  return {
    actions,
    isLoading: status.isPending,
    isPending:
      validateToken.isPending ||
      saveToken.isPending ||
      createGist.isPending ||
      connectGist.isPending ||
      deleteToken.isPending ||
      syncNow.isPending ||
      resolveConflict.isPending,
    status: status.data ?? null,
  }
}
```

- [ ] **Step 5: Write failing panel workflow test**

Create `src/features/sync/components/github-sync-panel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { GitHubSyncPanel } from './github-sync-panel'

describe('GitHubSyncPanel', () => {
  it('saves a token and creates a Gist from the not configured state', async () => {
    const user = userEvent.setup()
    const onSaveToken = vi.fn().mockResolvedValue(undefined)
    const onCreateGist = vi.fn().mockResolvedValue(undefined)

    render(
      <GitHubSyncPanel
        actions={{
          onConnectGist: vi.fn(),
          onCreateGist,
          onDeleteToken: vi.fn(),
          onResolveConflict: vi.fn(),
          onSaveToken,
          onSyncNow: vi.fn(),
          onValidateToken: vi.fn(),
        }}
        status={{
          enabled: false,
          configured: false,
          tokenConfigured: false,
          tokenStatus: {
            provider: 'github:gist',
            configured: false,
            updatedAt: null,
            fingerprint: null,
          },
          gistId: null,
          isSyncing: false,
          lastSyncAt: null,
          lastSyncDirection: null,
          lastError: null,
          conflict: null,
        }}
      />,
    )

    await user.type(screen.getByLabelText(/GitHub token/i), 'ghp_secret')
    await user.click(screen.getByRole('button', { name: /Save token/i }))
    await user.click(
      screen.getByRole('button', { name: /Create private Gist/i }),
    )

    expect(onSaveToken).toHaveBeenCalledWith('ghp_secret')
    expect(onCreateGist).toHaveBeenCalled()
  })

  it('shows conflict resolution actions without auto choosing a destructive action', () => {
    render(
      <GitHubSyncPanel
        actions={{
          onConnectGist: vi.fn(),
          onCreateGist: vi.fn(),
          onDeleteToken: vi.fn(),
          onResolveConflict: vi.fn(),
          onSaveToken: vi.fn(),
          onSyncNow: vi.fn(),
          onValidateToken: vi.fn(),
        }}
        status={{
          enabled: true,
          configured: true,
          tokenConfigured: true,
          tokenStatus: {
            provider: 'github:gist',
            configured: true,
            updatedAt: '2026-05-26T12:00:00.000Z',
            fingerprint: 'abcdef123456',
          },
          gistId: 'gist_1',
          isSyncing: false,
          lastSyncAt: '2026-05-26T12:00:00.000Z',
          lastSyncDirection: 'push',
          lastError: null,
          conflict: {
            detectedAt: '2026-05-26T12:10:00.000Z',
            localDataUpdatedAt: '2026-05-26T12:08:00.000Z',
            remoteUpdatedAt: '2026-05-26T12:09:00.000Z',
            remoteVersion: 'remote_2',
          },
        }}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/conflict/i)
    expect(screen.getByRole('button', { name: /Pull remote/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Push local/i })).toBeEnabled()
  })
})
```

- [ ] **Step 6: Implement GitHub sync panel**

Create `src/features/sync/components/github-sync-panel.tsx`:

```tsx
import { Loader2, RefreshCw, Trash2, UploadCloud } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { InlineStatus } from '@/components/ui/inline-status'
import { Surface } from '@/components/ui/surface'

import type { SerializedSyncStatus } from '../api/sync-contracts'

export interface GitHubSyncPanelActions {
  onConnectGist: (gistId: string) => Promise<unknown> | unknown
  onCreateGist: () => Promise<unknown> | unknown
  onDeleteToken: () => Promise<unknown> | unknown
  onResolveConflict: (
    resolution: 'pull-remote' | 'push-local',
  ) => Promise<unknown> | unknown
  onSaveToken: (token: string) => Promise<unknown> | unknown
  onSyncNow: () => Promise<unknown> | unknown
  onValidateToken: (token: string) => Promise<unknown> | unknown
}

export function GitHubSyncPanel({
  actions,
  isPending = false,
  status,
}: {
  actions: GitHubSyncPanelActions
  isPending?: boolean | undefined
  status: SerializedSyncStatus
}) {
  const [token, setToken] = useState('')
  const [gistId, setGistId] = useState(status.gistId ?? '')

  return (
    <Surface aria-labelledby="github-sync-title" className="grid gap-4">
      <header className="grid gap-1">
        <h2
          className="m-0 text-[length:var(--cp-title-font-size)] font-bold leading-tight"
          id="github-sync-title"
        >
          GitHub Sync
        </h2>
        <p className="m-0 text-[length:var(--cp-copy-font-size)] text-muted-foreground">
          Sync local CogniPace data through a private GitHub Gist.
        </p>
      </header>

      <SyncStatusBlock status={status} />

      <div className="grid gap-2">
        <label
          className="text-[length:var(--cp-copy-font-size)] font-semibold"
          htmlFor="github-sync-token"
        >
          GitHub token
        </label>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <input
            className="min-w-[16rem] flex-1 rounded-[var(--cp-control-radius)] border border-border bg-background px-3 py-2 text-[length:var(--cp-copy-font-size)]"
            id="github-sync-token"
            onChange={(event) => setToken(event.currentTarget.value)}
            placeholder="ghp_..."
            type="password"
            value={token}
          />
          <Button
            disabled={isPending || !token.trim()}
            onClick={() => void actions.onSaveToken(token)}
            size="sm"
          >
            {isPending ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : null}
            Save token
          </Button>
          <Button
            disabled={isPending || !token.trim()}
            onClick={() => void actions.onValidateToken(token)}
            size="sm"
            variant="outline"
          >
            Test token
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <label
          className="text-[length:var(--cp-copy-font-size)] font-semibold"
          htmlFor="github-sync-gist"
        >
          Gist ID
        </label>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <input
            className="min-w-[16rem] flex-1 rounded-[var(--cp-control-radius)] border border-border bg-background px-3 py-2 text-[length:var(--cp-copy-font-size)]"
            id="github-sync-gist"
            onChange={(event) => setGistId(event.currentTarget.value)}
            placeholder="Existing Gist ID"
            value={gistId}
          />
          <Button
            disabled={isPending || !gistId.trim() || !status.tokenConfigured}
            onClick={() => void actions.onConnectGist(gistId)}
            size="sm"
            variant="outline"
          >
            Connect Gist
          </Button>
          <Button
            disabled={isPending || !status.tokenConfigured}
            onClick={() => void actions.onCreateGist()}
            size="sm"
            variant="outline"
          >
            <UploadCloud aria-hidden="true" />
            Create private Gist
          </Button>
        </div>
      </div>

      {status.conflict ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={isPending}
            onClick={() => void actions.onResolveConflict('pull-remote')}
            size="sm"
            variant="outline"
          >
            Pull remote
          </Button>
          <Button
            disabled={isPending}
            onClick={() => void actions.onResolveConflict('push-local')}
            size="sm"
            variant="outline"
          >
            Push local
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={isPending || !status.configured}
            onClick={() => void actions.onSyncNow()}
            size="sm"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" />
            Sync now
          </Button>
          <Button
            disabled={isPending || !status.tokenConfigured}
            onClick={() => void actions.onDeleteToken()}
            size="sm"
            variant="ghost"
          >
            <Trash2 aria-hidden="true" />
            Delete token
          </Button>
        </div>
      )}
    </Surface>
  )
}

function SyncStatusBlock({ status }: { status: SerializedSyncStatus }) {
  if (status.conflict) {
    return (
      <InlineStatus role="alert" tone="danger">
        Sync conflict detected. Choose whether to pull remote data or push local
        data.
      </InlineStatus>
    )
  }

  if (status.lastError) {
    return (
      <InlineStatus role="alert" tone="danger">
        {status.lastError.message}
      </InlineStatus>
    )
  }

  if (!status.tokenConfigured) {
    return <InlineStatus>Add a GitHub token to enable Gist sync.</InlineStatus>
  }

  if (!status.gistId) {
    return (
      <InlineStatus>Create or connect a private CogniPace Gist.</InlineStatus>
    )
  }

  return (
    <InlineStatus tone="success">
      {status.lastSyncAt
        ? `Last sync: ${status.lastSyncDirection ?? 'sync'} at ${status.lastSyncAt}`
        : 'GitHub sync is ready.'}
    </InlineStatus>
  )
}
```

- [ ] **Step 7: Add sync settings section container**

Create `src/features/sync/components/github-sync-settings-section.tsx`:

```tsx
import { useGithubSyncController } from '../hooks/use-github-sync-controller'

import { GitHubSyncPanel } from './github-sync-panel'

export function GitHubSyncSettingsSection() {
  const sync = useGithubSyncController()

  if (!sync.status) {
    return null
  }

  return (
    <GitHubSyncPanel
      actions={sync.actions}
      isPending={sync.isPending || sync.isLoading}
      status={sync.status}
    />
  )
}
```

Create `src/features/sync/components/github-sync-settings-section.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useGithubSyncController } from '../hooks/use-github-sync-controller'

import { GitHubSyncSettingsSection } from './github-sync-settings-section'

vi.mock('../hooks/use-github-sync-controller', () => ({
  useGithubSyncController: vi.fn(),
}))

describe('GitHubSyncSettingsSection', () => {
  it('renders the sync panel from the sync-owned controller hook', () => {
    vi.mocked(useGithubSyncController).mockReturnValue({
      actions: {
        onConnectGist: vi.fn(),
        onCreateGist: vi.fn(),
        onDeleteToken: vi.fn(),
        onResolveConflict: vi.fn(),
        onSaveToken: vi.fn(),
        onSyncNow: vi.fn(),
        onValidateToken: vi.fn(),
      },
      isLoading: false,
      isPending: false,
      status: {
        enabled: false,
        configured: false,
        tokenConfigured: false,
        tokenStatus: {
          provider: 'github:gist',
          configured: false,
          updatedAt: null,
          fingerprint: null,
        },
        gistId: null,
        isSyncing: false,
        lastSyncAt: null,
        lastSyncDirection: null,
        lastError: null,
        conflict: null,
      },
    })

    render(<GitHubSyncSettingsSection />)

    expect(
      screen.getByRole('heading', { name: /GitHub Sync/i }),
    ).toBeInTheDocument()
  })
})
```

Add the public feature exports to `src/features/sync/index.ts`:

```ts
export { GitHubSyncSettingsSection } from './components/github-sync-settings-section'
export { GitHubSyncPanel } from './components/github-sync-panel'
export { useGithubSyncController } from './hooks/use-github-sync-controller'
```

- [ ] **Step 8: Wire sync section into Data Management**

Modify `src/features/backup/components/data-management-screen.tsx` imports:

```tsx
import { GitHubSyncSettingsSection } from '@/features/sync'
```

Render the sync section between backup restore and selective import:

```tsx
<GitHubSyncSettingsSection />
```

- [ ] **Step 9: Run API and panel tests**

Run:

```sh
npm run test -- src/features/sync/api/sync-api.test.tsx src/features/sync/components/github-sync-panel.test.tsx src/features/sync/components/github-sync-settings-section.test.tsx src/features/backup/components/data-management-screen.test.tsx
```

Expected: pass.

- [ ] **Step 10: Commit Settings UI**

```sh
git add src/app/providers/query-client.ts src/platform/query src/features/sync src/features/backup/components/data-management-screen.tsx src/features/backup/components/data-management-screen.test.tsx
git commit -m "feat: add github sync settings panel"
```

## Task 8: LeetCode API Migration To Platform HTTP

**Files:**

- Create: `src/lib/leetcode/api/leetcode-graphql-client.ts`
- Create: `src/lib/leetcode/api/problem-metadata-request.ts`
- Create: `src/lib/leetcode/api/problem-content-request.ts`
- Create: `src/lib/leetcode/api/submission-requests.ts`
- Create: `src/lib/leetcode/api/index.ts`
- Modify: `src/lib/leetcode/core/graphql-client.ts`
- Modify: `src/lib/leetcode/metadata/graphql-metadata-source.ts`
- Modify: `src/lib/leetcode/content/problem-content-reader.ts`
- Modify: `src/lib/leetcode/submission/submission-result-api-source.ts`
- Modify: `src/lib/leetcode/remote/leetcode-fetch-remote-client.ts`
- Modify: relevant tests under `src/lib/leetcode/**`

- [ ] **Step 1: Write failing LeetCode API request test**

Create `src/lib/leetcode/api/leetcode-api.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { createHttpClient } from '@/platform/http'

import { requestLeetCodeGraphQl } from './leetcode-graphql-client'
import { requestSubmissionCheck } from './submission-requests'

describe('LeetCode API requests', () => {
  it('sends GraphQL requests through platform http with csrf and credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: { question: { title: 'Two Sum' } } }),
        {
          status: 200,
        },
      ),
    )

    await requestLeetCodeGraphQl({
      httpClient: createHttpClient({ fetch: fetchMock }),
      locationUrl: 'https://leetcode.com/problems/two-sum/',
      query: 'query q { question { title } }',
      variables: {},
      csrfToken: 'csrf_1',
    })

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers
    expect(fetchMock).toHaveBeenCalledWith(
      'https://leetcode.com/graphql',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    )
    expect(headers.get('x-csrftoken')).toBe('csrf_1')
  })

  it('sends submission check requests through platform http', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ state: 'SUCCESS', status_code: 10 }), {
        status: 200,
      }),
    )

    await requestSubmissionCheck({
      httpClient: createHttpClient({ fetch: fetchMock }),
      locationUrl: 'https://leetcode.com/problems/two-sum/',
      submissionId: '123',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://leetcode.com/submissions/detail/123/check/',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    )
  })
})
```

- [ ] **Step 2: Run failing LeetCode API test**

Run:

```sh
npm run test -- src/lib/leetcode/api/leetcode-api.test.ts
```

Expected: fail because `src/lib/leetcode/api/*` modules do not exist.

- [ ] **Step 3: Implement LeetCode GraphQL request declaration**

Create `src/lib/leetcode/api/leetcode-graphql-client.ts`:

```ts
import {
  createGraphQlRequest,
  createHttpClient,
  type HttpClient,
} from '@/platform/http'

import { readCookieValue } from '../core/value-readers'

export type LeetCodeGraphQlRequestResult =
  | { ok: true; payload: unknown }
  | { ok: false; error: Error }

export async function requestLeetCodeGraphQl(options: {
  locationUrl: string
  query: string
  variables: Record<string, unknown>
  operationName?: string | undefined
  fetch?: typeof fetch | undefined
  document?: Document | undefined
  csrfToken?: string | null | undefined
  httpClient?: HttpClient | undefined
}): Promise<LeetCodeGraphQlRequestResult> {
  const csrfToken =
    options.csrfToken ??
    (options.document
      ? readCookieValue(options.document.cookie, 'csrftoken')
      : null)

  try {
    const response = await createGraphQlRequest({
      url: new URL('/graphql', options.locationUrl).toString(),
      query: options.query,
      variables: options.variables,
      operationName: options.operationName,
      credentials: 'include',
      headers: {
        ...(csrfToken ? { 'x-csrftoken': csrfToken } : {}),
      },
    })(options.httpClient ?? createHttpClient({ fetch: options.fetch }))

    return { ok: true, payload: response }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}
```

- [ ] **Step 4: Make old GraphQL import delegate to new module**

Modify `src/lib/leetcode/core/graphql-client.ts` to preserve current exports:

```ts
export {
  requestLeetCodeGraphQl,
  type LeetCodeGraphQlRequestResult,
} from '../api/leetcode-graphql-client'
export type LeetCodeGraphQlFetch = typeof fetch
```

- [ ] **Step 5: Implement submission REST request declarations**

Create `src/lib/leetcode/api/submission-requests.ts`:

```ts
import {
  createHttpClient,
  createRestRequest,
  type HttpClient,
} from '@/platform/http'

export function requestSubmissionList(input: {
  httpClient?: HttpClient | undefined
  fetch?: typeof fetch | undefined
  locationUrl: string
  slug: string
}) {
  return createRestRequest<unknown>({
    baseUrl: input.locationUrl,
    path: `/api/submissions/${input.slug}/`,
    method: 'GET',
    credentials: 'include',
    searchParams: {
      offset: '0',
      limit: '5',
    },
  })(input.httpClient ?? createHttpClient({ fetch: input.fetch }))
}

export function requestSubmissionCheck(input: {
  httpClient?: HttpClient | undefined
  fetch?: typeof fetch | undefined
  locationUrl: string
  submissionId: string
}) {
  return createRestRequest<unknown>({
    baseUrl: input.locationUrl,
    path: `/submissions/detail/${encodeURIComponent(input.submissionId)}/check/`,
    method: 'GET',
    credentials: 'include',
  })(input.httpClient ?? createHttpClient({ fetch: input.fetch }))
}
```

Create `src/lib/leetcode/api/index.ts`:

```ts
export {
  requestLeetCodeGraphQl,
  type LeetCodeGraphQlRequestResult,
} from './leetcode-graphql-client'
export {
  requestSubmissionCheck,
  requestSubmissionList,
} from './submission-requests'
```

- [ ] **Step 6: Wire submission source to new REST declarations**

Modify `src/lib/leetcode/submission/submission-result-api-source.ts`:

```ts
import {
  requestSubmissionCheck,
  requestSubmissionList,
} from '../api/submission-requests'
```

Replace direct `options.fetch(submissionListUrl, ...)` in `findSubmissionListEntryForClick` with:

```ts
const payload = await requestSubmissionList({
  fetch: options.fetch,
  locationUrl: options.location.url,
  slug: options.location.slug,
})
const submissions = readSubmissionListEntries(payload)
```

Replace direct `options.fetch(checkUrl, ...)` in `readSubmissionCheckPayload` with:

```ts
const payload: unknown = await requestSubmissionCheck({
  fetch: options.fetch,
  locationUrl: options.location.url,
  submissionId: options.submissionId,
})
```

Keep existing null-return behavior by catching request errors in each helper and returning `null`.

- [ ] **Step 7: Run LeetCode tests**

Run:

```sh
npm run test -- src/lib/leetcode/api/leetcode-api.test.ts src/lib/leetcode/metadata/metadata-reader.test.ts src/lib/leetcode/content/problem-content-reader.test.ts src/lib/leetcode/submission/submission-result-api-source.test.ts
```

Expected: pass with unchanged product assertions.

- [ ] **Step 8: Commit LeetCode API migration**

```sh
git add src/lib/leetcode src/platform/http
git commit -m "refactor: route leetcode api calls through shared http"
```

## Task 9: Documentation And Full Validation

**Files:**

- Modify: `docs/product.md`
- Modify: `docs/architecture.md`
- Modify: `docs/testing.md`
- Modify: `docs/superpowers/README.md`

- [ ] **Step 1: Update product docs**

Add to `docs/product.md` current status:

```md
- GitHub Gist pseudo-sync for local data continuity across browser profiles or devices when the user provides a GitHub token and private Gist.
```

Add to product principles:

```md
- BYOK sync: user-provided tokens remain local to the extension install and are never included in CogniPace backups or Gist payloads.
```

Keep non-goals for accounts, hosted backend, teams, and true real-time collaboration.

- [ ] **Step 2: Update architecture docs**

Add ownership bullets to `docs/architecture.md`:

```md
- `src/platform/http`: shared external REST/GraphQL transport, JSON parsing, normalized HTTP errors, injected fetch support, and secret redaction.
- `src/platform/secrets`: trusted-context Chrome local secret storage for BYOK provider tokens.
- `src/features/sync`: GitHub Gist sync configuration, status, conflict detection, metadata, and orchestration.
- `src/lib/github`: GitHub REST request declarations for private Gist sync.
```

Add LeetCode boundary text:

```md
`features/leetcode-capture` owns runtime capture contracts and sender authorization. LeetCode network calls are declared in `src/lib/leetcode/api` and use `src/platform/http`; DOM/page readers stay in `src/lib/leetcode`.
```

- [ ] **Step 3: Update testing docs**

Add a smoke flow to `docs/testing.md`:

```md
### GitHub Gist Sync

1. Open Settings > Data Management.
2. Save a GitHub token with Gist access.
3. Create a private CogniPace Gist.
4. Save a review from the overlay.
5. Return to Settings and confirm the sync status shows a recent push.
6. Load a clean extension profile, save the same token, connect the same Gist, and confirm local data pulls on first load.
7. Make independent changes in both profiles and confirm Settings shows a conflict instead of auto-overwriting data.
8. Resolve once by pulling remote and once by pushing local during separate test runs.

Expected: local saves always succeed, secrets are not exported in backups, clean remote updates pull automatically, and conflicts require an explicit Settings action.
```

- [ ] **Step 4: Link plan in Superpowers README**

Add to `docs/superpowers/README.md` Plans:

```md
- [`plans/2026-05-26-github-gist-sync.md`](./plans/2026-05-26-github-gist-sync.md): implementation plan for GitHub Gist pseudo-sync, reusable local secrets, shared external API transport, and LeetCode API transport cleanup.
```

- [ ] **Step 5: Run focused validation**

Run:

```sh
npm run test -- src/platform/http/http-client.test.ts src/platform/secrets/secret-store.test.ts src/lib/github/api/github-client.test.ts src/features/sync/domain/sync-envelope.test.ts src/features/sync/data/sync-metadata-store.test.ts src/features/sync/server/sync-service.test.ts src/features/sync/api/sync-api.test.tsx src/features/sync/components/github-sync-panel.test.tsx src/lib/leetcode/api/leetcode-api.test.ts src/lib/leetcode/metadata/metadata-reader.test.ts src/lib/leetcode/content/problem-content-reader.test.ts src/lib/leetcode/submission/submission-result-api-source.test.ts src/extension/background/runtime-policy.test.ts src/extension/background/register-handlers.test.ts
```

Expected: pass.

- [ ] **Step 6: Run full verification**

Run:

```sh
npm run check
npm run format
```

Expected: both pass. If either fails, fix the failing file or test and rerun the failed command before handoff.

- [ ] **Step 7: Commit docs and final validation fixes**

```sh
git add docs src
git commit -m "docs: document github gist sync"
```

## Self-Review

Spec coverage:

- GitHub Gist sync setup, push, pull, conflict handling, and sync status are covered by Tasks 3, 4, 5, 6, and 7.
- Reusable local secrets with `chrome.storage.local` and trusted-context-only access are covered by Task 2.
- Shared REST/GraphQL API transport is covered by Task 1.
- LeetCode capture boundary and API transport cleanup are covered by Task 8.
- Schema-aware remote backup envelope is covered by Task 4 and Task 5.
- Non-blocking local saves with retryable sync status are covered by Task 5 and Task 6.
- Documentation and manual smoke coverage are covered by Task 9.

Type consistency:

- Runtime method names use `sync.*` consistently across contracts, messaging, runtime policy, and API hooks.
- Secret provider ID is consistently `github:gist` for v1.
- Remote file name is consistently `cognipace-sync.json`.
- Local metadata fields match the approved design: `enabled`, `gistId`, `lastSyncAt`, `lastSyncDirection`, `lastRemoteVersion`, `lastRemoteUpdatedAt`, `localDataUpdatedAt`, `dirtySinceLastSync`, `lastError`, and `conflict`.

Implementation discipline:

- Use focused tests before implementation in every task.
- Commit after each task.
- Do not expose full PAT values to React, runtime responses, logs, backups, or Gist payloads.
- Do not build visible GenAI key UI in v1.
