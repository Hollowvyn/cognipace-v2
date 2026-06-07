import { z } from 'zod'

export const analyticsSummaryRequestSchema = z.object({
  surface: z.literal('dashboard'),
  at: z.iso.datetime().optional(),
})

export type AnalyticsSummaryRequest = z.infer<
  typeof analyticsSummaryRequestSchema
>

export const weakProblemSchema = z.object({
  slug: z.string(),
  title: z.string(),
  lapseCount: z.number().int().nonnegative(),
  difficulty: z.number(),
  retrievability: z.number(),
})

export const forecastEntrySchema = z.object({
  date: z.string(),
  dueCount: z.number().int().nonnegative(),
})

export const memoryProfileSchema = z.object({
  totalTracked: z.number().int().nonnegative(),
  dueToday: z.number().int().nonnegative(),
  overdue: z.number().int().nonnegative(),
  learning: z.number().int().nonnegative(),
  review: z.number().int().nonnegative(),
  mastered: z.number().int().nonnegative(),
  suspended: z.number().int().nonnegative(),
  averageRetrievability: z.number().min(0).max(1).nullable(),
  lowSample: z.boolean(),
})

export const retentionScatterEntrySchema = z.object({
  slug: z.string(),
  title: z.string(),
  retrievability: z.number().min(0).max(1),
  daysSinceReview: z.number().int().nonnegative(),
  difficulty: z.number(),
  stability: z.number(),
  lapseCount: z.number().int().nonnegative(),
  lastReviewAt: z.string(),
})

export const referenceCurvePointSchema = z.object({
  days: z.number().int().nonnegative(),
  retrievability: z.number().min(0).max(1),
})

export const analyticsSummarySchema = z.object({
  generatedAt: z.string(),
  reviewDays: z.number().int().nonnegative(),
  totalReviews: z.number().int().nonnegative(),
  currentStreak: z.number().int().nonnegative(),
  retentionProxy: z.number(),
  retentionProxyLabel: z.string(),
  retentionSampleSize: z.number().int().nonnegative(),
  lowSample: z.boolean(),
  dueForecast14Days: z.array(forecastEntrySchema).length(14),
  weakProblems: z.array(weakProblemSchema).max(10),
  memoryProfile: memoryProfileSchema,
  targetRetention: z.number().min(0).max(1),
  retentionScatter: z.array(retentionScatterEntrySchema),
  retentionScatterCurve: z.array(referenceCurvePointSchema),
})

export type SerializedAnalyticsSummary = z.infer<typeof analyticsSummarySchema>
