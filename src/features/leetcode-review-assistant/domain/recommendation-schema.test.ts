import { describe, expect, it } from 'vitest'

import {
  assessmentRecommendationSchema,
  assessmentRecommendationSchemaLimits,
} from './recommendation-schema'
import { PROMPT_VERSION } from './recommendation-types'

const validRecommendation = {
  recommendedRating: 'good' as const,
  confidence: 'medium' as const,
  summary: 'Solved within target time using a hash-map.',
  primaryReason: 'Accepted on first try, normal time.',
  evidence: ['Status: accepted', 'Elapsed 600s vs 2100s target'],
  complexity: {
    time: 'O(n)',
    space: 'O(n)',
    confidence: 'high' as const,
  },
  improvementPoints: [],
  edgeCaseNotes: [],
  shouldUpdateRating: false,
  promptVersion: PROMPT_VERSION,
}

describe('assessmentRecommendationSchema', () => {
  it('accepts a canonical valid recommendation', () => {
    expect(assessmentRecommendationSchema.parse(validRecommendation)).toEqual(
      validRecommendation,
    )
  })

  it('rejects an extra unknown field via .strict()', () => {
    expect(() =>
      assessmentRecommendationSchema.parse({
        ...validRecommendation,
        unknownExtra: 'leak',
      }),
    ).toThrow()
  })

  it('rejects an evidence array with more than 5 items', () => {
    expect(() =>
      assessmentRecommendationSchema.parse({
        ...validRecommendation,
        evidence: ['a', 'b', 'c', 'd', 'e', 'f'],
      }),
    ).toThrow()
  })

  it('rejects an improvementPoints array with more than 5 items', () => {
    expect(() =>
      assessmentRecommendationSchema.parse({
        ...validRecommendation,
        improvementPoints: ['a', 'b', 'c', 'd', 'e', 'f'],
      }),
    ).toThrow()
  })

  it('rejects a primaryReason longer than 200 characters', () => {
    expect(() =>
      assessmentRecommendationSchema.parse({
        ...validRecommendation,
        primaryReason: 'x'.repeat(201),
      }),
    ).toThrow()
  })

  it('rejects a complexity.time longer than 80 characters', () => {
    expect(() =>
      assessmentRecommendationSchema.parse({
        ...validRecommendation,
        complexity: { ...validRecommendation.complexity, time: 'O'.repeat(81) },
      }),
    ).toThrow()
  })

  it('rejects a wrong promptVersion literal', () => {
    expect(() =>
      assessmentRecommendationSchema.parse({
        ...validRecommendation,
        promptVersion: 'leetcode-v2',
      }),
    ).toThrow()
  })

  it('rejects an invalid recommendedRating enum value', () => {
    expect(() =>
      assessmentRecommendationSchema.parse({
        ...validRecommendation,
        recommendedRating: 'maybe',
      }),
    ).toThrow()
  })

  it('rejects an invalid confidence enum value', () => {
    expect(() =>
      assessmentRecommendationSchema.parse({
        ...validRecommendation,
        confidence: 'unknown',
      }),
    ).toThrow()
  })

  it('exposes the documented limits', () => {
    expect(assessmentRecommendationSchemaLimits).toEqual({
      evidenceMaxItems: 5,
      improvementPointsMaxItems: 5,
      edgeCaseNotesMaxItems: 5,
      shortTextMaxChars: 200,
      complexityMaxChars: 80,
    })
  })
})
