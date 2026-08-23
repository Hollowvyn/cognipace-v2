import { describe, expect, it } from 'vitest'

import {
  analyticsEvidenceSchema,
  analyticsPresentationMetaSchema,
  analyticsViewIdSchema,
} from './analytics-presentation-contracts'

describe('analytics presentation contracts', () => {
  it('requires shared as-of, timezone, range, and evidence metadata', () => {
    expect(
      analyticsPresentationMetaSchema.parse({
        asOf: '2026-08-22T16:40:00.000Z',
        timeZone: 'America/New_York',
        timeZoneFallback: false,
        range: 30,
        periodStart: '2026-07-24T04:00:00.000Z',
        periodEnd: '2026-08-23T04:00:00.000Z',
        isPartial: true,
      }),
    ).toMatchObject({ range: 30, isPartial: true })

    expect(
      analyticsPresentationMetaSchema.safeParse({
        asOf: 'not-an-instant',
        timeZone: '',
        timeZoneFallback: false,
        range: 7,
        periodStart: '2026-07-24T04:00:00.000Z',
        periodEnd: '2026-08-23T04:00:00.000Z',
        isPartial: true,
      }).success,
    ).toBe(false)
  })

  it('validates evidence without treating a lack of evidence as a zero', () => {
    expect(
      analyticsEvidenceSchema.parse({
        labels: ['reconstructed', 'in-progress'],
        sampleSize: 12,
        activeBuckets: 4,
        requestedBuckets: 10,
        effectiveBuckets: 6,
        longestGap: 2,
        gapRuns: 1,
        trendSupported: false,
      }),
    ).toMatchObject({ sampleSize: 12, trendSupported: false })
  })

  it('accepts only the nine approved stable view IDs', () => {
    expect(analyticsViewIdSchema.options).toEqual([
      'observed-recall-vs-fsrs',
      'memory-strength',
      'practice-rhythm',
      'ratings-mix',
      'topic-performance',
      'retention-map',
      'memory-signals',
      'overdue-backlog',
      'upcoming-review-load',
    ])
    expect(analyticsViewIdSchema.safeParse('recall-quality').success).toBe(
      false,
    )
  })
})
