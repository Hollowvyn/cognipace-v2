export type HttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'

export interface HttpRequestDebug {
  url: string
  method: HttpMethod
  status?: number | undefined
}

export class HttpRequestError extends Error {
  override readonly name = 'HttpRequestError'

  constructor(
    message: string,
    readonly debug: HttpRequestDebug,
    readonly status?: number | undefined,
    options: ErrorOptions = {},
  ) {
    super(message, options)
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
