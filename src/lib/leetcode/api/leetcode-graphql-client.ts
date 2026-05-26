import {
  createGraphQlRequest,
  createHttpClient,
  type HttpClient,
} from '@/platform/http'

import { readCookieValue } from '../core/value-readers'

export type LeetCodeGraphQlRequestResult =
  | {
      ok: true
      payload: unknown
    }
  | {
      ok: false
      error: Error
    }

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
