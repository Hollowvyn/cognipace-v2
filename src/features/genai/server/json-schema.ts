import { z, type ZodType } from 'zod'

import type { GenAiProviderId } from '../domain'

export function zodToProviderJsonSchema(
  schema: ZodType<unknown>,
  provider: GenAiProviderId,
): unknown {
  const raw = stripTopLevelSchemaKey(z.toJSONSchema(schema))
  switch (provider) {
    case 'openai':
      return applyOpenAiStrictness(raw)
    case 'anthropic':
      return raw
    case 'gemini':
      return stripGeminiUnsupported(raw)
  }
}

function stripTopLevelSchemaKey(node: unknown): unknown {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    return node
  }
  const obj = node as Record<string, unknown>
  if (!('$schema' in obj)) {
    return node
  }
  const result = { ...obj }
  delete result['$schema']
  return result
}

function applyOpenAiStrictness(node: unknown): unknown {
  if (!isObjectLike(node)) {
    return node
  }
  if (Array.isArray(node)) {
    return node.map(applyOpenAiStrictness)
  }
  const result: Record<string, unknown> = { ...node }

  if (result.type === 'object' && isPropertiesObject(result.properties)) {
    result.additionalProperties = false
    result.required = Object.keys(result.properties)
    const nextProps: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(result.properties)) {
      nextProps[key] = applyOpenAiStrictness(value)
    }
    result.properties = nextProps
  }

  if (result.type === 'array' && result.items !== undefined) {
    result.items = applyOpenAiStrictness(result.items)
  }

  for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
    const branch = result[key]
    if (Array.isArray(branch)) {
      result[key] = branch.map((member) => applyOpenAiStrictness(member))
    }
  }

  return result
}

function stripGeminiUnsupported(node: unknown): unknown {
  if (!isObjectLike(node)) {
    return node
  }
  if (Array.isArray(node)) {
    return node.map(stripGeminiUnsupported)
  }
  const result: Record<string, unknown> = { ...node }

  delete result.additionalProperties
  delete result.$ref
  delete result.const

  if (
    typeof result.format === 'string' &&
    !geminiAllowedFormats.has(result.format)
  ) {
    delete result.format
  }

  if (isPropertiesObject(result.properties)) {
    const nextProps: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(result.properties)) {
      nextProps[key] = stripGeminiUnsupported(value)
    }
    result.properties = nextProps
  }

  if (result.items !== undefined) {
    result.items = stripGeminiUnsupported(result.items)
  }

  return result
}

const geminiAllowedFormats = new Set(['date-time', 'date', 'time', 'enum'])

function isObjectLike(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null
}

function isPropertiesObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
