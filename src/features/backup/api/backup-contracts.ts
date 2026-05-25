import { z } from 'zod'

import {
  problemDifficultySchema,
  problemSlugSchema,
} from '@/features/problems/api/problems-contracts'
import { practiceStatuses, reviewModes } from '@/features/practice/domain'
import { userSettingsSchema } from '@/features/settings/domain'
import {
  trackCompletedRatingSchema,
  trackGroupIdSchema,
  trackIdSchema,
} from '@/features/tracks/api/tracks-contracts'
import { fsrsCardStates, reviewRatings } from '@/lib/fsrs'

export const backupSchemaVersion = 1

export const minimumSupportedBackupSchemaVersion = 1

const isoDatetimeSchema = z.iso.datetime()

const durableIdSchema = z.string().trim().min(1)

export const backupProblemRowSchema = z.strictObject({
  slug: problemSlugSchema,
  title: z.string(),
  difficulty: problemDifficultySchema,
  isPremium: z.boolean(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
})

export const backupTopicRowSchema = z.strictObject({
  id: durableIdSchema,
  label: z.string(),
})

export const backupCompanyRowSchema = z.strictObject({
  id: durableIdSchema,
  label: z.string(),
})

export const backupProblemTopicRowSchema = z.strictObject({
  problemSlug: problemSlugSchema,
  topicId: durableIdSchema,
})

export const backupProblemCompanyRowSchema = z.strictObject({
  problemSlug: problemSlugSchema,
  companyId: durableIdSchema,
})

export const backupProblemPracticeRowSchema = z.strictObject({
  problemSlug: problemSlugSchema,
  status: z.enum(practiceStatuses),
  firstSeenAt: isoDatetimeSchema,
  lastSeenAt: isoDatetimeSchema.nullable(),
  lastReviewedAt: isoDatetimeSchema.nullable(),
  lastRating: z.enum(reviewRatings).nullable(),
  lastElapsedSeconds: z.number().int().positive().nullable(),
  bestElapsedSeconds: z.number().int().positive().nullable(),
  interviewPattern: z.string().nullable(),
  timeComplexity: z.string().nullable(),
  spaceComplexity: z.string().nullable(),
  languages: z.string().nullable(),
  notes: z.string().nullable(),
  solvedCount: z.number().int().min(0),
  attemptCount: z.number().int().min(0),
  isSuspended: z.boolean(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
})

export const backupFsrsCardRowSchema = z.strictObject({
  id: durableIdSchema,
  problemSlug: problemSlugSchema,
  cardKind: durableIdSchema,
  dueAt: isoDatetimeSchema,
  stability: z.number(),
  difficulty: z.number(),
  elapsedDays: z.number().int().min(0),
  scheduledDays: z.number().int().min(0),
  learningSteps: z.number().int().min(0),
  reps: z.number().int().min(0),
  lapses: z.number().int().min(0),
  state: z.enum(fsrsCardStates),
  lastReviewAt: isoDatetimeSchema.nullable(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
})

export const backupReviewAttemptRowSchema = z.strictObject({
  id: durableIdSchema,
  problemSlug: problemSlugSchema,
  cardId: durableIdSchema,
  rating: z.enum(reviewRatings),
  reviewMode: z.enum(reviewModes),
  reviewedAt: isoDatetimeSchema,
  elapsedSeconds: z.number().int().positive().nullable(),
  isCorrect: z.boolean().nullable(),
  interviewPattern: z.string().nullable(),
  timeComplexity: z.string().nullable(),
  spaceComplexity: z.string().nullable(),
  languages: z.string().nullable(),
  notes: z.string().nullable(),
  fsrsReviewLog: z.string().nullable(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
})

export const backupTrackRowSchema = z.strictObject({
  id: trackIdSchema,
  slug: z.string().trim().min(1),
  title: z.string(),
  description: z.string().nullable(),
  dueAt: isoDatetimeSchema.nullable(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
})

export const backupTrackGroupRowSchema = z.strictObject({
  id: trackGroupIdSchema,
  trackId: trackIdSchema,
  title: z.string(),
  position: z.number().int().min(1),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
})

export const backupTrackMembershipRowSchema = z.strictObject({
  trackGroupId: trackGroupIdSchema,
  problemSlug: problemSlugSchema,
  position: z.number().int().min(1),
})

export const backupTrackProgressRowSchema = z.strictObject({
  trackGroupId: trackGroupIdSchema,
  problemSlug: problemSlugSchema,
  completedAt: isoDatetimeSchema,
  completedRating: trackCompletedRatingSchema,
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
})

export const backupTrackSessionRowSchema = z.strictObject({
  id: durableIdSchema,
  activeTrackId: trackIdSchema.nullable(),
  activeGroupId: trackGroupIdSchema.nullable(),
  startedAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
})

export const backupSettingsKvRowSchema = z
  .strictObject({
    key: z.literal('user-settings'),
    value: z.string(),
    updatedAt: isoDatetimeSchema,
  })
  .superRefine((settingsKv, context) => {
    try {
      userSettingsSchema.parse(JSON.parse(settingsKv.value))
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'settings value must contain current UserSettings JSON',
        path: ['value'],
      })
    }
  })

export const backupPracticeDataSchema = z.strictObject({
  problemPractice: z.array(backupProblemPracticeRowSchema),
  fsrsCards: z.array(backupFsrsCardRowSchema),
  reviewAttempts: z.array(backupReviewAttemptRowSchema),
})

export const backupTracksDataSchema = z.strictObject({
  tracks: z.array(backupTrackRowSchema),
  groups: z.array(backupTrackGroupRowSchema),
  memberships: z.array(backupTrackMembershipRowSchema),
  progress: z.array(backupTrackProgressRowSchema),
  session: z.array(backupTrackSessionRowSchema),
})

export const backupDataSchema = z.strictObject({
  problems: z.array(backupProblemRowSchema),
  topics: z.array(backupTopicRowSchema),
  companies: z.array(backupCompanyRowSchema),
  problemTopics: z.array(backupProblemTopicRowSchema),
  problemCompanies: z.array(backupProblemCompanyRowSchema),
  practice: backupPracticeDataSchema,
  tracks: backupTracksDataSchema,
  settings: z.array(backupSettingsKvRowSchema),
})

export const backupFileSchema = z.strictObject({
  schemaVersion: z.literal(backupSchemaVersion),
  app: z.literal('cognipace'),
  exportedAt: isoDatetimeSchema,
  source: z.strictObject({
    appVersion: z.string().optional(),
    extensionVersion: z.string().optional(),
  }),
  data: backupDataSchema,
})

export const backupRequestSchema = z.strictObject({
  surface: z.literal('dashboard'),
})

export const backupPayloadRequestSchema = z.strictObject({
  surface: z.literal('dashboard'),
  backup: backupFileSchema,
})

export const backupSummarySchema = z.strictObject({
  problems: z.number().int().min(0),
  topics: z.number().int().min(0),
  companies: z.number().int().min(0),
  problemTopics: z.number().int().min(0),
  problemCompanies: z.number().int().min(0),
  problemPractice: z.number().int().min(0),
  fsrsCards: z.number().int().min(0),
  reviewAttempts: z.number().int().min(0),
  tracks: z.number().int().min(0),
  trackGroups: z.number().int().min(0),
  trackMemberships: z.number().int().min(0),
  trackProgress: z.number().int().min(0),
  trackSession: z.number().int().min(0),
  settings: z.number().int().min(0),
})

export type BackupFile = z.infer<typeof backupFileSchema>
export type BackupData = z.infer<typeof backupDataSchema>
export type BackupRequest = z.infer<typeof backupRequestSchema>
export type BackupPayloadRequest = z.infer<typeof backupPayloadRequestSchema>
export type BackupSummary = z.infer<typeof backupSummarySchema>

const backupEnvelopePreflightSchema = z.object({
  schemaVersion: z.number().int(),
  app: z.string(),
})

export function parseBackupFileForCurrentApp(input: unknown): BackupFile {
  const envelope = backupEnvelopePreflightSchema.parse(input)

  if (envelope.app !== 'cognipace') {
    throw new Error('Selected file is not a CogniPace backup.')
  }

  if (
    envelope.schemaVersion < minimumSupportedBackupSchemaVersion ||
    envelope.schemaVersion > backupSchemaVersion
  ) {
    throw new Error(
      `Unsupported backup version ${envelope.schemaVersion}. CogniPace supports backup versions ${minimumSupportedBackupSchemaVersion}-${backupSchemaVersion}.`,
    )
  }

  return backupFileSchema.parse(input)
}

export function createBackupSummary(backup: BackupFile): BackupSummary {
  return backupSummarySchema.parse({
    problems: backup.data.problems.length,
    topics: backup.data.topics.length,
    companies: backup.data.companies.length,
    problemTopics: backup.data.problemTopics.length,
    problemCompanies: backup.data.problemCompanies.length,
    problemPractice: backup.data.practice.problemPractice.length,
    fsrsCards: backup.data.practice.fsrsCards.length,
    reviewAttempts: backup.data.practice.reviewAttempts.length,
    tracks: backup.data.tracks.tracks.length,
    trackGroups: backup.data.tracks.groups.length,
    trackMemberships: backup.data.tracks.memberships.length,
    trackProgress: backup.data.tracks.progress.length,
    trackSession: backup.data.tracks.session.length,
    settings: backup.data.settings.length,
  })
}
