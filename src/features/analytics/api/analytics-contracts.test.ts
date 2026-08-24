import { describe, expect, it } from 'vitest'

import { analyticsChartPointFixtures } from '@/testing/analytics-fixtures'

import {
  analyticsRangeSchema,
  analyticsSummaryRequestSchema,
  analyticsSummarySchema,
  hardAgainSummarySchema,
  practiceRhythmPointSchema,
  ratingsMixPointSchema,
  type SerializedAnalyticsSummary,
} from './analytics-contracts'

const historicalEvidence = {
  historyDays: 90,
  measuredBuckets: 12,
  observations: 42,
  selectedBucketCount: 13,
  tableOnly: false,
  displayMode: 'trend' as const,
  supportsLine: true,
  supportsDirection: true,
}

const validSummary: SerializedAnalyticsSummary = {
  range: 90,
  generatedAt: '2026-01-15T12:00:00.000Z',
  timeFrame: {
    asOf: '2026-01-15T12:00:00.000Z',
    timeZone: 'America/New_York',
    timeZoneFallback: false,
    requestedRange: 90,
    periodStart: '2025-10-18T05:00:00.000Z',
    periodEnd: '2026-01-16T05:00:00.000Z',
    bucketGrain: 'week',
    buckets: [
      {
        key: '2025-12-17',
        start: '2025-12-17T05:00:00.000Z',
        end: '2025-12-20T05:00:00.000Z',
        startKey: '2025-12-17',
        endKey: '2025-12-19',
        isPartial: false,
      },
    ],
  },
  reviewDays: 10,
  totalReviews: 42,
  currentStreak: 3,
  observedRatingQuality: {
    value: 0.75,
    sampleSize: 20,
    lowSample: false,
  },
  predictedRecall: {
    value: null,
    sampleSize: 0,
    lowSample: true,
  },
  observedRatingSampleSize: 20,
  lowSample: false,
  targetRetention: 0.9,
  views: {
    observedRecallVsFsrs: {
      rows: [],
      scale: { domain: [0, 1], ticks: [0, 1] },
      targetRetention: 0.9,
      evidence: historicalEvidence,
    },
    memoryStrength: {
      rows: [],
      scale: { domain: [0, 2], ticks: [0, 1, 2] },
      evidence: historicalEvidence,
    },
    practiceRhythm: {
      rows: [],
      countScale: { domain: [0, 1], ticks: [0, 1] },
      percentageScale: { domain: [0, 1], ticks: [0, 1] },
      evidence: historicalEvidence,
    },
    ratingsMix: {
      rows: [],
      selectedHardAgain: 0,
      selectedValidRatings: 0,
      comparison: {
        previousHardAgainShare: null,
        previousValidRatings: 0,
        difference: null,
        direction: null,
      },
      evidence: historicalEvidence,
    },
    topicPerformance: {
      rows: [],
      strongerQualifyingTopics: 0,
      lowEvidenceTopics: [],
      additionalLowEvidenceTopics: 0,
    },
    retentionMap: {
      rows: [],
      totalEligible: 0,
      statusCounts: { onTarget: 0, watch: 0, needsAttention: 0 },
      recallScale: { domain: [0, 1], ticks: [0, 1] },
      durationScale: { domain: [1, 10], ticks: [1, 10] },
      targetRetention: 0.9,
    },
    memorySignals: { rows: [], totalQualifying: 0 },
    overdueBacklog: {
      rows: [],
      knownDays: 0,
      withinWatchDays: 0,
      aboveWatchDays: 0,
      selectedDays: 0,
      currentBacklog: null,
      peak: null,
      scale: { domain: [0, 5], ticks: [0, 5] },
    },
    upcomingReviewLoad: {
      rows: Array.from({ length: 14 }, (_, index) => ({
        date: `2026-01-${String(index + 1).padStart(2, '0')}`,
        dueCount: 0,
        overdueCount: 0,
        today: index === 0,
      })),
      scale: { domain: [0, 1], ticks: [0, 1] },
    },
  },
  recallQuality: [],
  practiceRhythm: [],
  ratingsMix: [],
  hardAgain: {
    selectedShare: null,
    previousShare: null,
    delta: null,
    direction: null,
    sampleSize: 0,
    previousSampleSize: 0,
    lowSample: true,
    previousLowSample: true,
  },
  topics: [],
  stability: [],
}

function withoutSummaryField(field: keyof SerializedAnalyticsSummary) {
  const summary: Partial<SerializedAnalyticsSummary> = { ...validSummary }
  delete summary[field]
  return summary
}

describe('analyticsSummaryRequestSchema', () => {
  it('requires the feature-owned Ratings Mix and Topic Performance presentation models', () => {
    expect(() =>
      analyticsSummarySchema.parse({
        ...validSummary,
        views: {
          ...validSummary.views,
          ratingsMix: undefined,
          topicPerformance: undefined,
        },
      }),
    ).toThrow()
  })

  it('requires the dashboard surface', () => {
    expect(() => analyticsSummaryRequestSchema.parse({})).toThrow()
    expect(
      analyticsSummaryRequestSchema.parse({
        surface: 'dashboard',
        range: 90,
        timeZone: 'America/New_York',
      }),
    ).toEqual({
      surface: 'dashboard',
      range: 90,
      timeZone: 'America/New_York',
    })
  })

  it.each([90, 120, 'all'] as const)('accepts range %s', (range) => {
    expect(
      analyticsSummaryRequestSchema.parse({
        surface: 'dashboard',
        range,
        timeZone: 'UTC',
      }),
    ).toEqual({
      surface: 'dashboard',
      range,
      timeZone: 'UTC',
    })
  })

  it.each([undefined, 14, 30, 7, '90', '120', 'everything'])(
    'rejects invalid range %s',
    (range) => {
      expect(
        analyticsSummaryRequestSchema.safeParse({
          surface: 'dashboard',
          range,
          timeZone: 'UTC',
        }).success,
      ).toBe(false)
    },
  )

  it.each([undefined, '', 42])('rejects an invalid timezone %s', (timeZone) => {
    expect(
      analyticsSummaryRequestSchema.safeParse({
        surface: 'dashboard',
        range: 90,
        timeZone,
      }).success,
    ).toBe(false)
  })

  it('accepts optional ISO at', () => {
    expect(
      analyticsSummaryRequestSchema.parse({
        surface: 'dashboard',
        range: 90,
        timeZone: 'America/New_York',
        at: '2026-01-15T12:00:00.000Z',
      }),
    ).toEqual({
      surface: 'dashboard',
      range: 90,
      timeZone: 'America/New_York',
      at: '2026-01-15T12:00:00.000Z',
    })
  })
})

describe('analyticsSummarySchema', () => {
  it('requires the Phase 2 historical view presentation models', () => {
    expect(analyticsSummarySchema.safeParse(validSummary).success).toBe(true)
    expect(
      analyticsSummarySchema.safeParse(withoutSummaryField('views')).success,
    ).toBe(false)
  })

  it('requires explicit local-time metadata and preserves partial bucket state', () => {
    expect(analyticsSummarySchema.safeParse(validSummary).success).toBe(true)
    expect(
      analyticsSummarySchema.safeParse(withoutSummaryField('timeFrame'))
        .success,
    ).toBe(false)
    expect(analyticsSummarySchema.parse(validSummary).timeFrame).toEqual(
      validSummary.timeFrame,
    )
  })

  it('rejects a summary whose range differs from its requested range', () => {
    const result = analyticsSummarySchema.safeParse({
      ...validSummary,
      range: 120,
      timeFrame: {
        ...validSummary.timeFrame,
        requestedRange: 90,
      },
    })

    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['timeFrame', 'requestedRange'],
          }),
        ]),
      )
  })

  it('serializes a summary without duplicate presentation metadata', () => {
    expect(
      analyticsSummarySchema.safeParse(withoutSummaryField('generatedAt'))
        .success,
    ).toBe(false)
    expect(analyticsSummarySchema.safeParse(validSummary).success).toBe(true)
  })

  it('serializes classifier-backed evidence for each historical view', () => {
    const parsed = analyticsSummarySchema.parse(validSummary)

    expect(parsed.views.observedRecallVsFsrs.evidence).toEqual(
      historicalEvidence,
    )
    expect(parsed.views.memoryStrength.evidence).toEqual(historicalEvidence)
    expect(parsed.views.practiceRhythm.evidence).toEqual(historicalEvidence)
    expect(parsed.views.ratingsMix.evidence).toEqual(historicalEvidence)
  })

  it('accepts a valid full summary', () => {
    expect(analyticsSummarySchema.safeParse(validSummary).success).toBe(true)
  })

  it('does not expose legacy historical readiness or a recommended range', () => {
    const parsed = analyticsSummarySchema.parse({
      ...validSummary,
      historicalReadiness: { recommendedRange: 14 },
    }) as Record<string, unknown>

    expect(parsed).not.toHaveProperty('historicalReadiness')
  })

  it('serializes all-time summary range without numeric coercion', () => {
    const parsed = analyticsSummarySchema.parse({
      ...validSummary,
      range: 'all',
      timeFrame: {
        ...validSummary.timeFrame,
        requestedRange: 'all',
        periodStart: null,
        buckets: [],
      },
    })

    expect(parsed.range).toBe('all')
    expect(parsed.timeFrame.requestedRange).toBe('all')
    expect(parsed.views.upcomingReviewLoad.rows).toHaveLength(14)
  })

  it.each([
    {
      label: 'a 90-day range without a start or buckets',
      range: 90,
      timeFrame: { requestedRange: 90, periodStart: null, buckets: [] },
    },
    {
      label: 'a 120-day range without a start',
      range: 120,
      timeFrame: { requestedRange: 120, periodStart: null },
    },
    {
      label: 'an empty all-time range with buckets',
      range: 'all',
      timeFrame: { requestedRange: 'all', periodStart: null },
    },
    {
      label: 'a populated all-time range without buckets',
      range: 'all',
      timeFrame: {
        requestedRange: 'all',
        periodStart: '2025-01-01T00:00:00.000Z',
        buckets: [],
      },
    },
  ])('rejects $label', ({ range, timeFrame }) => {
    expect(
      analyticsSummarySchema.safeParse({
        ...validSummary,
        range,
        timeFrame: { ...validSummary.timeFrame, ...timeFrame },
      }).success,
    ).toBe(false)
  })

  it('keeps the fixed workload forecast anchored at today and overdue only today', () => {
    const rows = validSummary.views.upcomingReviewLoad.rows
    expect(
      analyticsSummarySchema.safeParse({
        ...validSummary,
        views: {
          ...validSummary.views,
          upcomingReviewLoad: {
            ...validSummary.views.upcomingReviewLoad,
            rows: rows.map((row, index) => ({
              ...row,
              overdueCount: index === 1 ? 1 : row.overdueCount,
            })),
          },
        },
      }).success,
    ).toBe(false)
    expect(
      analyticsSummarySchema.safeParse({
        ...validSummary,
        views: {
          ...validSummary.views,
          upcomingReviewLoad: {
            ...validSummary.views.upcomingReviewLoad,
            rows: rows.map((row, index) => ({
              ...row,
              today: index === 1,
            })),
          },
        },
      }).success,
    ).toBe(false)
  })

  it('rejects negative integer counts', () => {
    expect(
      analyticsSummarySchema.safeParse({ ...validSummary, reviewDays: -1 })
        .success,
    ).toBe(false)
    expect(
      analyticsSummarySchema.safeParse({ ...validSummary, totalReviews: -1 })
        .success,
    ).toBe(false)
    expect(
      analyticsSummarySchema.safeParse({ ...validSummary, currentStreak: -1 })
        .success,
    ).toBe(false)
    expect(
      analyticsSummarySchema.safeParse({
        ...validSummary,
        observedRatingSampleSize: -1,
      }).success,
    ).toBe(false)
  })

  it('accepts chart payloads without duplicate period metadata', () => {
    const chartReadySummary = {
      ...validSummary,
      recallQuality: [
        {
          bucketStart: '2026-01-15',
          bucketEnd: '2026-01-15',
          observedRecall: 0.75,
          predictedRecall: null,
          targetRetention: 0.9,
          reviewCount: 2,
          eligibleSampleSize: 2,
        },
      ],
      ...analyticsChartPointFixtures,
    }

    expect(analyticsSummarySchema.parse(chartReadySummary)).toMatchObject({
      range: 90,
      recallQuality: chartReadySummary.recallQuality,
      practiceRhythm: chartReadySummary.practiceRhythm,
      ratingsMix: chartReadySummary.ratingsMix,
    })
  })

  it('permits sparse summaries without hiding measured chart values', () => {
    expect(
      analyticsSummarySchema.safeParse({
        ...validSummary,
        predictedRecall: { value: null, sampleSize: 1, lowSample: true },
      }).success,
    ).toBe(true)
    expect(
      analyticsSummarySchema.safeParse({
        ...validSummary,
        recallQuality: [
          {
            bucketStart: '2026-01-15',
            bucketEnd: '2026-01-15',
            observedRecall: 0.75,
            predictedRecall: null,
            targetRetention: 0.9,
            reviewCount: 2,
            eligibleSampleSize: 2,
          },
        ],
      }).success,
    ).toBe(true)
  })

  it('keeps low-sample metric values null instead of coercing them to zero', () => {
    expect(validSummary.predictedRecall.value).toBeNull()
    expect(analyticsSummarySchema.parse(validSummary).predictedRecall).toEqual({
      value: null,
      sampleSize: 0,
      lowSample: true,
    })
  })

  it.each([
    { value: 0.8, sampleSize: 20, lowSample: true },
    { value: null, sampleSize: 20, lowSample: false },
  ])('rejects invalid nullable metric combinations: %j', (metric) => {
    expect(
      analyticsSummarySchema.safeParse({
        ...validSummary,
        observedRatingQuality: metric,
      }).success,
    ).toBe(false)
  })

  it('accepts a valid null low-sample metric', () => {
    expect(
      analyticsSummarySchema.safeParse({
        ...validSummary,
        observedRatingQuality: { value: null, sampleSize: 7, lowSample: true },
        observedRatingSampleSize: 7,
        lowSample: true,
      }).success,
    ).toBe(true)
  })

  it('rejects percentages outside 0..1 and negative chart counts', () => {
    expect(
      analyticsSummarySchema.safeParse({
        ...validSummary,
        observedRatingQuality: {
          ...validSummary.observedRatingQuality,
          value: 1.01,
        },
      }).success,
    ).toBe(false)
    expect(
      analyticsSummarySchema.safeParse({
        ...validSummary,
        ratingsMix: [{ ...validSummary.ratingsMix[0], again: -1 }],
      }).success,
    ).toBe(false)
  })
})

describe('hardAgainSummarySchema', () => {
  it('preserves valid period comparison semantics', () => {
    expect(
      hardAgainSummarySchema.parse({
        selectedShare: 0.18,
        previousShare: 0.27,
        delta: -0.09,
        direction: 'down',
        sampleSize: 50,
        previousSampleSize: 48,
        lowSample: false,
        previousLowSample: false,
      }),
    ).toMatchObject({ direction: 'down', sampleSize: 50 })
  })
})

describe('analyticsRangeSchema', () => {
  it('accepts the selected long-range values without coercing all', () => {
    expect(
      [90, 120, 'all'].every(
        (range) => analyticsRangeSchema.safeParse(range).success,
      ),
    ).toBe(true)
    expect(analyticsRangeSchema.parse('all')).toBe('all')
  })
})

describe('analyticsSummarySchema', () => {
  it('rejects a summary missing targetRetention', () => {
    const withoutField = withoutSummaryField('targetRetention')
    expect(analyticsSummarySchema.safeParse(withoutField).success).toBe(false)
  })

  it('rejects targetRetention outside 0–1', () => {
    expect(
      analyticsSummarySchema.safeParse({
        ...validSummary,
        targetRetention: 1.5,
      }).success,
    ).toBe(false)
  })
})

describe('chart point contracts', () => {
  it('preserves association semantics and Hard + Again share during serialization', () => {
    expect(
      practiceRhythmPointSchema.parse({
        bucketStart: '2026-01-12',
        bucketEnd: '2026-01-18',
        reviewCount: 3,
        observedCorrectness: 0.75,
        sampleSize: 4,
        associationOnly: true,
      }),
    ).toMatchObject({ associationOnly: true })
    expect(
      ratingsMixPointSchema.parse({
        bucketStart: '2026-01-15',
        bucketEnd: '2026-01-15',
        again: 1,
        hard: 1,
        good: 2,
        easy: 0,
        total: 4,
        hardAgainShare: 0.5,
      }),
    ).toMatchObject({ hardAgainShare: 0.5 })
  })
})
