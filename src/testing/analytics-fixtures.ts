import type { SerializedAnalyticsSummary } from '@/features/analytics/api/analytics-contracts'

export const analyticsChartPointFixtures = {
  consistency: [
    {
      week: '2026-05-25',
      reviewDays: 4,
      observedCorrectness: 0.75,
      sampleSize: 8,
      associationOnly: true,
    },
  ],
  ratingsMix: [
    {
      date: '2026-05-30',
      again: 1,
      hard: 2,
      good: 4,
      easy: 1,
      total: 8,
      hardAgainShare: 0.375,
    },
  ],
} satisfies Pick<SerializedAnalyticsSummary, 'consistency' | 'ratingsMix'>

export function createSerializedAnalyticsSummary(
  overrides?: Partial<SerializedAnalyticsSummary>,
): SerializedAnalyticsSummary {
  return {
    chartDataStatus: 'unavailable',
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
    recallQuality: [],
    consistency: [],
    ratingsMix: [],
    topics: [],
    stability: [],
    overdueBacklog: [],
    overdueHistoryAvailableFrom: null,
    upcomingLoad: [],
    retentionHealth: [],
    fragileKnowledge: [],
    ...overrides,
  }
}
