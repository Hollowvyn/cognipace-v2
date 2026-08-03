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

  it('keeps normalized HTTP errors free of raw sensitive details', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'bad token sk-secret',
          token: 'ghp_secret',
        }),
        {
          status: 401,
        },
      ),
    )
    const client = createHttpClient({ fetch: fetchMock })

    try {
      await client.requestJson({
        url: 'https://api.example.test/models?key=secret-key',
        method: 'GET',
        headers: { Authorization: 'Bearer ghp_secret' },
        sensitiveValues: ['ghp_secret', 'secret-key', 'sk-secret'],
      })
      throw new Error('Expected request to fail.')
    } catch (error) {
      expect(error).toMatchObject({
        name: 'HttpRequestError',
        message: 'bad token [redacted]',
        status: 401,
        debug: {
          url: 'https://api.example.test/models?key=[redacted]',
          method: 'GET',
          status: 401,
        },
      })
      expect(JSON.stringify(error)).not.toMatch(
        /ghp_secret|secret-key|sk-secret/,
      )
      expect(getErrorCause(error)).not.toEqual({ token: 'ghp_secret' })
      expect(stringifyUnknown(getErrorCause(error))).not.toMatch(
        /ghp_secret|secret-key|sk-secret/,
      )
    }
  })

  it('sanitizes raw fetch errors before exposing them through normalized errors', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error('network failed for ghp_secret'))
    const client = createHttpClient({ fetch: fetchMock })

    try {
      await client.requestJson({
        url: 'https://api.example.test/models?key=secret-key',
        method: 'GET',
        headers: { Authorization: 'Bearer ghp_secret' },
        sensitiveValues: ['ghp_secret', 'secret-key'],
      })
      throw new Error('Expected request to fail.')
    } catch (error) {
      expect(error).toMatchObject({
        name: 'HttpRequestError',
        message: 'network failed for [redacted]',
        debug: {
          url: 'https://api.example.test/models?key=[redacted]',
          method: 'GET',
        },
      })
      expect(JSON.stringify(error)).not.toMatch(/ghp_secret|secret-key/)
      expect(stringifyUnknown(getErrorCause(error))).not.toMatch(
        /ghp_secret|secret-key/,
      )
    }
  })

  it('preserves HTTP status when an error response body is not JSON', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('not json', { status: 403 }))
    const client = createHttpClient({ fetch: fetchMock })

    await expect(
      client.requestJson({
        url: 'https://api.example.test/resource',
        method: 'GET',
      }),
    ).rejects.toMatchObject({
      name: 'HttpRequestError',
      message: 'HTTP request failed with status 403.',
      status: 403,
      debug: {
        url: 'https://api.example.test/resource',
        method: 'GET',
        status: 403,
      },
    })
  })

  it('passes caller supplied AbortSignal through to fetch combined with timeout', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      )
    const controller = new AbortController()
    const client = createHttpClient({ fetch: fetchMock })

    await client.requestJson({
      url: 'https://api.example.test/resource',
      method: 'POST',
      signal: controller.signal,
    })

    const fetchCallArgs = fetchMock.mock.calls[0] as [string, RequestInit]
    const fetchCallSignal = fetchCallArgs[1].signal as AbortSignal
    expect(fetchCallSignal).toBeInstanceOf(AbortSignal)
    expect(fetchCallSignal.aborted).toBe(false)
    controller.abort()
    expect(fetchCallSignal.aborted).toBe(true)
  })

  it('normalizes TimeoutError and AbortError into "Network request timed out."', async () => {
    const timeoutError = new Error('The operation timed out')
    timeoutError.name = 'TimeoutError'
    const fetchMock = vi.fn().mockRejectedValue(timeoutError)
    const client = createHttpClient({ fetch: fetchMock })

    await expect(
      client.requestJson({
        url: 'https://api.example.test/resource',
        method: 'GET',
      }),
    ).rejects.toMatchObject({
      name: 'HttpRequestError',
      message: 'Network request timed out.',
    })
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

function getErrorCause(error: unknown) {
  return error instanceof Error ? error.cause : undefined
}

function stringifyUnknown(value: unknown) {
  return JSON.stringify(value) ?? String(value)
}
