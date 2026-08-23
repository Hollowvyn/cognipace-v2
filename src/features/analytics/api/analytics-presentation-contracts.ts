import { z } from 'zod'

export const analyticsViewIdSchema = z.enum([
  'observed-recall-vs-fsrs',
  'memory-strength',
  'practice-rhythm',
  'ratings-mix',
  'topic-performance',
  'retention-map',
  'memory-signals',
  'overdue-backlog',
  'upcoming-review-load',
])

export type AnalyticsViewId = z.infer<typeof analyticsViewIdSchema>

const analyticsPresentationRangeSchema = z.union([
  z.literal(14),
  z.literal(30),
  z.literal(90),
])

export const analyticsPresentationMetaSchema = z.object({
  asOf: z.iso.datetime(),
  timeZone: z.string().min(1),
  timeZoneFallback: z.boolean(),
  range: analyticsPresentationRangeSchema,
  periodStart: z.iso.datetime(),
  periodEnd: z.iso.datetime(),
  isPartial: z.boolean(),
})

export type AnalyticsPresentationMeta = z.infer<
  typeof analyticsPresentationMetaSchema
>

export const analyticsEvidenceLabelSchema = z.enum([
  'measured',
  'in-progress',
  'reconstructed',
  'not-measured',
  'insufficient-evidence',
])

export type AnalyticsEvidenceLabel = z.infer<
  typeof analyticsEvidenceLabelSchema
>

export const analyticsEvidenceSchema = z.object({
  labels: z.array(analyticsEvidenceLabelSchema),
  sampleSize: z.number().int().nonnegative(),
  activeBuckets: z.number().int().nonnegative(),
  requestedBuckets: z.number().int().nonnegative(),
  effectiveBuckets: z.number().int().nonnegative(),
  longestGap: z.number().int().nonnegative(),
  gapRuns: z.number().int().nonnegative(),
  trendSupported: z.boolean(),
})

export type AnalyticsEvidence = z.infer<typeof analyticsEvidenceSchema>
