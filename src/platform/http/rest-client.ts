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
