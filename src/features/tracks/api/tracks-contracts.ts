import { z } from 'zod'

import {
  problemDifficultySchema,
  problemLibraryRowSchema,
  problemSlugSchema,
  serializedProblemSchema,
} from '@/features/problems/api/problems-contracts'
import { normalizeLeetCodeSlug } from '@/lib/leetcode'

export const trackDashboardSurfaceSchema = z.literal('dashboard')

export const activeTrackSurfaceSchema = z.enum(['popup', 'dashboard'])

export const trackIdSchema = z.string().trim().min(1)

export const trackGroupIdSchema = z.string().trim().min(1)

export const trackImportSchemaVersion = 1

const normalizedImportTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((title) => normalizeLeetCodeSlug(title).length > 0, {
    message: 'Title must contain at least one letter or number.',
  })

const normalizedImportProblemSlugSchema = problemSlugSchema
  .max(200)
  .refine((problemSlug) => normalizeLeetCodeSlug(problemSlug).length > 0, {
    message: 'Problem slug must contain at least one letter or number.',
  })

const trackImportProblemSchema = z.strictObject({
  slug: normalizedImportProblemSlugSchema,
  title: normalizedImportTitleSchema.optional(),
  difficulty: problemDifficultySchema.default('unknown'),
  isPremium: z.boolean().default(false),
})

const trackImportGroupSchema = z.strictObject({
  title: normalizedImportTitleSchema,
  problemSlugs: z
    .array(normalizedImportProblemSlugSchema)
    .nonempty()
    .max(1_000),
})

const trackImportTrackSchema = z
  .strictObject({
    title: normalizedImportTitleSchema,
    description: z.string().trim().max(1_000).nullable().default(null),
    dueAt: z.iso.datetime().nullable().default(null),
    groups: z.array(trackImportGroupSchema).min(1).max(100),
  })
  .superRefine((track, context) => {
    addDuplicateProblemSlugIssues(track, context)

    const problemMembershipCount = track.groups.reduce(
      (count, group) => count + group.problemSlugs.length,
      0,
    )

    if (problemMembershipCount > 1_000) {
      context.addIssue({
        code: 'custom',
        message: 'A track can reference at most 1,000 problem memberships.',
        path: ['groups'],
      })
    }
  })

export const trackImportFileSchema = z
  .strictObject({
    schemaVersion: z.literal(trackImportSchemaVersion),
    app: z.literal('cognipace-track-import'),
    problems: z
      .array(trackImportProblemSchema)
      .max(5_000)
      .default(() => []),
    tracks: z.array(trackImportTrackSchema).min(1).max(20),
  })
  .superRefine((file, context) => {
    addDuplicateTrackImportTitleIssues(file, context)
    addDuplicateTrackImportProblemIssues(file, context)
  })

export type TrackImportFile = z.infer<typeof trackImportFileSchema>

export const tracksImportTracksRequestSchema = z.strictObject({
  surface: trackDashboardSurfaceSchema,
  file: trackImportFileSchema,
})

export type TrackImportRequest = z.infer<typeof tracksImportTracksRequestSchema>

export type TracksImportTracksRequest = TrackImportRequest

export const trackImportResultSchema = z.strictObject({
  createdTrackIds: z.array(z.string()),
  createdTrackCount: z.number().int().min(1),
  createdProblemCount: z.number().int().min(0),
  reusedProblemCount: z.number().int().min(0),
})

export type TrackImportResult = z.infer<typeof trackImportResultSchema>

export type TrackImportPreview = {
  trackCount: number
  groupCount: number
  problemCount: number
  uniqueProblemCount: number
}

export function createTrackImportPreview(
  file: TrackImportFile,
): TrackImportPreview {
  const referencedProblemSlugs = new Set<string>()
  let groupCount = 0
  let problemCount = 0

  for (const track of file.tracks) {
    groupCount += track.groups.length

    for (const group of track.groups) {
      problemCount += group.problemSlugs.length

      for (const problemSlug of group.problemSlugs) {
        referencedProblemSlugs.add(normalizeLeetCodeSlug(problemSlug))
      }
    }
  }

  return {
    trackCount: file.tracks.length,
    groupCount,
    problemCount,
    uniqueProblemCount: referencedProblemSlugs.size,
  }
}

export const trackCompletedRatingSchema = z.enum(['good', 'easy'])

export type TrackCompletedRating = z.infer<typeof trackCompletedRatingSchema>

const trackProblemCompletionSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('incomplete'),
    reviewAttemptId: z.string().nullable(),
  }),
  z.strictObject({
    status: z.literal('completed'),
    completedAt: z.iso.datetime(),
    completedRating: trackCompletedRatingSchema,
    reviewAttemptId: z.string().nullable(),
  }),
])

export const serializedTrackProgressSchema = z
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
  })

export type SerializedTrackProgress = z.infer<
  typeof serializedTrackProgressSchema
>

export const serializedTrackSchema = z.object({
  id: trackIdSchema,
  slug: z.string().trim().min(1),
  title: z.string(),
  description: z.string().nullable(),
  dueAt: z.iso.datetime().nullable(),
})

export type SerializedTrack = z.infer<typeof serializedTrackSchema>

export const serializedTrackGroupSchema = z.object({
  id: trackGroupIdSchema,
  trackId: trackIdSchema,
  title: z.string(),
  position: z.number().int().min(1),
})

export type SerializedTrackGroup = z.infer<typeof serializedTrackGroupSchema>

export const serializedActiveTrackSchema = z
  .object({
    track: serializedTrackSchema,
    activeGroup: serializedTrackGroupSchema.nullable(),
    progress: serializedTrackProgressSchema,
    nextProblem: serializedProblemSchema.nullable(),
  })
  .nullable()

export const activeTrackSchema = serializedActiveTrackSchema

export type SerializedActiveTrack = z.infer<typeof serializedActiveTrackSchema>

export const trackProblemRowSchema = problemLibraryRowSchema.extend({
  membership: z.strictObject({
    trackId: trackIdSchema,
    groupId: trackGroupIdSchema,
    groupTitle: z.string(),
    groupPosition: z.number().int().min(1),
    problemPosition: z.number().int().min(1),
    completion: trackProblemCompletionSchema,
  }),
})

export type TrackProblemRow = z.infer<typeof trackProblemRowSchema>

const serializedTrackWorkspaceRowSchema = z.object({
  track: serializedTrackSchema,
  progress: serializedTrackProgressSchema,
})

export type SerializedTrackWorkspaceRow = z.infer<
  typeof serializedTrackWorkspaceRowSchema
>

export const trackWorkspaceResponseSchema = z.object({
  generatedAt: z.iso.datetime(),
  activeTrack: serializedActiveTrackSchema,
  tracks: z.array(serializedTrackWorkspaceRowSchema),
  activeTrackGroups: z.array(serializedTrackGroupSchema),
  activeTrackRows: z.array(trackProblemRowSchema),
  dueCount: z.number().int().min(0),
})

export type TrackWorkspaceResponse = z.infer<
  typeof trackWorkspaceResponseSchema
>

const serializedTrackGroupForEditSchema = z.object({
  id: trackGroupIdSchema.optional(),
  trackId: trackIdSchema.optional(),
  title: z.string(),
  position: z.number().int().min(1),
  problemSlugs: z.array(problemSlugSchema),
})

export type SerializedTrackGroupForEdit = z.infer<
  typeof serializedTrackGroupForEditSchema
>

export const trackForEditResponseSchema = z.object({
  track: serializedTrackSchema.nullable(),
  groups: z.array(serializedTrackGroupForEditSchema),
  problemRows: z.array(problemLibraryRowSchema),
})

export type TrackForEditResponse = z.infer<typeof trackForEditResponseSchema>

export const tracksGetActiveTrackRequestSchema = z.object({
  surface: activeTrackSurfaceSchema,
})

export type TracksGetActiveTrackRequest = z.infer<
  typeof tracksGetActiveTrackRequestSchema
>

export const tracksGetWorkspaceRequestSchema = z.object({
  surface: trackDashboardSurfaceSchema,
  at: z.iso.datetime().optional(),
})

export type TracksGetWorkspaceRequest = z.infer<
  typeof tracksGetWorkspaceRequestSchema
>

export const tracksGetTrackForEditRequestSchema = z.object({
  surface: trackDashboardSurfaceSchema,
  trackId: trackIdSchema.optional(),
})

export type TracksGetTrackForEditRequest = z.infer<
  typeof tracksGetTrackForEditRequestSchema
>

const trackGroupInputSchema = z.object({
  id: trackGroupIdSchema.optional(),
  title: z.string().trim().min(1),
  problemSlugs: z.array(problemSlugSchema).default(() => []),
})

export type TrackGroupInput = z.infer<typeof trackGroupInputSchema>

const trackMutationInputBaseSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().nullable().default(null),
  dueAt: z.iso.datetime().nullable().default(null),
  groups: z.array(trackGroupInputSchema).min(1),
})

export type TrackMutationInput = z.infer<typeof trackMutationInputBaseSchema>

export const tracksCreateTrackRequestSchema = trackMutationInputBaseSchema
  .extend({
    surface: trackDashboardSurfaceSchema,
    setActive: z.boolean().optional(),
  })
  .superRefine(addDuplicateProblemSlugIssues)

export type TracksCreateTrackRequest = z.infer<
  typeof tracksCreateTrackRequestSchema
>

export const tracksUpdateTrackRequestSchema = trackMutationInputBaseSchema
  .extend({
    surface: trackDashboardSurfaceSchema,
    trackId: trackIdSchema,
  })
  .superRefine(addDuplicateProblemSlugIssues)

export type TracksUpdateTrackRequest = z.infer<
  typeof tracksUpdateTrackRequestSchema
>

export const tracksSetActiveTrackRequestSchema = z.object({
  surface: trackDashboardSurfaceSchema,
  trackId: trackIdSchema,
})

export type TracksSetActiveTrackRequest = z.infer<
  typeof tracksSetActiveTrackRequestSchema
>

export const tracksClearActiveTrackRequestSchema = z.object({
  surface: trackDashboardSurfaceSchema,
})

export type TracksClearActiveTrackRequest = z.infer<
  typeof tracksClearActiveTrackRequestSchema
>

export const tracksSetActiveGroupRequestSchema = z.object({
  surface: trackDashboardSurfaceSchema,
  trackId: trackIdSchema,
  groupId: trackGroupIdSchema,
})

export type TracksSetActiveGroupRequest = z.infer<
  typeof tracksSetActiveGroupRequestSchema
>

export const tracksDeleteTrackRequestSchema = z.object({
  surface: trackDashboardSurfaceSchema,
  trackId: trackIdSchema,
})

export type TracksDeleteTrackRequest = z.infer<
  typeof tracksDeleteTrackRequestSchema
>

export const tracksResetTrackProgressRequestSchema = z.object({
  surface: trackDashboardSurfaceSchema,
  trackId: trackIdSchema,
})

export type TracksResetTrackProgressRequest = z.infer<
  typeof tracksResetTrackProgressRequestSchema
>

export const tracksNullResponseSchema = z.null()

function addDuplicateProblemSlugIssues(
  input: z.infer<typeof trackMutationInputBaseSchema>,
  context: z.RefinementCtx,
) {
  const seenProblemSlugs = new Set<string>()

  input.groups.forEach((group, groupIndex) => {
    group.problemSlugs.forEach((problemSlug, problemIndex) => {
      const normalizedSlug = normalizeLeetCodeSlug(problemSlug)

      if (!normalizedSlug) {
        return
      }

      if (seenProblemSlugs.has(normalizedSlug)) {
        context.addIssue({
          code: 'custom',
          message: `Problem "${normalizedSlug}" can only appear once in a track.`,
          path: ['groups', groupIndex, 'problemSlugs', problemIndex],
        })

        return
      }

      seenProblemSlugs.add(normalizedSlug)
    })
  })
}

function addDuplicateTrackImportTitleIssues(
  file: TrackImportFile,
  context: z.RefinementCtx,
) {
  const seenTrackTitles = new Set<string>()

  file.tracks.forEach((track, trackIndex) => {
    const normalizedTitle = normalizeLeetCodeSlug(track.title)

    if (seenTrackTitles.has(normalizedTitle)) {
      context.addIssue({
        code: 'custom',
        message: `Track "${normalizedTitle}" appears more than once in this import.`,
        path: ['tracks', trackIndex, 'title'],
      })

      return
    }

    seenTrackTitles.add(normalizedTitle)
  })
}

function addDuplicateTrackImportProblemIssues(
  file: TrackImportFile,
  context: z.RefinementCtx,
) {
  const seenProblemSlugs = new Set<string>()

  file.problems.forEach((problem, problemIndex) => {
    const normalizedSlug = normalizeLeetCodeSlug(problem.slug)

    if (seenProblemSlugs.has(normalizedSlug)) {
      context.addIssue({
        code: 'custom',
        message: `Problem definition "${normalizedSlug}" appears more than once in this import.`,
        path: ['problems', problemIndex, 'slug'],
      })

      return
    }

    seenProblemSlugs.add(normalizedSlug)
  })
}

export type TracksNullResponse = z.infer<typeof tracksNullResponseSchema>

export const trackDeleteResponseSchema = tracksNullResponseSchema

export type TrackDeleteResponse = TracksNullResponse
