import { defineExtensionMessaging } from '@webext-core/messaging'
import { z } from 'zod'

import type {
  AppShellData,
  AppShellRequest,
} from '@/features/app-shell/api/app-shell-contracts'
import type {
  BackupFile,
  BackupPayloadRequest,
  BackupRequest,
  BackupSummary,
} from '@/features/backup/api/backup-contracts'
export {
  backupFileSchema,
  backupPayloadRequestSchema,
  backupRequestSchema,
  backupSummarySchema,
} from '@/features/backup/api/backup-contracts'
import {
  leetcodeProblemRemoteRequestSchema,
  leetcodeSubmissionResultRemoteRequestSchema,
  type SerializedLeetCodeMetadataResult,
  type SerializedLeetCodeProblemContentResult,
  type SerializedLeetCodeSubmissionResultRemoteResponse,
} from '@/features/leetcode-capture/api/leetcode-capture-contracts'
import {
  normalizedPracticeStateSchema,
  type PracticeDetailsRequest,
  type PracticeOverrideLastReviewResultRequest,
  type PracticeResetScheduleRequest,
  type PracticeSaveReviewResultRequest,
  type PracticeSetSuspendedRequest,
  type PracticeUpdateCurrentLogRequest,
  type SerializedPracticeDetails,
} from '@/features/practice/api/practice-contracts'
import {
  problemDifficultySchema,
  problemSlugSchema,
  type ProblemBulkUpdateResponse,
  type ProblemDeleteResponse,
  type ProblemForEditResponse,
  type ProblemLibraryResponse,
  type ProblemsBulkDeleteRequest,
  type ProblemsBulkUpdateProblemsRequest,
  type ProblemsCreateProblemRequest,
  type ProblemsDeleteProblemRequest,
  type ProblemsGetLibraryRequest,
  type ProblemsGetProblemForEditRequest,
  type ProblemsUpdateProblemRequest,
  type ProblemsUpsertFromPageRequest,
  type SerializedProblem,
} from '@/features/problems/api/problems-contracts'
export {
  problemBulkUpdateResponseSchema,
  problemDeleteResponseSchema,
  problemForEditResponseSchema,
  problemLibraryResponseSchema,
  problemsBulkDeleteRequestSchema,
  problemsBulkUpdateProblemsRequestSchema,
  problemsCreateProblemRequestSchema,
  problemsDeleteProblemRequestSchema,
  problemsGetLibraryRequestSchema,
  problemsGetProblemForEditRequestSchema,
  problemsUpdateProblemRequestSchema,
  problemsUpsertFromPageRequestSchema,
} from '@/features/problems/api/problems-contracts'
export type { SerializedProblem } from '@/features/problems/api/problems-contracts'
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
import type {
  SerializedActiveTrack,
  TrackDeleteResponse,
  TrackForEditResponse,
  TracksClearActiveTrackRequest,
  TracksCreateTrackRequest,
  TracksDeleteTrackRequest,
  TracksGetActiveTrackRequest,
  TracksGetTrackForEditRequest,
  TracksGetWorkspaceRequest,
  TracksResetTrackProgressRequest,
  TracksSetActiveGroupRequest,
  TracksSetActiveTrackRequest,
  TracksUpdateTrackRequest,
  TrackWorkspaceResponse,
} from '@/features/tracks/api/tracks-contracts'
export {
  activeTrackSchema,
  serializedActiveTrackSchema,
  trackDeleteResponseSchema,
  trackForEditResponseSchema,
  tracksNullResponseSchema,
  tracksClearActiveTrackRequestSchema,
  tracksCreateTrackRequestSchema,
  tracksDeleteTrackRequestSchema,
  tracksGetActiveTrackRequestSchema,
  tracksGetTrackForEditRequestSchema,
  tracksGetWorkspaceRequestSchema,
  tracksResetTrackProgressRequestSchema,
  tracksSetActiveGroupRequestSchema,
  tracksSetActiveTrackRequestSchema,
  tracksUpdateTrackRequestSchema,
  trackWorkspaceResponseSchema,
} from '@/features/tracks/api/tracks-contracts'
export type {
  SerializedActiveTrack,
  TrackDeleteResponse,
  TrackForEditResponse,
  TracksClearActiveTrackRequest,
  TracksCreateTrackRequest,
  TracksDeleteTrackRequest,
  TracksGetActiveTrackRequest,
  TracksGetTrackForEditRequest,
  TracksGetWorkspaceRequest,
  TracksResetTrackProgressRequest,
  TracksSetActiveGroupRequest,
  TracksSetActiveTrackRequest,
  TracksUpdateTrackRequest,
  TrackWorkspaceResponse,
} from '@/features/tracks/api/tracks-contracts'
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
  problemSlug: problemSlugSchema.optional(),
  reason: cacheInvalidationReasonSchema,
  source: uiSurfaceSchema,
  tags: z.array(z.enum(cacheInvalidationTags)).min(1),
})

export type CacheInvalidationEvent = z.infer<
  typeof cacheInvalidationEventSchema
>

export const queueItemSchema = z.object({
  category: z.enum(['due', 'new', 'reinforcement']),
  problemSlug: problemSlugSchema,
  title: z.string(),
  difficulty: problemDifficultySchema,
  isPremium: z.boolean(),
  state: normalizedPracticeStateSchema,
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

export const pingRequestSchema = z.object({
  surface: extensionSurfaceSchema,
})

export type PingRequest = z.infer<typeof pingRequestSchema>

export type PingResponse = {
  ok: true
  surface: ExtensionSurface
  receivedAt: string
}

export const queueRequestSchema = z.object({
  surface: z.enum(['popup', 'dashboard']),
  at: z.iso.datetime().optional(),
})

export type QueueRequest = z.infer<typeof queueRequestSchema>

export { tracksGetActiveTrackRequestSchema as tracksRequestSchema } from '@/features/tracks/api/tracks-contracts'

export type TracksRequest = TracksGetActiveTrackRequest

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
  'backup.exportFullBackup'(request: BackupRequest): BackupFile
  'backup.validateFullBackup'(request: BackupPayloadRequest): BackupSummary
  'backup.restoreFullBackup'(request: BackupPayloadRequest): BackupSummary
  'backup.resetLocalData'(request: BackupRequest): null
  'problems.upsertFromPage'(
    request: ProblemsUpsertFromPageRequest,
  ): SerializedProblem
  'problems.getLibrary'(
    request: ProblemsGetLibraryRequest,
  ): ProblemLibraryResponse
  'problems.getProblemForEdit'(
    request: ProblemsGetProblemForEditRequest,
  ): ProblemForEditResponse
  'problems.createProblem'(
    request: ProblemsCreateProblemRequest,
  ): ProblemForEditResponse
  'problems.updateProblem'(
    request: ProblemsUpdateProblemRequest,
  ): ProblemForEditResponse
  'problems.deleteProblem'(
    request: ProblemsDeleteProblemRequest,
  ): ProblemDeleteResponse
  'problems.bulkUpdateProblems'(
    request: ProblemsBulkUpdateProblemsRequest,
  ): ProblemBulkUpdateResponse
  'problems.bulkDelete'(
    request: ProblemsBulkDeleteRequest,
  ): ProblemDeleteResponse
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
  'tracks.getActiveTrack'(
    request: TracksGetActiveTrackRequest,
  ): SerializedActiveTrack
  'tracks.getWorkspace'(
    request: TracksGetWorkspaceRequest,
  ): TrackWorkspaceResponse
  'tracks.getTrackForEdit'(
    request: TracksGetTrackForEditRequest,
  ): TrackForEditResponse
  'tracks.setActiveTrack'(request: TracksSetActiveTrackRequest): null
  'tracks.clearActiveTrack'(request: TracksClearActiveTrackRequest): null
  'tracks.setActiveGroup'(request: TracksSetActiveGroupRequest): null
  'tracks.createTrack'(request: TracksCreateTrackRequest): TrackForEditResponse
  'tracks.updateTrack'(request: TracksUpdateTrackRequest): TrackForEditResponse
  'tracks.deleteTrack'(request: TracksDeleteTrackRequest): TrackDeleteResponse
  'tracks.resetTrackProgress'(request: TracksResetTrackProgressRequest): null
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
