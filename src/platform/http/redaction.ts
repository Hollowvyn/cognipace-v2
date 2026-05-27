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
    return redactString(url.toString(), sensitiveValues).replaceAll(
      '%5Bredacted%5D',
      '[redacted]',
    )
  } catch {
    return redactString(value, sensitiveValues)
  }
}

export function redactHeaders(
  headers: HeadersInit | undefined,
  sensitiveValues: readonly string[] = [],
) {
  const output: Record<string, string> = {}

  if (!headers) {
    return output
  }

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      output[key] = redactHeaderValue(key, value, sensitiveValues)
    })
    return output
  }

  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      output[key] = redactHeaderValue(key, value, sensitiveValues)
    }
    return output
  }

  for (const [key, value] of Object.entries(headers)) {
    output[key] = redactHeaderValue(key, value, sensitiveValues)
  }

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

function redactHeaderValue(
  key: string,
  value: string,
  sensitiveValues: readonly string[],
) {
  return sensitiveHeaderNames.has(key.toLowerCase())
    ? '[redacted]'
    : redactString(value, sensitiveValues)
}
