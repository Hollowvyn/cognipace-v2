import { describe, expect, it } from 'vitest'

import { analyticsChartPointFixtures } from '@/testing/analytics-fixtures'

import {
  analyticsReadinessSchema,
  analyticsRangeSchema,
  analyticsSummaryRequestSchema,
  analyticsSummarySchema,
  forecastEntrySchema,
  hardAgainSummarySchema,
  practiceRhythmPointSchema,
  ratingsMixPointSchema,
  retentionScatterEntrySchema,
  referenceCurvePointSchema,
  weakProblemSchema,
  type AnalyticsReadiness,
  type SerializedAnalyticsSummary,
} from './analytics-contracts'

const readiness: AnalyticsReadiness = {
  ready: false,
  requestedDays: 90,
  bucketDays: 7,
  requestedBuckets: 13,
  effectiveBuckets: 8,
  effectiveStart: '2026-06-22',
  assessments: 32,
  minimumAssessments: 45,
  activeBuckets: 6,
  minimumActiveBuckets: 7,
  longestGap: 2,
  maximumGap: 2,
  gapRuns: 2,
  maximumGapRuns: 2,
  failingReasons: ['insufficient-assessments'],
}

const validForecast = Array.from({ length: 14 }, (_, index) => ({
  date: `2026-01-${String(15 + index).padStart(2, '0')}`,
  dueCount: index,
}))

const validSummary: SerializedAnalyticsSummary = {
  chartDataStatus: 'unavailable',
  range: 30,
  periodStart: '2025-12-16T00:00:00.000Z',
  periodEnd: '2026-01-15T12:00:00.000Z',
  generatedAt: '2026-01-15T12:00:00.000Z',
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
  dueForecast14Days: validForecast,
  weakProblems: [],
  memoryProfile: {
    totalTracked: 1,
    dueToday: 0,
    overdue: 0,
    learning: 0,
    review: 1,
    mastered: 0,
    suspended: 0,
    averageRetrievability: 0.8,
    lowSample: true,
  },
  targetRetention: 0.9,
  retentionScatter: [],
  retentionScatterCurve: [],
  historicalReadiness: {
    requested: readiness,
    recallQuality: readiness,
    practiceRhythm: readiness,
    ratingsMix: readiness,
    topics: readiness,
    stability: readiness,
    overdueBacklog: readiness,
    recommendedRange: null,
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
  overdueBacklog: [],
  overdueHistoryAvailableFrom: null,
  upcomingLoad: [],
  retentionHealth: [],
  fragileKnowledge: [],
}

function withoutSummaryField(field: keyof SerializedAnalyticsSummary) {
  const summary: Partial<SerializedAnalyticsSummary> = { ...validSummary }
  delete summary[field]
  return summary
}

describe('analyticsSummaryRequestSchema', () => {
  it('requires the dashboard surface', () => {
    expect(() => analyticsSummaryRequestSchema.parse({})).toThrow()
    expect(
      analyticsSummaryRequestSchema.parse({ surface: 'dashboard', range: 30 }),
    ).toEqual({ surface: 'dashboard', range: 30 })
  })

  it.each([14, 30, 90] as const)('accepts range %s', (range) => {
    expect(
      analyticsSummaryRequestSchema.parse({ surface: 'dashboard', range }),
    ).toEqual({
      surface: 'dashboard',
      range,
    })
  })

  it.each([undefined, 7, '30'])('rejects invalid range %s', (range) => {
    expect(
      analyticsSummaryRequestSchema.safeParse({ surface: 'dashboard', range })
        .success,
    ).toBe(false)
  })

  it('accepts optional ISO at', () => {
    expect(
      analyticsSummaryRequestSchema.parse({
        surface: 'dashboard',
        range: 30,
        at: '2026-01-15T12:00:00.000Z',
      }),
    ).toEqual({
      surface: 'dashboard',
      range: 30,
      at: '2026-01-15T12:00:00.000Z',
    })
  })
})

describe('analyticsSummarySchema', () => {
  it('serializes evidence readiness for the requested range and each historical metric', () => {
    expect(analyticsReadinessSchema.parse(readiness)).toEqual(readiness)

    const parsed = analyticsSummarySchema.parse({
      ...validSummary,
      historicalReadiness: {
        requested: readiness,
        recallQuality: readiness,
        practiceRhythm: readiness,
        ratingsMix: readiness,
        topics: readiness,
        stability: readiness,
        overdueBacklog: readiness,
        recommendedRange: 30,
      },
    }) as { historicalReadiness?: unknown }

    expect(parsed.historicalReadiness).toEqual({
      requested: readiness,
      recallQuality: readiness,
      practiceRhythm: readiness,
      ratingsMix: readiness,
      topics: readiness,
      stability: readiness,
      overdueBacklog: readiness,
      recommendedRange: 30,
    })
  })

  it('accepts a valid full summary', () => {
    expect(analyticsSummarySchema.safeParse(validSummary).success).toBe(true)
  })

  it('rejects a forecast with fewer than 14 entries', () => {
    const result = analyticsSummarySchema.safeParse({
      ...validSummary,
      dueForecast14Days: validForecast.slice(0, 13),
    })
    expect(result.success).toBe(false)
  })

  it('rejects a forecast with more than 14 entries', () => {
    const result = analyticsSummarySchema.safeParse({
      ...validSummary,
      dueForecast14Days: [
        ...validForecast,
        { date: '2026-01-29', dueCount: 0 },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than 10 weak problems', () => {
    const tooMany = Array.from({ length: 11 }, (_, index) => ({
      slug: `problem-${index}`,
      title: `Problem ${index}`,
      lapseCount: 1,
      difficulty: 5,
      retrievability: 0.8,
    }))
    expect(
      analyticsSummarySchema.safeParse({
        ...validSummary,
        weakProblems: tooMany,
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

  it('rejects out-of-range average retrievability', () => {
    expect(() =>
      analyticsSummarySchema.parse({
        ...validSummary,
        memoryProfile: {
          ...validSummary.memoryProfile,
          averageRetrievability: 1.01,
        },
      }),
    ).toThrow()
    expect(() =>
      analyticsSummarySchema.parse({
        ...validSummary,
        memoryProfile: {
          ...validSummary.memoryProfile,
          averageRetrievability: -0.01,
        },
      }),
    ).toThrow()
  })

  it('accepts period metadata and chart-ready payloads', () => {
    const chartReadySummary = {
      ...validSummary,
      chartDataStatus: 'ready' as const,
      overdueHistoryAvailableFrom: '2026-01-01T00:00:00.000Z',
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
      range: 30,
      periodStart: validSummary.periodStart,
      periodEnd: validSummary.periodEnd,
      recallQuality: chartReadySummary.recallQuality,
      practiceRhythm: chartReadySummary.practiceRhythm,
      ratingsMix: chartReadySummary.ratingsMix,
      overdueHistoryAvailableFrom: '2026-01-01T00:00:00.000Z',
    })
  })

  it('preserves a nullable overdue history boundary', () => {
    expect(
      analyticsSummarySchema.parse({
        ...validSummary,
        overdueHistoryAvailableFrom: null,
      }).overdueHistoryAvailableFrom,
    ).toBeNull()
    expect(
      analyticsSummarySchema.parse({
        ...validSummary,
        overdueHistoryAvailableFrom: '2026-01-01T00:00:00.000Z',
      }).overdueHistoryAvailableFrom,
    ).toBe('2026-01-01T00:00:00.000Z')
  })

  it('preserves unknown overdue buckets instead of fabricating a count', () => {
    const parsed = analyticsSummarySchema.parse({
      ...validSummary,
      chartDataStatus: 'ready',
      overdueBacklog: [
        {
          bucketStart: '2026-01-13',
          bucketEnd: '2026-01-15',
          overdueCount: null,
          historyAvailable: false,
        },
      ],
    })

    expect(parsed.overdueBacklog).toEqual([
      {
        bucketStart: '2026-01-13',
        bucketEnd: '2026-01-15',
        overdueCount: null,
        historyAvailable: false,
      },
    ])
  })

  it('rejects unavailable summaries with predicted recall or chart series', () => {
    expect(
      analyticsSummarySchema.safeParse({
        ...validSummary,
        predictedRecall: { value: null, sampleSize: 1, lowSample: true },
      }).success,
    ).toBe(false)
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
    ).toBe(false)
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
  it('accepts only the supported numeric ranges', () => {
    expect(
      [14, 30, 90].every(
        (range) => analyticsRangeSchema.safeParse(range).success,
      ),
    ).toBe(true)
  })
})

describe('forecastEntrySchema', () => {
  it('accepts a valid forecast entry', () => {
    expect(
      forecastEntrySchema.safeParse({ date: '2026-01-15', dueCount: 3 })
        .success,
    ).toBe(true)
  })

  it('rejects a negative dueCount', () => {
    expect(
      forecastEntrySchema.safeParse({ date: '2026-01-15', dueCount: -1 })
        .success,
    ).toBe(false)
  })

  it('rejects a missing date', () => {
    expect(forecastEntrySchema.safeParse({ dueCount: 3 }).success).toBe(false)
  })
})

describe('weakProblemSchema', () => {
  it('accepts a valid weak problem', () => {
    expect(
      weakProblemSchema.safeParse({
        slug: 'two-sum',
        title: 'Two Sum',
        lapseCount: 3,
        difficulty: 7.5,
        retrievability: 0.4,
      }).success,
    ).toBe(true)
  })

  it('rejects a negative lapseCount', () => {
    expect(
      weakProblemSchema.safeParse({
        slug: 'two-sum',
        title: 'Two Sum',
        lapseCount: -1,
        difficulty: 7.5,
        retrievability: 0.4,
      }).success,
    ).toBe(false)
  })

  it('rejects a missing slug', () => {
    expect(
      weakProblemSchema.safeParse({
        title: 'Two Sum',
        lapseCount: 3,
        difficulty: 7.5,
        retrievability: 0.4,
      }).success,
    ).toBe(false)
  })
})

describe('retentionScatterEntrySchema', () => {
  it('accepts a valid scatter entry', () => {
    expect(
      retentionScatterEntrySchema.safeParse({
        slug: 'two-sum',
        title: 'Two Sum',
        retrievability: 0.85,
        daysSinceReview: 5,
        difficulty: 4.5,
        stability: 20,
        lapseCount: 1,
        lastReviewAt: '2026-01-10T12:00:00.000Z',
      }).success,
    ).toBe(true)
  })

  it('rejects negative daysSinceReview', () => {
    expect(
      retentionScatterEntrySchema.safeParse({
        slug: 'two-sum',
        title: 'Two Sum',
        retrievability: 0.85,
        daysSinceReview: -1,
        difficulty: 4.5,
        stability: 20,
        lapseCount: 1,
        lastReviewAt: '2026-01-10T12:00:00.000Z',
      }).success,
    ).toBe(false)
  })

  it('rejects retrievability outside 0–1 range', () => {
    expect(
      retentionScatterEntrySchema.safeParse({
        slug: 'two-sum',
        title: 'Two Sum',
        retrievability: 1.5,
        daysSinceReview: 5,
        difficulty: 4.5,
        stability: 20,
        lapseCount: 1,
        lastReviewAt: '2026-01-10T12:00:00.000Z',
      }).success,
    ).toBe(false)
  })
})

describe('referenceCurvePointSchema', () => {
  it('accepts a valid curve point', () => {
    expect(
      referenceCurvePointSchema.safeParse({ days: 7, retrievability: 0.9 })
        .success,
    ).toBe(true)
  })

  it('rejects negative days', () => {
    expect(
      referenceCurvePointSchema.safeParse({ days: -1, retrievability: 0.9 })
        .success,
    ).toBe(false)
  })
})

describe('analyticsSummarySchema — new scatter fields', () => {
  it('rejects a summary missing targetRetention', () => {
    const withoutField = withoutSummaryField('targetRetention')
    expect(analyticsSummarySchema.safeParse(withoutField).success).toBe(false)
  })

  it('rejects a summary missing retentionScatter', () => {
    const withoutField = withoutSummaryField('retentionScatter')
    expect(analyticsSummarySchema.safeParse(withoutField).success).toBe(false)
  })

  it('rejects a summary missing retentionScatterCurve', () => {
    const withoutField = withoutSummaryField('retentionScatterCurve')
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
