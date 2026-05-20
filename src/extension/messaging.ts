import { defineExtensionMessaging } from '@webext-core/messaging'
import { z } from 'zod'

import {
  leetcodeProblemRemoteRequestSchema,
  leetcodeSubmissionResultRemoteRequestSchema,
  type SerializedLeetCodeMetadataResult,
  type SerializedLeetCodeProblemContentResult,
  type SerializedLeetCodeSubmissionResultRemoteResponse,
} from '@/features/leetcode-capture/api/leetcode-capture-contracts'
import {
  practicePhases,
  practiceStatuses,
  reviewModes,
} from '@/features/practice/domain'
import { problemDifficulties } from '@/features/problems'
import { type UserSettings, userSettingsPatchSchema } from '@/features/settings'
import { fsrsCardStates, reviewRatings } from '@/lib/fsrs'

export const extensionSurfaceSchema = z.enum([
  'background',
  'popup',
  'dashboard',
  'content-script',
])

export type ExtensionSurface = z.infer<typeof extensionSurfaceSchema>

export const uiSurfaceSchema = z.enum(['popup', 'dashboard', 'content-script'])

export type UiSurface = z.infer<typeof uiSurfaceSchema>

export const appShellDataSchema = z.object({
  status: z.object({
    label: z.string(),
    detail: z.string(),
  }),
  metrics: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    }),
  ),
  recommendation: z.object({
    title: z.string(),
    detail: z.string(),
  }),
  activeTrack: z.object({
    title: z.string(),
    detail: z.string(),
  }),
})

export type AppShellData = z.infer<typeof appShellDataSchema>

const serializedProblemSchema = z.object({
  id: z.string(),
  source: z.literal('leetcode'),
  externalId: z.string().nullable(),
  slug: z.string(),
  title: z.string(),
  difficulty: z.enum(problemDifficulties),
  url: z.string(),
  isPremium: z.boolean(),
  acceptanceRate: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type SerializedProblem = z.infer<typeof serializedProblemSchema>

export const problemContextSchema = z
  .object({
    problem: serializedProblemSchema,
    isTracked: z.boolean(),
    practiceStatus: z.string().nullable(),
    dueAt: z.string().nullable(),
  })
  .nullable()

export type SerializedProblemContext = z.infer<typeof problemContextSchema>

export const practiceLogSnapshotSchema = z.object({
  interviewPattern: z.string().nullable(),
  timeComplexity: z.string().nullable(),
  spaceComplexity: z.string().nullable(),
  languages: z.string().nullable(),
  notes: z.string().nullable(),
})

export const reviewLogFieldsSchema = practiceLogSnapshotSchema.partial()

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

export const reviewResultSchema = z.object({
  problemId: z.string(),
  cardId: z.string(),
  rating: z.enum(reviewRatings),
  status: z.enum(practiceStatuses),
  dueAt: z.string(),
  reviewedAt: z.string(),
  summary: practiceSummarySchema,
})

export type SerializedReviewResult = z.infer<typeof reviewResultSchema>

export const queueItemSchema = z.object({
  category: z.enum(['due', 'new', 'reinforcement']),
  problemId: z.string(),
  title: z.string(),
  slug: z.string(),
  difficulty: z.enum(problemDifficulties),
  dueAt: z.string().nullable(),
  activeTrackPosition: z.number().nullable(),
  summary: practiceSummarySchema,
})

export const todayQueueSchema = z.object({
  generatedAt: z.string(),
  dailyGoal: z.number(),
  dueCount: z.number().int().min(0),
  newCount: z.number().int().min(0),
  reinforcementCount: z.number().int().min(0),
  items: z.array(queueItemSchema),
})

export type SerializedTodayQueue = z.infer<typeof todayQueueSchema>

export const activeTrackSchema = z
  .object({
    track: z.object({
      id: z.string(),
      slug: z.string(),
      title: z.string(),
      description: z.string().nullable(),
      isActive: z.boolean(),
    }),
    activeGroup: z
      .object({
        id: z.string(),
        trackId: z.string(),
        title: z.string(),
        position: z.number(),
      })
      .nullable(),
    nextProblem: serializedProblemSchema.nullable(),
  })
  .nullable()

export type SerializedActiveTrack = z.infer<typeof activeTrackSchema>

export const pingRequestSchema = z.object({
  surface: extensionSurfaceSchema,
})

export type PingRequest = z.infer<typeof pingRequestSchema>

export type PingResponse = {
  ok: true
  surface: ExtensionSurface
  receivedAt: string
}

export const appShellRequestSchema = z.object({
  surface: uiSurfaceSchema,
})

export type AppShellRequest = z.infer<typeof appShellRequestSchema>

export const problemsUpsertFromPageRequestSchema = z.object({
  surface: uiSurfaceSchema,
  url: z.string(),
  slug: z.string().nullish(),
  title: z.string().nullish(),
  difficulty: z.string().nullish(),
  isPremium: z.boolean().nullish(),
  externalId: z.string().nullish(),
  acceptanceRate: z.number().nullish(),
})

export type ProblemsUpsertFromPageRequest = z.infer<
  typeof problemsUpsertFromPageRequestSchema
>

export const problemContextRequestSchema = z.object({
  surface: uiSurfaceSchema,
  slug: z.string(),
})

export type ProblemContextRequest = z.infer<typeof problemContextRequestSchema>

export const practiceDetailsRequestSchema = z.object({
  surface: uiSurfaceSchema,
  problemId: z.string(),
  at: z.string().optional(),
})

export type PracticeDetailsRequest = z.infer<
  typeof practiceDetailsRequestSchema
>

export const practiceSaveReviewResultRequestSchema = z.object({
  surface: uiSurfaceSchema,
  problemId: z.string(),
  rating: z.enum(reviewRatings),
  reviewedAt: z.string().optional(),
  reviewMode: z.enum(['manual', 'leetcode']).optional(),
  elapsedSeconds: z.number().int().positive().nullish(),
  isCorrect: z.boolean().nullish(),
  notes: z.string().nullish(),
  log: reviewLogFieldsSchema.optional(),
})

export type PracticeSaveReviewResultRequest = z.infer<
  typeof practiceSaveReviewResultRequestSchema
>

export const practiceOverrideLastReviewResultRequestSchema = z
  .object({
    surface: uiSurfaceSchema,
    problemId: z.string(),
    rating: z.enum(reviewRatings),
    elapsedSeconds: z.number().int().positive().nullish(),
    isCorrect: z.boolean().nullish(),
    log: reviewLogFieldsSchema.optional(),
  })
  .strict()

export type PracticeOverrideLastReviewResultRequest = z.infer<
  typeof practiceOverrideLastReviewResultRequestSchema
>

export const queueRequestSchema = z.object({
  surface: z.enum(['popup', 'dashboard']),
  at: z.string().optional(),
})

export type QueueRequest = z.infer<typeof queueRequestSchema>

export const tracksRequestSchema = z.object({
  surface: z.enum(['popup', 'dashboard']),
})

export type TracksRequest = z.infer<typeof tracksRequestSchema>

export const settingsRequestSchema = z.object({
  surface: z.enum(['popup', 'dashboard']),
})

export type SettingsRequest = z.infer<typeof settingsRequestSchema>

export const settingsUpdateRequestSchema = z.object({
  surface: z.enum(['popup', 'dashboard']),
  patch: userSettingsPatchSchema,
})

export type SettingsUpdateRequest = z.infer<typeof settingsUpdateRequestSchema>

export const leetcodeProblemRemoteRuntimeRequestSchema =
  leetcodeProblemRemoteRequestSchema.extend({
    surface: z.literal('content-script'),
  })

export type LeetCodeProblemRemoteRuntimeRequest = z.infer<
  typeof leetcodeProblemRemoteRuntimeRequestSchema
>

export const leetcodeSubmissionResultRemoteRuntimeRequestSchema =
  leetcodeSubmissionResultRemoteRequestSchema.extend({
    surface: z.literal('content-script'),
  })

export type LeetCodeSubmissionResultRemoteRuntimeRequest = z.infer<
  typeof leetcodeSubmissionResultRemoteRuntimeRequestSchema
>

export interface ProtocolMap {
  'runtime.ping'(request: PingRequest): PingResponse
  'app.getShellData'(request: AppShellRequest): AppShellData
  'problems.upsertFromPage'(
    request: ProblemsUpsertFromPageRequest,
  ): SerializedProblem
  'problems.getContext'(
    request: ProblemContextRequest,
  ): SerializedProblemContext
  'practice.saveReviewResult'(
    request: PracticeSaveReviewResultRequest,
  ): SerializedReviewResult
  'practice.getDetails'(
    request: PracticeDetailsRequest,
  ): SerializedPracticeDetails
  'practice.overrideLastReviewResult'(
    request: PracticeOverrideLastReviewResultRequest,
  ): SerializedReviewResult
  'queue.getTodayQueue'(request: QueueRequest): SerializedTodayQueue
  'tracks.getActiveTrack'(request: TracksRequest): SerializedActiveTrack
  'settings.getSettings'(request: SettingsRequest): UserSettings
  'settings.updateSettings'(request: SettingsUpdateRequest): UserSettings
  'leetcode.readProblemMetadata'(
    request: LeetCodeProblemRemoteRuntimeRequest,
  ): SerializedLeetCodeMetadataResult
  'leetcode.readProblemContent'(
    request: LeetCodeProblemRemoteRuntimeRequest,
  ): SerializedLeetCodeProblemContentResult
  'leetcode.readSubmissionResult'(
    request: LeetCodeSubmissionResultRemoteRuntimeRequest,
  ): SerializedLeetCodeSubmissionResultRemoteResponse
}

const extensionMessenger = defineExtensionMessaging<ProtocolMap>()

export const onMessage = extensionMessenger.onMessage.bind(extensionMessenger)

export const sendMessage =
  extensionMessenger.sendMessage.bind(extensionMessenger)
