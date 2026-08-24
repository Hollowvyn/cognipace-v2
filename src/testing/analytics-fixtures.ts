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

const historicalEvidence = {
  historyDays: 30,
  measuredBuckets: 1,
  observations: 8,
  selectedBucketCount: 5,
  tableOnly: false,
  displayMode: 'single' as const,
  supportsLine: false,
  supportsDirection: false,
}

export function createSerializedAnalyticsSummary(
  overrides?: Partial<SerializedAnalyticsSummary>,
): SerializedAnalyticsSummary {
  return {
    range: 90,
    generatedAt: '2026-05-30T00:00:00.000Z',
    timeFrame: {
      asOf: '2026-05-30T00:00:00.000Z',
      timeZone: 'UTC',
      timeZoneFallback: false,
      requestedRange: 90,
      periodStart: '2026-03-02T00:00:00.000Z',
      periodEnd: '2026-05-31T00:00:00.000Z',
      bucketGrain: 'week',
      allTimeUnsupported: false,
      buckets: [
        {
          key: '2026-05-01',
          start: '2026-05-01T00:00:00.000Z',
          end: '2026-05-04T00:00:00.000Z',
          startKey: '2026-05-01',
          endKey: '2026-05-03',
          isPartial: false,
        },
      ],
    },
    reviewDays: 30,
    totalReviews: 150,
    currentStreak: 7,
    observedRatingQuality: { value: 0.85, sampleSize: 50, lowSample: false },
    predictedRecall: { value: null, sampleSize: 0, lowSample: true },
    observedRatingSampleSize: 50,
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
          date: `1970-01-${String(index + 1).padStart(2, '0')}`,
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
    ...overrides,
  }
}
