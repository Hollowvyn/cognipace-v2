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
