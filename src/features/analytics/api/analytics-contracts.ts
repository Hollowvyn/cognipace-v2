import { z } from 'zod'

export const analyticsSummaryRequestSchema = z.object({})

export type AnalyticsSummaryRequest = z.infer<typeof analyticsSummaryRequestSchema>

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
})

export type SerializedAnalyticsSummary = z.infer<typeof analyticsSummarySchema>
