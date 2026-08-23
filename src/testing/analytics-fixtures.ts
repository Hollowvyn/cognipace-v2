import type { SerializedAnalyticsSummary } from '@/features/analytics/api/analytics-contracts'

export const analyticsChartPointFixtures = {
  practiceRhythm: [
    {
      bucketStart: '2026-05-25',
      bucketEnd: '2026-05-27',
      reviewCount: 4,
      observedCorrectness: 0.75,
      sampleSize: 8,
      associationOnly: true,
    },
  ],
  ratingsMix: [
    {
      bucketStart: '2026-05-28',
      bucketEnd: '2026-05-30',
      again: 1,
      hard: 2,
      good: 4,
      easy: 1,
      total: 8,
      hardAgainShare: 0.375,
    },
  ],
} satisfies Pick<SerializedAnalyticsSummary, 'practiceRhythm' | 'ratingsMix'>

function createUnreadyReadiness(): SerializedAnalyticsSummary['historicalReadiness']['requested'] {
  return {
    ready: false,
    requestedDays: 30,
    bucketDays: 3,
    requestedBuckets: 10,
    effectiveBuckets: 0,
    effectiveStart: null,
    assessments: 0,
    minimumAssessments: 24,
    activeBuckets: 0,
    minimumActiveBuckets: 0,
    longestGap: 0,
    maximumGap: 2,
    gapRuns: 0,
    maximumGapRuns: 1,
    failingReasons: [
      'no-evidence',
      'insufficient-span',
      'insufficient-assessments',
      'insufficient-active-buckets',
    ],
  }
}

function createHistoricalReadiness(): SerializedAnalyticsSummary['historicalReadiness'] {
  const readiness = createUnreadyReadiness()

  return {
    requested: readiness,
    recallQuality: { ...readiness },
    practiceRhythm: { ...readiness },
    ratingsMix: { ...readiness },
    topics: { ...readiness },
    stability: { ...readiness },
    overdueBacklog: { ...readiness },
    recommendedRange: null,
  }
}

export function createSerializedAnalyticsSummary(
  overrides?: Partial<SerializedAnalyticsSummary>,
): SerializedAnalyticsSummary {
  return {
    chartDataStatus: 'unavailable',
    presentationMeta: {
      asOf: '2026-05-30T00:00:00.000Z',
      timeZone: 'UTC',
      timeZoneFallback: false,
      range: 30,
      periodStart: '2026-05-01T00:00:00.000Z',
      periodEnd: '2026-05-31T00:00:00.000Z',
      isPartial: true,
    },
    range: 30,
    periodStart: '2026-04-30T00:00:00.000Z',
    periodEnd: '2026-05-30T00:00:00.000Z',
    generatedAt: '2026-05-30T00:00:00.000Z',
    reviewDays: 30,
    totalReviews: 150,
    currentStreak: 7,
    observedRatingQuality: { value: 0.85, sampleSize: 50, lowSample: false },
    predictedRecall: { value: null, sampleSize: 0, lowSample: true },
    observedRatingSampleSize: 50,
    lowSample: false,
    dueForecast14Days: Array.from({ length: 14 }, (_, i) => {
      const dateStr = `2026-01-${String(15 + i).padStart(2, '0')}`
      return {
        date: dateStr,
        dueCount: (i + 1) * 2,
      }
    }),
    weakProblems: [
      {
        slug: 'two-sum',
        title: 'Two Sum',
        lapseCount: 2,
        difficulty: 0.7,
        retrievability: 0.65,
      },
      {
        slug: 'add-binary',
        title: 'Add Binary',
        lapseCount: 1,
        difficulty: 0.75,
        retrievability: 0.72,
      },
    ],
    memoryProfile: {
      totalTracked: 12,
      dueToday: 3,
      overdue: 1,
      learning: 2,
      review: 8,
      mastered: 1,
      suspended: 1,
      averageRetrievability: 0.74,
      lowSample: false,
    },
    targetRetention: 0.9,
    retentionScatter: [],
    retentionScatterCurve: [],
    historicalReadiness: createHistoricalReadiness(),
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
    upcomingLoad: Array.from({ length: 14 }, (_, i) => ({
      date: `2026-01-${String(15 + i).padStart(2, '0')}`,
      dueCount: i === 0 ? 3 : 0,
      overdueCount: i === 0 ? 1 : 0,
      today: i === 0,
    })),
    retentionHealth: [],
    fragileKnowledge: [],
    ...overrides,
  }
}
