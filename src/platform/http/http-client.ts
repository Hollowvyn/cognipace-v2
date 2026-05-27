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
        const init: RequestInit = {
          method: request.method,
          headers,
        }

        const body = createJsonBody(request.body)
        if (body !== undefined) {
          init.body = body
        }

        if (request.credentials !== undefined) {
          init.credentials = request.credentials
        }

        if (request.signal !== undefined) {
          init.signal = request.signal
        }

        const response = await fetchImpl(request.url, init)
        const payload = await readResponsePayload(response, request)

        if (!response.ok) {
          throw new HttpRequestError(
            createHttpErrorMessage(
              response.status,
              payload,
              request.sensitiveValues,
            ),
            { ...debug, status: response.status },
            response.status,
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
          { cause: createSanitizedCause(error, request.sensitiveValues) },
        )
      }
    },
  }
}

async function readResponsePayload(
  response: Response,
  request: HttpJsonRequest,
) {
  try {
    return await readJsonResponse(response)
  } catch (error) {
    if (!response.ok) {
      throw new HttpRequestError(
        createHttpErrorMessage(
          response.status,
          undefined,
          request.sensitiveValues,
        ),
        { ...createDebug(request), status: response.status },
        response.status,
        { cause: createSanitizedCause(error, request.sensitiveValues) },
      )
    }

    throw error
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

function createSanitizedCause(
  error: unknown,
  sensitiveValues: readonly string[] | undefined,
) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactString(error.message, sensitiveValues),
    }
  }

  return {
    message: redactString(String(error), sensitiveValues),
  }
}
