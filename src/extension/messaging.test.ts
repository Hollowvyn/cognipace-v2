import { describe, expect, it } from 'vitest'

import { practiceOverrideLastReviewResultRequestSchema } from './messaging'

describe('extension messaging contracts', () => {
  it('rejects reviewedAt on override requests', () => {
    expect(() =>
      practiceOverrideLastReviewResultRequestSchema.parse({
        surface: 'content-script',
        problemId: 'leetcode:two-sum',
        rating: 'good',
        reviewedAt: '2026-01-01T10:00:00.000Z',
      }),
    ).toThrow()
  })
})
