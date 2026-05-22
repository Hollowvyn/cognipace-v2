import { defineExtensionMessaging } from '@webext-core/messaging'
import { z } from 'zod'

import type {
  AppShellData,
  AppShellRequest,
} from '@/features/app-shell/api/app-shell-contracts'
import {
  leetcodeProblemRemoteRequestSchema,
  leetcodeSubmissionResultRemoteRequestSchema,
  type SerializedLeetCodeMetadataResult,
  type SerializedLeetCodeProblemContentResult,
  type SerializedLeetCodeSubmissionResultRemoteResponse,
} from '@/features/leetcode-capture/api/leetcode-capture-contracts'
import {
  practiceSummarySchema,
  type PracticeDetailsRequest,
  type PracticeOverrideLastReviewResultRequest,
  type PracticeResetScheduleRequest,
  type PracticeSaveReviewResultRequest,
  type PracticeSetSuspendedRequest,
  type PracticeUpdateCurrentLogRequest,
  type SerializedPracticeDetails,
} from '@/features/practice/api/practice-contracts'
import { problemDifficulties } from '@/features/problems'
import type { UserSettings } from '@/features/settings'
export {
  settingsRequestSchema,
  settingsToggleStudyModeRequestSchema,
  settingsUpdateRequestSchema,
} from '@/features/settings/api/settings-contracts'
import {
  type SettingsRequest,
  type SettingsToggleStudyModeRequest,
  type SettingsUpdateRequest,
} from '@/features/settings/api/settings-contracts'
import { cacheInvalidationTags } from '@/platform/query/cache-invalidation'

export const extensionSurfaceSchema = z.enum([
  'background',
  'popup',
  'dashboard',
  'content-script',
])

export type ExtensionSurface = z.infer<typeof extensionSurfaceSchema>

export const uiSurfaceSchema = z.enum(['popup', 'dashboard', 'content-script'])

export type UiSurface = z.infer<typeof uiSurfaceSchema>

export const cacheInvalidationReasonSchema = z.enum([
  'practice-updated',
  'problem-catalog-updated',
  'settings-updated',
  'tracks-updated',
])

export const cacheInvalidationEventSchema = z.object({
  emittedAt: z.iso.datetime(),
  problemId: z.string().optional(),
  problemSlug: z.string().optional(),
  reason: cacheInvalidationReasonSchema,
  source: uiSurfaceSchema,
  tags: z.array(z.enum(cacheInvalidationTags)).min(1),
})

export type CacheInvalidationEvent = z.infer<
  typeof cacheInvalidationEventSchema
>

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

export const queueItemSchema = z.object({
  category: z.enum(['due', 'new', 'reinforcement']),
  problemId: z.string(),
  title: z.string(),
  slug: z.string(),
  difficulty: z.enum(problemDifficulties),
  url: z.string(),
  isPremium: z.boolean(),
  dueAt: z.iso.datetime().nullable(),
  summary: practiceSummarySchema,
})

export const todayQueueSchema = z.object({
  generatedAt: z.iso.datetime(),
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
      dueAt: z.iso.datetime().nullable(),
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
    progress: z
      .object({
        completedCount: z.number().int().min(0),
        totalCount: z.number().int().min(0),
        percent: z.number().int().min(0).max(100),
      })
      .superRefine((progress, context) => {
        if (progress.completedCount > progress.totalCount) {
          context.addIssue({
            code: 'custom',
            message: 'completedCount cannot exceed totalCount',
            path: ['completedCount'],
          })
        }

        const expectedPercent =
          progress.totalCount === 0
            ? 0
            : Math.round((progress.completedCount / progress.totalCount) * 100)

        if (progress.percent !== expectedPercent) {
          context.addIssue({
            code: 'custom',
            message: 'percent must match completedCount and totalCount',
            path: ['percent'],
          })
        }
      }),
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

export const queueRequestSchema = z.object({
  surface: z.enum(['popup', 'dashboard']),
  at: z.iso.datetime().optional(),
})

export type QueueRequest = z.infer<typeof queueRequestSchema>

export const tracksRequestSchema = z.object({
  surface: z.enum(['popup', 'dashboard']),
})

export type TracksRequest = z.infer<typeof tracksRequestSchema>

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
  'cache.invalidate'(request: CacheInvalidationEvent): null
  'runtime.ping'(request: PingRequest): PingResponse
  'app.getShellData'(request: AppShellRequest): AppShellData
  'problems.upsertFromPage'(
    request: ProblemsUpsertFromPageRequest,
  ): SerializedProblem
  'practice.saveReviewResult'(
    request: PracticeSaveReviewResultRequest,
  ): SerializedPracticeDetails
  'practice.getDetails'(
    request: PracticeDetailsRequest,
  ): SerializedPracticeDetails
  'practice.overrideLastReviewResult'(
    request: PracticeOverrideLastReviewResultRequest,
  ): SerializedPracticeDetails
  'practice.setSuspended'(
    request: PracticeSetSuspendedRequest,
  ): SerializedPracticeDetails
  'practice.resetSchedule'(
    request: PracticeResetScheduleRequest,
  ): SerializedPracticeDetails
  'practice.updateCurrentLog'(
    request: PracticeUpdateCurrentLogRequest,
  ): SerializedPracticeDetails
  'queue.getTodayQueue'(request: QueueRequest): SerializedTodayQueue
  'tracks.getActiveTrack'(request: TracksRequest): SerializedActiveTrack
  'settings.getSettings'(request: SettingsRequest): UserSettings
  'settings.updateSettings'(request: SettingsUpdateRequest): UserSettings
  'settings.toggleStudyMode'(request: SettingsToggleStudyModeRequest): null
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
