import { describe, expect, it } from 'vitest'

import {
  analyticsRangeSchema,
  analyticsSummaryRequestSchema,
  analyticsSummarySchema,
  forecastEntrySchema,
  retentionScatterEntrySchema,
  referenceCurvePointSchema,
  weakProblemSchema,
  type SerializedAnalyticsSummary,
} from './analytics-contracts'

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
  observedRecallQuality: {
    value: 0.75,
    sampleSize: 20,
    lowSample: false,
  },
  predictedRecall: {
    value: null,
    sampleSize: 0,
    lowSample: true,
  },
  retentionSampleSize: 20,
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
  recallQuality: [],
  consistency: [],
  ratingsMix: [],
  topics: [],
  stability: [],
  overdueBacklog: [],
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
        retentionSampleSize: -1,
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
      recallQuality: [
        {
          date: '2026-01-15',
          observedRecall: 0.75,
          predictedRecall: null,
          targetRetention: 0.9,
          reviewCount: 2,
          eligibleSampleSize: 2,
        },
      ],
    }

    expect(analyticsSummarySchema.parse(chartReadySummary)).toMatchObject({
      range: 30,
      periodStart: validSummary.periodStart,
      periodEnd: validSummary.periodEnd,
      recallQuality: chartReadySummary.recallQuality,
    })
  })

  it('rejects unavailable summaries with predicted recall or chart series', () => {
    expect(
      analyticsSummarySchema.safeParse({
        ...validSummary,
        predictedRecall: { value: 0.8, sampleSize: 20, lowSample: false },
      }).success,
    ).toBe(false)
    expect(
      analyticsSummarySchema.safeParse({
        ...validSummary,
        recallQuality: [
          {
            date: '2026-01-15',
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

  it('rejects percentages outside 0..1 and negative chart counts', () => {
    expect(
      analyticsSummarySchema.safeParse({
        ...validSummary,
        observedRecallQuality: {
          ...validSummary.observedRecallQuality,
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
