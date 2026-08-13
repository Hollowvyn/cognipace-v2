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

export const analyticsMetricSummarySchema = z.object({
  value: nullablePercentageSchema,
  sampleSize: countSchema,
  lowSample: z.boolean(),
})

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
  date: z.string(),
  observedRecall: nullablePercentageSchema,
  predictedRecall: nullablePercentageSchema,
  targetRetention: percentageSchema,
  reviewCount: countSchema,
  eligibleSampleSize: countSchema,
})

export const consistencyPointSchema = z.object({
  week: z.string(),
  reviewDays: countSchema,
  firstPassRecall: nullablePercentageSchema,
  sampleSize: countSchema,
})

export const ratingsMixPointSchema = z.object({
  date: z.string(),
  again: countSchema,
  hard: countSchema,
  good: countSchema,
  easy: countSchema,
  total: countSchema,
})

export const topicPointSchema = z.object({
  topic: z.string(),
  recallQuality: nullablePercentageSchema,
  sampleSize: countSchema,
  lowSample: z.boolean(),
})

export const stabilityPointSchema = z.object({
  week: z.string(),
  medianStabilityDays: z.number().nonnegative().nullable(),
  sampleSize: countSchema,
})

export const overdueBacklogPointSchema = z.object({
  date: z.string(),
  overdueCount: countSchema,
  historyAvailable: z.boolean(),
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
  chartDataStatus: z.enum(['unavailable', 'ready']),
  range: analyticsRangeSchema,
  periodStart: z.iso.datetime(),
  periodEnd: z.iso.datetime(),
  generatedAt: z.iso.datetime(),
  reviewDays: countSchema,
  totalReviews: countSchema,
  currentStreak: countSchema,
  observedRecallQuality: analyticsMetricSummarySchema,
  predictedRecall: analyticsMetricSummarySchema,
  retentionSampleSize: countSchema,
  lowSample: z.boolean(),
  dueForecast14Days: z.array(forecastEntrySchema).length(14),
  weakProblems: z.array(weakProblemSchema).max(10),
  memoryProfile: memoryProfileSchema,
  targetRetention: percentageSchema,
  retentionScatter: z.array(retentionScatterEntrySchema),
  retentionScatterCurve: z.array(referenceCurvePointSchema),
  recallQuality: z.array(recallQualityPointSchema),
  consistency: z.array(consistencyPointSchema),
  ratingsMix: z.array(ratingsMixPointSchema),
  topics: z.array(topicPointSchema),
  stability: z.array(stabilityPointSchema),
  overdueBacklog: z.array(overdueBacklogPointSchema),
  upcomingLoad: z.array(upcomingLoadPointSchema),
  retentionHealth: z.array(retentionHealthPointSchema),
    fragileKnowledge: z.array(fragileKnowledgeSchema),
  })
  .superRefine((summary, context) => {
    if (summary.chartDataStatus !== 'unavailable') return

    if (summary.predictedRecall.value !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Unavailable chart data must not include predicted recall.',
        path: ['predictedRecall', 'value'],
      })
    }

    const chartFields = [
      'retentionScatter',
      'retentionScatterCurve',
      'recallQuality',
      'consistency',
      'ratingsMix',
      'topics',
      'stability',
      'overdueBacklog',
      'upcomingLoad',
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
