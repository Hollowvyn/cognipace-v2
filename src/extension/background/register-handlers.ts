import {
  backupFileSchema,
  backupPayloadRequestSchema,
  backupRequestSchema,
  backupSummarySchema,
  leetcodeProblemRemoteRuntimeRequestSchema,
  leetcodeSubmissionResultRemoteRuntimeRequestSchema,
  onMessage,
  pingRequestSchema,
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
  queueRequestSchema,
  settingsRequestSchema,
  settingsToggleStudyModeRequestSchema,
  settingsUpdateRequestSchema,
  todayQueueSchema,
  trackForEditResponseSchema,
  tracksClearActiveTrackRequestSchema,
  tracksCreateTrackRequestSchema,
  tracksDeleteTrackRequestSchema,
  tracksGetTrackForEditRequestSchema,
  tracksGetWorkspaceRequestSchema,
  tracksNullResponseSchema,
  tracksResetTrackProgressRequestSchema,
  tracksRequestSchema,
  tracksSetActiveGroupRequestSchema,
  tracksSetActiveTrackRequestSchema,
  tracksUpdateTrackRequestSchema,
  trackWorkspaceResponseSchema,
  type SerializedActiveTrack,
  type SerializedTodayQueue,
  type UiSurface,
} from '@/extension/messaging'
import {
  appShellDataSchema,
  appShellRequestSchema,
  type AppShellRequest,
} from '@/features/app-shell/api/app-shell-contracts'
import { getAppShellData } from '@/features/app-shell/server/app-shell-service'
import {
  exportFullBackup,
  resetLocalData,
  restoreFullBackup,
  validateFullBackup,
} from '@/features/backup/server/backup-service'
import {
  readLeetCodeProblemContentInBackground,
  readLeetCodeProblemMetadataInBackground,
  readLeetCodeSubmissionResultInBackground,
} from '@/features/leetcode-capture/server/leetcode-capture-service'
import {
  practiceDetailsRequestSchema,
  practiceOverrideLastReviewResultRequestSchema,
  practiceResetScheduleRequestSchema,
  practiceSaveReviewResultRequestSchema,
  practiceSetSuspendedRequestSchema,
  practiceUpdateCurrentLogRequestSchema,
} from '@/features/practice/api/practice-contracts'
import {
  serializeNormalizedPracticeState,
  serializePracticeDetails,
} from '@/features/practice/api/practice-serializers'
import {
  getPracticeDetails,
  overrideLastReviewResult,
  resetPracticeSchedule,
  saveReviewResult,
  setPracticeSuspended,
  updateCurrentPracticeLog,
} from '@/features/practice/server/practice-service'
import {
  bulkDeleteProblems,
  bulkUpdateProblems,
  createProblem,
  deleteProblem,
  getProblemForEdit,
  getProblemLibrary,
  updateProblem,
  upsertProblemFromPage,
} from '@/features/problems/server/problems-service'
import type { TodayQueue } from '@/features/queue/domain'
import { getTodayQueue } from '@/features/queue/server/queue-service'
import type { UserSettings } from '@/features/settings/domain'
import {
  getSettings,
  toggleStudyMode,
  updateSettings,
} from '@/features/settings/server/settings-service'
import { serializeActiveTrack as serializeActiveTrackContract } from '@/features/tracks/api/tracks-serializers'
import type { ActiveTrack } from '@/features/tracks/domain'
import {
  clearActiveTrack,
  createTrack,
  deleteTrack,
  getActiveTrack,
  getTrackForEdit,
  getWorkspace,
  recordActiveTrackProblemCompletion,
  resetTrackProgress,
  setActiveGroup,
  setActiveTrack,
  updateTrack,
} from '@/features/tracks/server/tracks-service'
import { flushDbSnapshot, getAppDb, type Db } from '@/platform/db'

import { broadcastCacheInvalidation } from './cache-invalidation-broadcaster'
import { assertCanSenderCallExtensionMethod } from './runtime-policy'

const practiceTrackInvalidationTags = [
  'practice',
  'problems',
  'queue',
  'app-shell',
  'tracks',
] as const

export function registerBackgroundHandlers() {
  onMessage('runtime.ping', ({ data, sender }) => {
    const request = pingRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod('runtime.ping', request.surface, sender)
    return {
      ok: true,
      surface: request.surface,
      receivedAt: new Date().toISOString(),
    }
  })

  onMessage('app.getShellData', ({ data, sender }) => {
    const request = appShellRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'app.getShellData',
      getAppShellRuntimeSurface(request),
      sender,
    )
    return getAppDb().then(async ({ db }) =>
      appShellDataSchema.parse(await getAppShellData(db, request)),
    )
  })

  onMessage('backup.exportFullBackup', ({ data, sender }) => {
    const request = backupRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'backup.exportFullBackup',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) =>
      backupFileSchema.parse(await exportFullBackup(db)),
    )
  })

  onMessage('backup.validateFullBackup', ({ data, sender }) => {
    const request = backupPayloadRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'backup.validateFullBackup',
      request.surface,
      sender,
    )
    return backupSummarySchema.parse(validateFullBackup(request.backup))
  })

  onMessage('backup.restoreFullBackup', ({ data, sender }) => {
    const request = backupPayloadRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'backup.restoreFullBackup',
      request.surface,
      sender,
    )
    return runDbMutation(
      async (db) =>
        backupSummarySchema.parse(await restoreFullBackup(db, request.backup)),
      () => broadcastDataManagementInvalidation(request.surface),
    )
  })

  onMessage('backup.resetLocalData', ({ data, sender }) => {
    const request = backupRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'backup.resetLocalData',
      request.surface,
      sender,
    )
    return runDbMutation(
      async (db) => {
        await resetLocalData(db)

        return null
      },
      () => broadcastDataManagementInvalidation(request.surface),
    )
  })

  onMessage('problems.upsertFromPage', ({ data, sender }) => {
    const request = problemsUpsertFromPageRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'problems.upsertFromPage',
      request.surface,
      sender,
    )
    return runDbMutation(
      (db) => upsertProblemFromPage(db, request),
      (problem) =>
        broadcastProblemCatalogInvalidation({
          problemSlug: problem.slug,
          source: request.surface,
        }),
    )
  })

  onMessage('problems.getLibrary', ({ data, sender }) => {
    const request = problemsGetLibraryRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'problems.getLibrary',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) =>
      problemLibraryResponseSchema.parse(await getProblemLibrary(db, request)),
    )
  })

  onMessage('problems.getProblemForEdit', ({ data, sender }) => {
    const request = problemsGetProblemForEditRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'problems.getProblemForEdit',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) =>
      problemForEditResponseSchema.parse(await getProblemForEdit(db, request)),
    )
  })

  onMessage('problems.createProblem', ({ data, sender }) => {
    const request = problemsCreateProblemRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'problems.createProblem',
      request.surface,
      sender,
    )
    return runDbMutation(
      async (db) =>
        problemForEditResponseSchema.parse(await createProblem(db, request)),
      (problemForEdit) =>
        broadcastProblemCatalogInvalidation({
          problemSlug: problemForEdit.problem.slug,
          source: request.surface,
        }),
    )
  })

  onMessage('problems.updateProblem', ({ data, sender }) => {
    const request = problemsUpdateProblemRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'problems.updateProblem',
      request.surface,
      sender,
    )
    return runDbMutation(
      async (db) =>
        problemForEditResponseSchema.parse(await updateProblem(db, request)),
      (problemForEdit) =>
        broadcastProblemCatalogInvalidation({
          problemSlug: problemForEdit.problem.slug,
          source: request.surface,
        }),
    )
  })

  onMessage('problems.deleteProblem', ({ data, sender }) => {
    const request = problemsDeleteProblemRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'problems.deleteProblem',
      request.surface,
      sender,
    )
    return runDbMutation(
      async (db) =>
        problemDeleteResponseSchema.parse(await deleteProblem(db, request)),
      () =>
        broadcastProblemCatalogInvalidation({
          problemSlug: request.problemSlug,
          source: request.surface,
        }),
    )
  })

  onMessage('problems.bulkUpdateProblems', ({ data, sender }) => {
    const request = problemsBulkUpdateProblemsRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'problems.bulkUpdateProblems',
      request.surface,
      sender,
    )
    return runDbMutation(
      async (db) =>
        problemBulkUpdateResponseSchema.parse(
          await bulkUpdateProblems(db, request),
        ),
      () =>
        broadcastProblemCatalogInvalidation({
          problemSlug: readSingleChangedProblemSlug(request.problemSlugs),
          source: request.surface,
        }),
    )
  })

  onMessage('problems.bulkDelete', ({ data, sender }) => {
    const request = problemsBulkDeleteRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'problems.bulkDelete',
      request.surface,
      sender,
    )
    return runDbMutation(
      async (db) =>
        problemDeleteResponseSchema.parse(
          await bulkDeleteProblems(db, request),
        ),
      () =>
        broadcastProblemCatalogInvalidation({
          problemSlug: readSingleChangedProblemSlug(request.problemSlugs),
          source: request.surface,
        }),
    )
  })

  onMessage('practice.getDetails', ({ data, sender }) => {
    const request = practiceDetailsRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'practice.getDetails',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) => {
      const settings = await getSettings(db)
      const details = await getPracticeDetails(db, request.problemSlug, {
        targetRetention: settings.review.targetRetention,
        ...(request.at ? { now: new Date(request.at) } : {}),
      })

      return serializePracticeDetails(details)
    })
  })

  onMessage('practice.saveReviewResult', ({ data, sender }) => {
    const request = practiceSaveReviewResultRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'practice.saveReviewResult',
      request.surface,
      sender,
    )
    return runDbMutation(
      async (db) => {
        const settings = await getSettings(db)
        const reviewedAt = request.reviewedAt
          ? new Date(request.reviewedAt)
          : new Date()
        const reviewInput = {
          problemSlug: request.problemSlug,
          rating: request.rating,
          elapsedSeconds: request.elapsedSeconds,
          isCorrect: request.isCorrect,
          log: readReviewLogRequest(request),
          targetRetention: settings.review.targetRetention,
        }

        await saveReviewResult(db, {
          ...reviewInput,
          reviewedAt,
          ...(request.reviewMode ? { reviewMode: request.reviewMode } : {}),
        })
        if (
          settings.practice.mode === 'studyPlan' &&
          isTrackCompletionRating(request.rating)
        ) {
          await recordActiveTrackProblemCompletion(db, {
            problemSlug: request.problemSlug,
            rating: request.rating,
            completedAt: reviewedAt,
          })
        }
        const details = await getPracticeDetails(db, request.problemSlug, {
          targetRetention: settings.review.targetRetention,
        })

        return serializePracticeDetails(details)
      },
      () =>
        broadcastPracticeInvalidation({
          problemSlug: request.problemSlug,
          source: request.surface,
          tags: practiceTrackInvalidationTags,
        }),
    )
  })

  onMessage('practice.overrideLastReviewResult', ({ data, sender }) => {
    const request = practiceOverrideLastReviewResultRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'practice.overrideLastReviewResult',
      request.surface,
      sender,
    )
    return runDbMutation(
      async (db) => {
        const settings = await getSettings(db)
        await overrideLastReviewResult(db, {
          problemSlug: request.problemSlug,
          rating: request.rating,
          elapsedSeconds: request.elapsedSeconds,
          isCorrect: request.isCorrect,
          log: readReviewLogRequest(request),
          targetRetention: settings.review.targetRetention,
        })
        const details = await getPracticeDetails(db, request.problemSlug, {
          targetRetention: settings.review.targetRetention,
        })

        return serializePracticeDetails(details)
      },
      () =>
        broadcastPracticeInvalidation({
          problemSlug: request.problemSlug,
          source: request.surface,
          tags: practiceTrackInvalidationTags,
        }),
    )
  })

  onMessage('practice.setSuspended', ({ data, sender }) => {
    const request = practiceSetSuspendedRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'practice.setSuspended',
      request.surface,
      sender,
    )
    return runDbMutation(
      async (db) => {
        const details = await setPracticeSuspended(db, {
          problemSlug: request.problemSlug,
          suspended: request.suspended,
        })

        return serializePracticeDetails(details)
      },
      () =>
        broadcastPracticeInvalidation({
          problemSlug: request.problemSlug,
          source: request.surface,
          tags: practiceTrackInvalidationTags,
        }),
    )
  })

  onMessage('practice.resetSchedule', ({ data, sender }) => {
    const request = practiceResetScheduleRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'practice.resetSchedule',
      request.surface,
      sender,
    )
    return runDbMutation(
      async (db) => {
        const details = await resetPracticeSchedule(db, {
          problemSlug: request.problemSlug,
          keepLog: request.keepLog,
        })

        return serializePracticeDetails(details)
      },
      () =>
        broadcastPracticeInvalidation({
          problemSlug: request.problemSlug,
          source: request.surface,
          tags: practiceTrackInvalidationTags,
        }),
    )
  })

  onMessage('practice.updateCurrentLog', ({ data, sender }) => {
    const request = practiceUpdateCurrentLogRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'practice.updateCurrentLog',
      request.surface,
      sender,
    )
    return runDbMutation(
      async (db) => {
        const settings = await getSettings(db)

        const details = await updateCurrentPracticeLog(db, {
          problemSlug: request.problemSlug,
          log: request.log,
          targetRetention: settings.review.targetRetention,
        })

        return serializePracticeDetails(details)
      },
      () =>
        broadcastPracticeInvalidation({
          problemSlug: request.problemSlug,
          source: request.surface,
          tags: ['practice', 'problems', 'app-shell'],
        }),
    )
  })

  onMessage('queue.getTodayQueue', ({ data, sender }) => {
    const request = queueRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'queue.getTodayQueue',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) =>
      serializeTodayQueue(
        await getTodayQueue(db, request.at ? new Date(request.at) : undefined),
      ),
    )
  })

  onMessage('tracks.getActiveTrack', ({ data, sender }) => {
    const request = tracksRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'tracks.getActiveTrack',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) =>
      serializeActiveTrack(await getActiveTrack(db)),
    )
  })

  onMessage('tracks.getWorkspace', ({ data, sender }) => {
    const request = tracksGetWorkspaceRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'tracks.getWorkspace',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) =>
      trackWorkspaceResponseSchema.parse(await getWorkspace(db, request)),
    )
  })

  onMessage('tracks.getTrackForEdit', ({ data, sender }) => {
    const request = tracksGetTrackForEditRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'tracks.getTrackForEdit',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) =>
      trackForEditResponseSchema.parse(await getTrackForEdit(db, request)),
    )
  })

  onMessage('tracks.setActiveTrack', ({ data, sender }) => {
    const request = tracksSetActiveTrackRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'tracks.setActiveTrack',
      request.surface,
      sender,
    )
    return runDbMutation(
      async (db) => {
        await setActiveTrack(db, request)

        return tracksNullResponseSchema.parse(null)
      },
      () =>
        broadcastTracksInvalidation({
          source: request.surface,
          tags: ['tracks'],
        }),
    )
  })

  onMessage('tracks.clearActiveTrack', ({ data, sender }) => {
    const request = tracksClearActiveTrackRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'tracks.clearActiveTrack',
      request.surface,
      sender,
    )
    return runDbMutation(
      async (db) => {
        await clearActiveTrack(db, request)

        return tracksNullResponseSchema.parse(null)
      },
      () =>
        broadcastTracksInvalidation({
          source: request.surface,
          tags: ['tracks'],
        }),
    )
  })

  onMessage('tracks.setActiveGroup', ({ data, sender }) => {
    const request = tracksSetActiveGroupRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'tracks.setActiveGroup',
      request.surface,
      sender,
    )
    return runDbMutation(
      async (db) => {
        await setActiveGroup(db, request)

        return tracksNullResponseSchema.parse(null)
      },
      () =>
        broadcastTracksInvalidation({
          source: request.surface,
          tags: ['tracks'],
        }),
    )
  })

  onMessage('tracks.createTrack', ({ data, sender }) => {
    const request = tracksCreateTrackRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'tracks.createTrack',
      request.surface,
      sender,
    )
    return runDbMutation(
      async (db) =>
        trackForEditResponseSchema.parse(await createTrack(db, request)),
      () =>
        broadcastTracksInvalidation({
          source: request.surface,
          tags: ['tracks', 'problems'],
        }),
    )
  })

  onMessage('tracks.updateTrack', ({ data, sender }) => {
    const request = tracksUpdateTrackRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'tracks.updateTrack',
      request.surface,
      sender,
    )
    return runDbMutation(
      async (db) =>
        trackForEditResponseSchema.parse(await updateTrack(db, request)),
      () =>
        broadcastTracksInvalidation({
          source: request.surface,
          tags: ['tracks', 'problems'],
        }),
    )
  })

  onMessage('tracks.deleteTrack', ({ data, sender }) => {
    const request = tracksDeleteTrackRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'tracks.deleteTrack',
      request.surface,
      sender,
    )
    return runDbMutation(
      async (db) => {
        await deleteTrack(db, request)

        return tracksNullResponseSchema.parse(null)
      },
      () =>
        broadcastTracksInvalidation({
          source: request.surface,
          tags: ['tracks', 'problems'],
        }),
    )
  })

  onMessage('tracks.resetTrackProgress', ({ data, sender }) => {
    const request = tracksResetTrackProgressRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'tracks.resetTrackProgress',
      request.surface,
      sender,
    )
    return runDbMutation(
      async (db) => {
        await resetTrackProgress(db, request)

        return tracksNullResponseSchema.parse(null)
      },
      () =>
        broadcastTracksInvalidation({
          source: request.surface,
          tags: ['tracks', 'problems'],
        }),
    )
  })

  onMessage('settings.getSettings', ({ data, sender }) => {
    const request = settingsRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'settings.getSettings',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) => {
      const settings = await getSettings(db)
      return settings satisfies UserSettings
    })
  })

  onMessage('settings.updateSettings', ({ data, sender }) => {
    const request = settingsUpdateRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'settings.updateSettings',
      request.surface,
      sender,
    )
    return runSettingsMutation(request.surface, (db) =>
      updateSettings(db, request.patch),
    )
  })

  onMessage('settings.toggleStudyMode', ({ data, sender }) => {
    const request = settingsToggleStudyModeRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'settings.toggleStudyMode',
      request.surface,
      sender,
    )
    return runSettingsMutation(request.surface, (db) =>
      toggleStudyMode(db),
    ).then(() => null)
  })

  onMessage('leetcode.readProblemMetadata', ({ data, sender }) => {
    const request = leetcodeProblemRemoteRuntimeRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'leetcode.readProblemMetadata',
      request.surface,
      sender,
    )
    return readLeetCodeProblemMetadataInBackground(request)
  })

  onMessage('leetcode.readProblemContent', ({ data, sender }) => {
    const request = leetcodeProblemRemoteRuntimeRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'leetcode.readProblemContent',
      request.surface,
      sender,
    )
    return readLeetCodeProblemContentInBackground(request)
  })

  onMessage('leetcode.readSubmissionResult', ({ data, sender }) => {
    const request =
      leetcodeSubmissionResultRemoteRuntimeRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'leetcode.readSubmissionResult',
      request.surface,
      sender,
    )
    return readLeetCodeSubmissionResultInBackground(request)
  })
}

async function runSettingsMutation(
  source: 'popup' | 'dashboard',
  writeSettings: (db: Db) => Promise<UserSettings>,
) {
  return runDbMutation(writeSettings, () =>
    broadcastCacheInvalidation({
      reason: 'settings-updated',
      source,
      tags: ['settings'],
    }),
  )
}

let dbMutationQueue: Promise<void> = Promise.resolve()

function runDbMutation<T>(
  write: (db: Db) => Promise<T>,
  afterFlush?: (result: T) => unknown,
) {
  const queued = dbMutationQueue.then(async () => {
    const { db } = await getAppDb()
    const result = await write(db)

    await flushDbSnapshot()
    await afterFlush?.(result)

    return result
  })

  dbMutationQueue = queued.then(
    () => undefined,
    () => undefined,
  )

  return queued
}

function readReviewLogRequest(request: {
  log?:
    | {
        interviewPattern?: string | null | undefined
        timeComplexity?: string | null | undefined
        spaceComplexity?: string | null | undefined
        languages?: string | null | undefined
        notes?: string | null | undefined
      }
    | undefined
  notes?: string | null | undefined
}) {
  if (request.log) {
    return request.log
  }

  return request.notes === undefined ? undefined : { notes: request.notes }
}

function readSingleChangedProblemSlug(problemSlugs: readonly string[]) {
  return problemSlugs.length === 1 ? problemSlugs[0] : undefined
}

function broadcastProblemCatalogInvalidation(input: {
  problemSlug?: string | undefined
  source: UiSurface
}) {
  return broadcastCacheInvalidation({
    ...(input.problemSlug ? { problemSlug: input.problemSlug } : {}),
    reason: 'problem-catalog-updated',
    source: input.source,
    tags: ['problems'],
  })
}

function broadcastPracticeInvalidation(input: {
  problemSlug: string
  source: UiSurface
  tags?: Parameters<typeof broadcastCacheInvalidation>[0]['tags']
}) {
  return broadcastCacheInvalidation({
    problemSlug: input.problemSlug,
    reason: 'practice-updated',
    source: input.source,
    tags: input.tags ?? ['practice', 'problems', 'queue', 'app-shell'],
  })
}

function broadcastTracksInvalidation(input: {
  source: UiSurface
  tags?: Parameters<typeof broadcastCacheInvalidation>[0]['tags']
}) {
  return broadcastCacheInvalidation({
    reason: 'tracks-updated',
    source: input.source,
    tags: input.tags ?? ['tracks'],
  })
}

function broadcastDataManagementInvalidation(source: 'dashboard') {
  return broadcastCacheInvalidation({
    reason: 'problem-catalog-updated',
    source,
    tags: ['settings', 'problems', 'practice', 'queue', 'tracks', 'app-shell'],
  })
}

function isTrackCompletionRating(rating: string) {
  return rating === 'good' || rating === 'easy'
}

function serializeTodayQueue(queue: TodayQueue): SerializedTodayQueue {
  return todayQueueSchema.parse({
    generatedAt: queue.generatedAt.toISOString(),
    dailyGoal: queue.dailyGoal,
    dueCount: queue.dueCount,
    newCount: queue.newCount,
    reinforcementCount: queue.reinforcementCount,
    items: queue.items.map((item) => ({
      category: item.category,
      problemSlug: item.problemSlug,
      title: item.title,
      difficulty: item.difficulty,
      isPremium: item.isPremium,
      state: serializeNormalizedPracticeState(item.state),
    })),
  })
}

export function getAppShellRuntimeSurface(
  request: AppShellRequest,
): 'popup' | 'dashboard' | 'content-script' {
  return request.surface === 'overlay' ? 'content-script' : request.surface
}

export function serializeActiveTrack(
  activeTrack: ActiveTrack | null,
): SerializedActiveTrack {
  return serializeActiveTrackContract(activeTrack)
}
