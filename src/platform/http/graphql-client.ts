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
