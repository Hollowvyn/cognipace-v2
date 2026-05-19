import { readCookieValue } from './value-readers'

export type LeetCodeGraphQlFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

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
  fetch?: LeetCodeGraphQlFetch | undefined
  document?: Document | undefined
}): Promise<LeetCodeGraphQlRequestResult> {
  const fetchLeetCodeGraphQl =
    options.fetch ?? globalThis.fetch?.bind(globalThis)

  if (!fetchLeetCodeGraphQl) {
    return { ok: false, error: new Error('Fetch is not available.') }
  }

  try {
    const graphQlResponse = await fetchLeetCodeGraphQl(
      new URL('/graphql', options.locationUrl),
      {
        method: 'POST',
        credentials: 'include',
        headers: createLeetCodeGraphQlHeaders(options.document),
        body: JSON.stringify({
          query: options.query,
          variables: options.variables,
          operationName: options.operationName,
        }),
      },
    )

    if (!graphQlResponse.ok) {
      return {
        ok: false,
        error: new Error(
          `LeetCode GraphQL request failed: ${graphQlResponse.status}`,
        ),
      }
    }

    return { ok: true, payload: await graphQlResponse.json() }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

function createLeetCodeGraphQlHeaders(documentRef: Document | undefined) {
  const graphQlHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const csrfToken = documentRef
    ? readCookieValue(documentRef.cookie, 'csrftoken')
    : null

  if (csrfToken) {
    graphQlHeaders['x-csrftoken'] = csrfToken
  }

  return graphQlHeaders
}
