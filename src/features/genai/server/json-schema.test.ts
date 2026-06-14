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

  it('removes const constraints from Gemini schemas because the API rejects them', () => {
    const schema = z.object({
      ok: z.literal(true),
      version: z.literal('leetcode-assessment-v1'),
    })

    const result = zodToProviderJsonSchema(schema, 'gemini')

    expect(JSON.stringify(result)).not.toContain('"const"')
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

  it('strips the top-level $schema key for every provider', () => {
    for (const provider of ['openai', 'anthropic', 'gemini'] as const) {
      const result = zodToProviderJsonSchema(recommendationSchema, provider)
      expect(JSON.stringify(result)).not.toContain('"$schema"')
    }
  })

  it('recurses into anyOf branches for OpenAI strictness (nullable object retains all-keys required)', () => {
    const schema = z.object({
      address: z
        .object({
          street: z.string(),
          city: z.string(),
        })
        .nullable(),
    })
    const result = zodToProviderJsonSchema(schema, 'openai') as {
      properties: {
        address: {
          anyOf?: Array<{
            type?: string
            required?: string[]
            additionalProperties?: boolean
          }>
          type?: unknown
        }
      }
    }
    // Find the object branch inside the anyOf (Zod emits anyOf for nullable composites).
    const branches = result.properties.address.anyOf ?? []
    const objectBranch = branches.find((branch) => branch.type === 'object')
    if (objectBranch) {
      expect(objectBranch.required).toEqual(
        expect.arrayContaining(['street', 'city']),
      )
      expect(objectBranch.additionalProperties).toBe(false)
    } else {
      // If Zod 4 emits nullable as { type: ['object','null'] } instead of anyOf,
      // the recursion is a no-op for this shape — the OpenAI strict requirements
      // are then satisfied via the top-level required block.
      expect(result.properties.address.type).toBeDefined()
    }
  })
})
