import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { zodToProviderJsonSchema } from './json-schema'

const recommendationSchema = z.object({
  recommendedRating: z.enum(['again', 'hard', 'good', 'easy']),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  evidence: z.array(z.string()),
  complexity: z.object({
    time: z.string(),
    space: z.string(),
  }),
})

describe('zodToProviderJsonSchema', () => {
  it('produces an object schema for OpenAI with additionalProperties:false and full required[] at every level', () => {
    const schema = zodToProviderJsonSchema(recommendationSchema, 'openai') as {
      type: string
      additionalProperties?: boolean
      required?: string[]
      properties: { complexity: { additionalProperties?: boolean; required?: string[] } }
    }

    expect(schema.type).toBe('object')
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toEqual(
      expect.arrayContaining([
        'recommendedRating',
        'confidence',
        'summary',
        'evidence',
        'complexity',
      ]),
    )
    expect(schema.properties.complexity.additionalProperties).toBe(false)
    expect(schema.properties.complexity.required).toEqual(
      expect.arrayContaining(['time', 'space']),
    )
  })

  it('passes the schema through largely unchanged for Anthropic', () => {
    const schema = zodToProviderJsonSchema(
      recommendationSchema,
      'anthropic',
    ) as { type: string; properties: Record<string, unknown> }
    expect(schema.type).toBe('object')
    expect(schema.properties).toHaveProperty('recommendedRating')
    expect(schema.properties).toHaveProperty('complexity')
  })

  it('removes additionalProperties everywhere for Gemini', () => {
    const schema = zodToProviderJsonSchema(recommendationSchema, 'gemini')
    expect(JSON.stringify(schema)).not.toContain('additionalProperties')
  })

  it('keeps enum constraints across all providers', () => {
    for (const provider of ['openai', 'anthropic', 'gemini'] as const) {
      const schema = JSON.stringify(
        zodToProviderJsonSchema(recommendationSchema, provider),
      )
      expect(schema).toContain('again')
      expect(schema).toContain('easy')
    }
  })

  it('preserves nullable fields under OpenAI strictness (key remains required, type or anyOf)', () => {
    const schema = z.object({
      note: z.string().nullable(),
    })
    const result = zodToProviderJsonSchema(schema, 'openai') as {
      required: string[]
      properties: { note: { type?: unknown; anyOf?: unknown } }
    }
    expect(result.required).toEqual(['note'])
    // Zod 4 may emit nullable as { type: ['string','null'] } or { anyOf: [...] }.
    // Both forms are valid for OpenAI strict mode; we just assert one of them is present.
    const noteProp = result.properties.note
    const isWellFormed = noteProp.type !== undefined || Array.isArray(noteProp.anyOf)
    expect(isWellFormed).toBe(true)
  })
})
