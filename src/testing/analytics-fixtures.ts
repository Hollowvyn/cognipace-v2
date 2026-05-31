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
      const date = new Date(new Date().getTime() + i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0] || '2026-05-30'
      return {
        date: dateStr,
        dueCount: Math.floor(Math.random() * 15) + (i === 0 ? 5 : 0),
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
    ...overrides,
  }
}
