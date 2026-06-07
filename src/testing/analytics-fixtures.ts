import type { SerializedAnalyticsSummary } from '@/features/analytics/api/analytics-contracts'

export function createSerializedAnalyticsSummary(
  overrides?: Partial<SerializedAnalyticsSummary>,
): SerializedAnalyticsSummary {
  return {
    generatedAt: '2026-05-30T00:00:00.000Z',
    reviewDays: 30,
    totalReviews: 150,
    currentStreak: 7,
    retentionProxy: 0.85,
    retentionProxyLabel: 'Good',
    retentionSampleSize: 50,
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
    ...overrides,
  }
}
