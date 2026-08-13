import { z } from 'zod'

export const analyticsRangeSchema = z.union([
  z.literal(14),
  z.literal(30),
  z.literal(90),
])

export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>

const percentageSchema = z.number().min(0).max(1)
const countSchema = z.number().int().nonnegative()
const nullablePercentageSchema = percentageSchema.nullable()

export const readinessFailureSchema = z.enum([
  'no-evidence',
  'insufficient-span',
  'insufficient-assessments',
  'insufficient-active-buckets',
  'gap-too-long',
  'too-many-gaps',
])

export const analyticsReadinessSchema = z.object({
  ready: z.boolean(),
  requestedDays: z.number().int().positive(),
  bucketDays: z.number().int().positive(),
  requestedBuckets: z.number().int().positive(),
  effectiveBuckets: countSchema,
  effectiveStart: z.string().nullable(),
  assessments: countSchema,
  minimumAssessments: z.number().int().positive(),
  activeBuckets: countSchema,
  minimumActiveBuckets: countSchema,
  longestGap: countSchema,
  maximumGap: z.number().int().positive(),
  gapRuns: countSchema,
  maximumGapRuns: z.number().int().positive(),
  failingReasons: z.array(readinessFailureSchema),
})

export type AnalyticsReadiness = z.infer<typeof analyticsReadinessSchema>
export type ReadinessFailure = z.infer<typeof readinessFailureSchema>

export const analyticsMetricSummarySchema = z.union([
  z.object({
    value: z.null(),
    sampleSize: countSchema,
    lowSample: z.literal(true),
  }),
  z.object({
    value: percentageSchema,
    sampleSize: countSchema,
    lowSample: z.literal(false),
  }),
])

export type AnalyticsMetricSummary = z.infer<
  typeof analyticsMetricSummarySchema
>

export const analyticsSummaryRequestSchema = z.object({
  surface: z.literal('dashboard'),
  range: analyticsRangeSchema,
  at: z.iso.datetime().optional(),
})

export type AnalyticsSummaryRequest = z.infer<
  typeof analyticsSummaryRequestSchema
>

export const weakProblemSchema = z.object({
  slug: z.string(),
  title: z.string(),
  lapseCount: countSchema,
  difficulty: z.number(),
  retrievability: percentageSchema,
})

export const forecastEntrySchema = z.object({
  date: z.string(),
  dueCount: countSchema,
})

export const memoryProfileSchema = z.object({
  totalTracked: countSchema,
  dueToday: countSchema,
  overdue: countSchema,
  learning: countSchema,
  review: countSchema,
  mastered: countSchema,
  suspended: countSchema,
  averageRetrievability: nullablePercentageSchema,
  lowSample: z.boolean(),
})

export const retentionScatterEntrySchema = z.object({
  slug: z.string(),
  title: z.string(),
  retrievability: percentageSchema,
  daysSinceReview: countSchema,
  difficulty: z.number(),
  stability: z.number().nonnegative(),
  lapseCount: countSchema,
  lastReviewAt: z.string(),
})

export const referenceCurvePointSchema = z.object({
  days: countSchema,
  retrievability: percentageSchema,
})

export const recallQualityPointSchema = z.object({
  bucketStart: z.string(),
  bucketEnd: z.string(),
  observedRecall: nullablePercentageSchema,
  predictedRecall: nullablePercentageSchema,
  targetRetention: percentageSchema,
  reviewCount: countSchema,
  eligibleSampleSize: countSchema,
})

export const practiceRhythmPointSchema = z.object({
  bucketStart: z.string(),
  bucketEnd: z.string(),
  reviewCount: countSchema,
  observedCorrectness: nullablePercentageSchema,
  sampleSize: countSchema,
  associationOnly: z.literal(true),
})

export const ratingsMixPointSchema = z.object({
  bucketStart: z.string(),
  bucketEnd: z.string(),
  again: countSchema,
  hard: countSchema,
  good: countSchema,
  easy: countSchema,
  total: countSchema,
  hardAgainShare: nullablePercentageSchema,
})

export const hardAgainSummarySchema = z.object({
  selectedShare: nullablePercentageSchema,
  previousShare: nullablePercentageSchema,
  delta: z.number().min(-1).max(1).nullable(),
  direction: z.enum(['up', 'down', 'flat']).nullable(),
  sampleSize: countSchema,
  previousSampleSize: countSchema,
  lowSample: z.boolean(),
  previousLowSample: z.boolean(),
})

export const topicPointSchema = z.object({
  topic: z.string(),
  recallQuality: nullablePercentageSchema,
  sampleSize: countSchema,
  lowSample: z.boolean(),
})

export const stabilityPointSchema = z.object({
  bucketStart: z.string(),
  bucketEnd: z.string(),
  medianStabilityDays: z.number().nonnegative().nullable(),
  sampleSize: countSchema,
})

export const overdueBacklogPointSchema = z.discriminatedUnion(
  'historyAvailable',
  [
    z.object({
      bucketStart: z.string(),
      bucketEnd: z.string(),
      overdueCount: countSchema,
      historyAvailable: z.literal(true),
    }),
    z.object({
      bucketStart: z.string(),
      bucketEnd: z.string(),
      overdueCount: z.null(),
      historyAvailable: z.literal(false),
    }),
  ],
)

export const historicalReadinessSchema = z.object({
  requested: analyticsReadinessSchema,
  recallQuality: analyticsReadinessSchema,
  practiceRhythm: analyticsReadinessSchema,
  ratingsMix: analyticsReadinessSchema,
  topics: analyticsReadinessSchema,
  stability: analyticsReadinessSchema,
  overdueBacklog: analyticsReadinessSchema,
  recommendedRange: analyticsRangeSchema.nullable(),
})

export const upcomingLoadPointSchema = z.object({
  date: z.string(),
  dueCount: countSchema,
  overdueCount: countSchema,
  today: z.boolean(),
})

export const retentionHealthPointSchema = z.object({
  slug: z.string(),
  title: z.string(),
  retrievability: percentageSchema,
  targetRetention: percentageSchema,
  daysSinceReview: countSchema,
  stabilityDays: z.number().nonnegative(),
  difficulty: z.number(),
  lapseCount: countSchema,
  overdueDays: countSchema,
})

export const fragileKnowledgeSchema = z.object({
  slug: z.string(),
  title: z.string(),
  retrievability: percentageSchema,
  stabilityDays: z.number().nonnegative(),
  difficulty: z.number(),
  lapseCount: countSchema,
  overdueDays: countSchema,
  topics: z.array(z.string()),
})

export const analyticsSummarySchema = z
  .object({
    chartDataStatus: z.enum(['unavailable', 'unready', 'ready']),
    range: analyticsRangeSchema,
    periodStart: z.iso.datetime(),
    periodEnd: z.iso.datetime(),
    generatedAt: z.iso.datetime(),
    reviewDays: countSchema,
    totalReviews: countSchema,
    currentStreak: countSchema,
    observedRatingQuality: analyticsMetricSummarySchema,
    predictedRecall: analyticsMetricSummarySchema,
    observedRatingSampleSize: countSchema,
    lowSample: z.boolean(),
    dueForecast14Days: z.array(forecastEntrySchema).length(14),
    weakProblems: z.array(weakProblemSchema).max(10),
    memoryProfile: memoryProfileSchema,
    targetRetention: percentageSchema,
    retentionScatter: z.array(retentionScatterEntrySchema),
    retentionScatterCurve: z.array(referenceCurvePointSchema),
    historicalReadiness: historicalReadinessSchema,
    recallQuality: z.array(recallQualityPointSchema),
    practiceRhythm: z.array(practiceRhythmPointSchema),
    ratingsMix: z.array(ratingsMixPointSchema),
    hardAgain: hardAgainSummarySchema,
    topics: z.array(topicPointSchema),
    stability: z.array(stabilityPointSchema),
    overdueBacklog: z.array(overdueBacklogPointSchema),
    overdueHistoryAvailableFrom: z.iso.datetime().nullable(),
    upcomingLoad: z.array(upcomingLoadPointSchema).length(14),
    retentionHealth: z.array(retentionHealthPointSchema),
    fragileKnowledge: z.array(fragileKnowledgeSchema),
  })
  .superRefine((summary, context) => {
    if (summary.chartDataStatus !== 'unavailable') return

    if (
      summary.predictedRecall.value !== null ||
      summary.predictedRecall.sampleSize !== 0 ||
      summary.predictedRecall.lowSample !== true
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Unavailable chart data must use an empty low-sample predicted recall metric.',
        path: ['predictedRecall'],
      })
    }

    const chartFields = [
      'retentionScatter',
      'retentionScatterCurve',
      'recallQuality',
      'practiceRhythm',
      'ratingsMix',
      'topics',
      'stability',
      'overdueBacklog',
      'retentionHealth',
      'fragileKnowledge',
    ] as const

    for (const field of chartFields) {
      if (summary[field].length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Unavailable chart data must not include chart series.',
          path: [field],
        })
      }
    }
  })

export type SerializedAnalyticsSummary = z.infer<typeof analyticsSummarySchema>
