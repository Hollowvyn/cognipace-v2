import { z } from 'zod'

import { fsrsCardStates, reviewRatings } from '@/lib/fsrs'

import { practicePhases, practiceStatuses, reviewModes } from '../domain'

export const practiceRuntimeSurfaceSchema = z.enum([
  'popup',
  'dashboard',
  'content-script',
])

export const practiceLogSnapshotSchema = z.object({
  interviewPattern: z.string().nullable(),
  timeComplexity: z.string().nullable(),
  spaceComplexity: z.string().nullable(),
  languages: z.string().nullable(),
  notes: z.string().nullable(),
})

export const practiceLogPatchSchema = practiceLogSnapshotSchema.partial()

export const practiceSummarySchema = z.object({
  phase: z.enum(practicePhases),
  nextReviewAt: z.string().nullable(),
  lastReviewedAt: z.string().nullable(),
  reviewCount: z.number().int().min(0),
  lapses: z.number().int().min(0),
  difficulty: z.number().nullable(),
  stability: z.number().nullable(),
  scheduledDays: z.number().int().min(0).nullable(),
  suspended: z.boolean(),
  isStarted: z.boolean(),
  isDue: z.boolean(),
  isOverdue: z.boolean(),
  overdueDays: z.number().int().min(0),
  retrievability: z.number().nullable(),
})

export const fsrsCardSnapshotSchema = z.object({
  dueAt: z.string(),
  stability: z.number(),
  difficulty: z.number(),
  elapsedDays: z.number().int(),
  scheduledDays: z.number().int(),
  learningSteps: z.number().int(),
  reps: z.number().int().min(0),
  lapses: z.number().int().min(0),
  state: z.enum(fsrsCardStates),
  lastReviewAt: z.string().nullable(),
})

export const practiceStateSnapshotSchema = z.object({
  status: z.enum(practiceStatuses),
  lastReviewedAt: z.string().nullable(),
  attemptCount: z.number().int().min(0),
  solvedCount: z.number().int().min(0),
  isSuspended: z.boolean(),
  lastRating: z.enum(reviewRatings).nullable(),
  lastElapsedSeconds: z.number().int().positive().nullable(),
  bestElapsedSeconds: z.number().int().positive().nullable(),
  log: practiceLogSnapshotSchema,
})

export const practiceReviewAttemptSchema = z.object({
  id: z.string(),
  problemId: z.string(),
  cardId: z.string(),
  rating: z.enum(reviewRatings),
  reviewMode: z.enum(reviewModes),
  reviewedAt: z.string(),
  elapsedSeconds: z.number().int().positive().nullable(),
  isCorrect: z.boolean().nullable(),
  log: practiceLogSnapshotSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const practiceDetailsSchema = z.object({
  problemId: z.string(),
  cardId: z.string(),
  practice: practiceStateSnapshotSchema.nullable(),
  card: fsrsCardSnapshotSchema.nullable(),
  summary: practiceSummarySchema,
  currentLog: practiceLogSnapshotSchema,
  recentAttempts: z.array(practiceReviewAttemptSchema),
  latestAttempt: practiceReviewAttemptSchema.nullable(),
  canOverrideLatestReview: z.boolean(),
})

export type SerializedPracticeDetails = z.infer<typeof practiceDetailsSchema>

export const practiceReviewResultSchema = z.object({
  problemId: z.string(),
  cardId: z.string(),
  rating: z.enum(reviewRatings),
  status: z.enum(practiceStatuses),
  dueAt: z.string(),
  reviewedAt: z.string(),
  summary: practiceSummarySchema,
})

export type SerializedReviewResult = z.infer<typeof practiceReviewResultSchema>

export const practiceDetailsRequestSchema = z.object({
  surface: practiceRuntimeSurfaceSchema,
  problemId: z.string(),
  at: z.string().optional(),
})

export type PracticeDetailsRequest = z.infer<
  typeof practiceDetailsRequestSchema
>

export const practiceSaveReviewResultRequestSchema = z.object({
  surface: practiceRuntimeSurfaceSchema,
  problemId: z.string(),
  rating: z.enum(reviewRatings),
  reviewedAt: z.string().optional(),
  reviewMode: z.enum(reviewModes).optional(),
  elapsedSeconds: z.number().int().positive().nullish(),
  isCorrect: z.boolean().nullish(),
  notes: z.string().nullish(),
  log: practiceLogPatchSchema.optional(),
})

export type PracticeSaveReviewResultRequest = z.infer<
  typeof practiceSaveReviewResultRequestSchema
>

export const practiceOverrideLastReviewResultRequestSchema = z
  .object({
    surface: practiceRuntimeSurfaceSchema,
    problemId: z.string(),
    rating: z.enum(reviewRatings),
    elapsedSeconds: z.number().int().positive().nullish(),
    isCorrect: z.boolean().nullish(),
    log: practiceLogPatchSchema.optional(),
  })
  .strict()

export type PracticeOverrideLastReviewResultRequest = z.infer<
  typeof practiceOverrideLastReviewResultRequestSchema
>

export const practiceSetSuspendedRequestSchema = z.object({
  surface: practiceRuntimeSurfaceSchema,
  problemId: z.string(),
  suspended: z.boolean(),
})

export type PracticeSetSuspendedRequest = z.infer<
  typeof practiceSetSuspendedRequestSchema
>

export const practiceResetScheduleRequestSchema = z.object({
  surface: practiceRuntimeSurfaceSchema,
  problemId: z.string(),
  keepLog: z.boolean().optional(),
})

export type PracticeResetScheduleRequest = z.infer<
  typeof practiceResetScheduleRequestSchema
>

export const practiceUpdateCurrentLogRequestSchema = z.object({
  surface: practiceRuntimeSurfaceSchema,
  problemId: z.string(),
  log: practiceLogPatchSchema,
})

export type PracticeUpdateCurrentLogRequest = z.infer<
  typeof practiceUpdateCurrentLogRequestSchema
>
