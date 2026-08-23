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

const readyReadiness: AnalyticsReadiness = {
  ...readiness,
  ready: true,
  failingReasons: [],
}

function withRequestedReadiness(
  requested: AnalyticsReadiness,
  recommendedRange: 14 | 30 | 90 | null,
) {
  return {
    requested,
    recallQuality: readiness,
    practiceRhythm: readiness,
    ratingsMix: readiness,
    topics: readiness,
    stability: readiness,
    overdueBacklog: readiness,
    recommendedRange,
  }
}

const validForecast = Array.from({ length: 14 }, (_, index) => ({
  date: `2026-01-${String(15 + index).padStart(2, '0')}`,
  dueCount: index,
}))

const validUpcomingLoad = Array.from({ length: 14 }, (_, index) => ({
  date: `2026-01-${String(15 + index).padStart(2, '0')}`,
  dueCount: index,
  overdueCount: index === 0 ? 1 : 0,
  today: index === 0,
}))

const validSummary: SerializedAnalyticsSummary = {
  range: 30,
  generatedAt: '2026-01-15T12:00:00.000Z',
  timeFrame: {
    asOf: '2026-01-15T12:00:00.000Z',
    timeZone: 'America/New_York',
    timeZoneFallback: false,
    requestedDays: 30,
    periodStart: '2025-12-17T05:00:00.000Z',
    periodEnd: '2026-01-16T05:00:00.000Z',
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
  views: {
    observedRecallVsFsrs: {
      rows: [],
      scale: { domain: [0, 1], ticks: [0, 1] },
      targetRetention: 0.9,
    },
    memoryStrength: {
      rows: [],
      scale: { domain: [0, 2], ticks: [0, 1, 2] },
    },
    practiceRhythm: {
      rows: [],
      countScale: { domain: [0, 1], ticks: [0, 1] },
      percentageScale: { domain: [0, 1], ticks: [0, 1] },
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
      recallScale: { domain: [0, 1], ticks: [0, 1] },
      durationScale: { domain: [1, 10], ticks: [1, 10] },
      targetRetention: 0.9,
    },
    memorySignals: { rows: [], totalQualifying: 0 },
  },
  retentionScatter: [],
  retentionScatterCurve: [],
  historicalReadiness: withRequestedReadiness(readiness, null),
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
  upcomingLoad: validUpcomingLoad,
  retentionHealth: [],
  fragileKnowledge: [],
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
        range: 30,
        timeZone: 'America/New_York',
      }),
    ).toEqual({
      surface: 'dashboard',
      range: 30,
      timeZone: 'America/New_York',
    })
  })

  it.each([14, 30, 90] as const)('accepts range %s', (range) => {
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

  it.each([undefined, 7, '30'])('rejects invalid range %s', (range) => {
    expect(
      analyticsSummaryRequestSchema.safeParse({
        surface: 'dashboard',
        range,
        timeZone: 'UTC',
      }).success,
    ).toBe(false)
  })

  it.each([undefined, '', 42])('rejects an invalid timezone %s', (timeZone) => {
    expect(
      analyticsSummaryRequestSchema.safeParse({
        surface: 'dashboard',
        range: 30,
        timeZone,
      }).success,
    ).toBe(false)
  })

  it('accepts optional ISO at', () => {
    expect(
      analyticsSummaryRequestSchema.parse({
        surface: 'dashboard',
        range: 30,
        timeZone: 'America/New_York',
        at: '2026-01-15T12:00:00.000Z',
      }),
    ).toEqual({
      surface: 'dashboard',
      range: 30,
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

  it('rejects a summary whose range differs from its time-frame requested days', () => {
    const result = analyticsSummarySchema.safeParse({
      ...validSummary,
      range: 30,
      timeFrame: {
        ...validSummary.timeFrame,
        requestedDays: 14,
      },
    })

    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['timeFrame', 'requestedDays'],
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

  it('serializes evidence readiness for the requested range and each historical metric', () => {
    expect(analyticsReadinessSchema.parse(readiness)).toEqual(readiness)

    const parsed = analyticsSummarySchema.parse({
      ...validSummary,
      historicalReadiness: withRequestedReadiness(readiness, 30),
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

  it('rejects a fallback recommendation when the requested range is ready', () => {
    const result = analyticsSummarySchema.safeParse({
      ...validSummary,
      historicalReadiness: withRequestedReadiness(readyReadiness, 14),
    })

    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['historicalReadiness', 'recommendedRange'],
          }),
        ]),
      )
  })

  it('serializes an unready historical selection with current and forecast analytics', () => {
    const parsed = analyticsSummarySchema.parse({
      ...validSummary,
      range: 90,
      timeFrame: {
        ...validSummary.timeFrame,
        requestedDays: 90,
      },
      historicalReadiness: {
        ...validSummary.historicalReadiness,
        requested: {
          ...readiness,
          requestedDays: 90,
          ready: false,
        },
      },
      upcomingLoad: validUpcomingLoad,
      retentionHealth: [
        {
          slug: 'two-sum',
          title: 'Two Sum',
          retrievability: 0.82,
          targetRetention: 0.9,
          daysSinceReview: 2,
          stabilityDays: 5,
          difficulty: 5,
          lapseCount: 0,
          overdueDays: 0,
        },
      ],
      fragileKnowledge: [
        {
          slug: 'add-binary',
          title: 'Add Binary',
          retrievability: 0.74,
          stabilityDays: 2,
          difficulty: 7,
          lapseCount: 1,
          overdueDays: 1,
          topics: ['Bit manipulation'],
        },
      ],
    })

    expect(parsed.range).toBe(90)
    expect(parsed.historicalReadiness.requested.ready).toBe(false)
    expect(parsed.upcomingLoad).toHaveLength(14)
    expect(parsed.retentionHealth).toHaveLength(1)
    expect(parsed.fragileKnowledge).toHaveLength(1)
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

  it.each([
    [readyReadiness, null],
    [readiness, 14],
  ] as const)(
    'requires exactly 14 upcoming-load entries regardless of readiness',
    (requested, recommendedRange) => {
      const summary = {
        ...validSummary,
        historicalReadiness: withRequestedReadiness(
          requested,
          recommendedRange,
        ),
      }

      expect(analyticsSummarySchema.safeParse(summary).success).toBe(true)
      expect(
        analyticsSummarySchema.safeParse({
          ...summary,
          upcomingLoad: validUpcomingLoad.slice(0, 13),
        }).success,
      ).toBe(false)
      expect(
        analyticsSummarySchema.safeParse({
          ...summary,
          upcomingLoad: [
            ...validUpcomingLoad,
            {
              date: '2026-01-29',
              dueCount: 0,
              overdueCount: 0,
              today: false,
            },
          ],
        }).success,
      ).toBe(false)
    },
  )

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

  it('accepts chart payloads without duplicate period metadata', () => {
    const chartReadySummary = {
      ...validSummary,
      historicalReadiness: withRequestedReadiness(readyReadiness, null),
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
      historicalReadiness: withRequestedReadiness(readyReadiness, null),
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
