export function isObjectRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function readTrimmedString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : null
}

export function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null
}

export function readCookieValue(cookieHeader: string, cookieName: string) {
  return (
    cookieHeader
      .split(';')
      .map((cookiePart) => cookiePart.trim())
      .find((cookiePart) => cookiePart.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1) ?? null
  )
}
