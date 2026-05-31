import {
  analyticsSummaryRequestSchema,
  analyticsSummarySchema,
  backupFileSchema,
  backupPayloadRequestSchema,
  backupRequestSchema,
  backupSummarySchema,
  leetcodeProblemRemoteRuntimeRequestSchema,
  leetcodeSubmissionResultRemoteRuntimeRequestSchema,
  onMessage,
  openDashboardRequestSchema,
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
  settingsCycleThemeModeRequestSchema,
  settingsRequestSchema,
  settingsToggleStudyModeRequestSchema,
  settingsUpdateRequestSchema,
  syncActionResultSchema,
  syncGithubGistRequestSchema,
  syncGithubTokenRequestSchema,
  syncPullLatestRequestSchema,
  syncPushLocalRequestSchema,
  syncRequestSchema,
  syncSetEnabledRequestSchema,
  syncStatusSchema,
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
import { browser } from 'wxt/browser'
import {
  appShellDataSchema,
  appShellRequestSchema,
  type AppShellRequest,
} from '@/features/app-shell/api/app-shell-contracts'
import { getAppShellData } from '@/features/app-shell/server/app-shell-service'
import { getAnalyticsSummary } from '@/features/analytics/server/analytics-service'
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
  overrideLastReviewResultWithTrackProgress,
  resetPracticeSchedule,
  saveReviewResultWithTrackProgress,
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
import type { QueueItem, TodayQueue } from '@/features/queue/domain'
import { getTodayQueue } from '@/features/queue/server/queue-service'
import type { UserSettings } from '@/features/settings/domain'
import {
  cycleThemeMode,
  getSettings,
  toggleStudyMode,
  updateSettings,
} from '@/features/settings/server/settings-service'
import {
  readSyncMetadata,
  writeSyncMetadata,
} from '@/features/sync/data/sync-metadata-store'
import {
  createBackgroundSyncService,
  markSyncLocalDataChanged,
} from '@/features/sync/server/sync-service'
import { serializeActiveTrack as serializeActiveTrackContract } from '@/features/tracks/api/tracks-serializers'
import type { ActiveTrack } from '@/features/tracks/domain'
import {
  clearActiveTrack,
  createTrack,
  deleteTrack,
  getActiveTrack,
  getTrackForEdit,
  getWorkspace,
  resetTrackProgress,
  setActiveGroup,
  setActiveTrack,
  updateTrack,
} from '@/features/tracks/server/tracks-service'
import { getDashboardUrl } from '@/platform/chrome/extension-pages'
import { flushDbSnapshot, getAppDb, type Db } from '@/platform/db'

import { broadcastCacheInvalidation } from './cache-invalidation-broadcaster'
import { assertCanSenderCallExtensionMethod } from './runtime-policy'
import { createAlarmScheduler } from './scheduler/alarm-scheduler'
import { createSyncAutoSync } from './sync-auto-sync'
import {
  createDueNotification,
  readDueNotificationState,
  writeDueNotificationState,
} from './due-notification'

const alarmScheduler = createAlarmScheduler()
const syncAutoSync = createSyncAutoSync({
  scheduler: alarmScheduler,
  hasPendingDirtyMarkRetry: () => hasPendingDirtyMarkRetry,
  now: () => new Date(),
  readMetadata: readSyncMetadata,
  writeMetadata: writeSyncMetadata,
  runSafePush: async (input) => {
    const { db } = await getAppDb()

    return parseSyncActionResult(
      await runQueuedSyncAction(db, (service) => service.pushLocal(input)),
    )
  },
  runCleanPullCheck: async () => {
    const { db } = await getAppDb()

    return parseSyncActionResult(
      await runQueuedSyncAction(db, (service) => service.checkRemoteOnOpen()),
    )
  },
})

const dueNotification = createDueNotification({
  now: () => new Date(),
  readSettings: async () => {
    const { db } = await getAppDb()
    return getSettings(db)
  },
  readQueueSummary: async () => {
    const { db } = await getAppDb()
    const queue = await getTodayQueue(db, new Date())
    return { dueCount: queue.dueCount }
  },
  readState: readDueNotificationState,
  writeState: writeDueNotificationState,
  notify: async (title, message) => {
    await browser.notifications.create('due-review-reminder', {
      type: 'basic',
      iconUrl: '/icons.svg',
      title,
      message,
    })
  },
  checkAlarmScheduled: async (name) => {
    const alarm = await browser.alarms.get(name)
    return alarm !== undefined
  },
  scheduler: alarmScheduler,
})

export function registerBackgroundHandlers() {
  syncAutoSync.registerJobs()
  void syncAutoSync.repairStartupAlarms()

  dueNotification.registerJobs()
  void dueNotification.handleStartup()

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

  onMessage('app.openDashboard', ({ data, sender }) => {
    const request = openDashboardRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'app.openDashboard',
      request.surface,
      sender,
    )
    return browser.tabs
      .create({ url: getDashboardUrl(request.route) })
      .then(() => null)
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

  onMessage('sync.getStatus', ({ data, sender }) => {
    const request = syncRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'sync.getStatus',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) =>
      syncStatusSchema.parse(await createSyncServiceForDb(db).getStatus()),
    )
  })

  onMessage('sync.validateGithubToken', ({ data, sender }) => {
    const request = syncGithubTokenRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'sync.validateGithubToken',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) =>
      parseSyncActionResult(
        await runQueuedSyncAction(db, (service) =>
          service.validateGithubToken(request.token),
        ),
      ),
    )
  })

  onMessage('sync.validateStoredGithubToken', ({ data, sender }) => {
    const request = syncRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'sync.validateStoredGithubToken',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) =>
      parseSyncActionResult(
        await runQueuedSyncAction(db, (service) =>
          service.validateStoredGithubToken(),
        ),
      ),
    )
  })

  onMessage('sync.saveGithubToken', ({ data, sender }) => {
    const request = syncGithubTokenRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'sync.saveGithubToken',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) =>
      parseSyncActionResult(
        await runQueuedSyncAction(db, (service) =>
          service.saveGithubToken(request.token),
        ),
      ),
    )
  })

  onMessage('sync.deleteGithubToken', ({ data, sender }) => {
    const request = syncRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'sync.deleteGithubToken',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) => {
      const result = parseSyncActionResult(
        await runQueuedSyncAction(db, (service) => service.deleteGithubToken()),
      )

      if (result.outcome === 'success') {
        await clearPendingAutomaticSyncBestEffort()
      }

      return result
    })
  })

  onMessage('sync.createGithubGist', ({ data, sender }) => {
    const request = syncRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'sync.createGithubGist',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) => {
      const result = parseSyncActionResult(
        await runQueuedSyncAction(db, (service) => service.createGithubGist()),
      )

      if (result.outcome === 'success') {
        await clearPendingAutomaticSyncBestEffort()
      }

      return result
    })
  })

  onMessage('sync.connectGithubGist', ({ data, sender }) => {
    const request = syncGithubGistRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'sync.connectGithubGist',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) =>
      parseSyncActionResult(
        await runQueuedSyncAction(db, (service) =>
          service.connectGithubGist(request.gistId),
        ),
      ),
    )
  })

  onMessage('sync.setEnabled', ({ data, sender }) => {
    const request = syncSetEnabledRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'sync.setEnabled',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) => {
      const result = parseSyncActionResult(
        await runQueuedSyncAction(db, (service) =>
          service.setEnabled(request.enabled),
        ),
      )

      if (!request.enabled && result.outcome === 'success') {
        await clearPendingAutomaticSyncBestEffort()
      }

      return result
    })
  })

  onMessage('sync.checkRemoteOnOpen', ({ data, sender }) => {
    const request = syncRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'sync.checkRemoteOnOpen',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) =>
      parseSyncActionResult(
        await runQueuedSyncAction(db, (service) => service.checkRemoteOnOpen()),
      ),
    )
  })

  onMessage('sync.pullLatest', ({ data, sender }) => {
    const request = syncPullLatestRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'sync.pullLatest',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) => {
      const result = parseSyncActionResult(
        await runQueuedSyncAction(db, (service) =>
          service.pullLatest({
            confirmLocalOverwrite: request.confirmLocalOverwrite,
          }),
        ),
      )

      if (result.outcome === 'success') {
        await clearPendingAutomaticSyncBestEffort()
      }

      return result
    })
  })

  onMessage('sync.pushLocal', ({ data, sender }) => {
    const request = syncPushLocalRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'sync.pushLocal',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) => {
      const result = parseSyncActionResult(
        await runQueuedSyncAction(db, (service) =>
          service.pushLocal({
            confirmRemoteOverwrite: request.confirmRemoteOverwrite,
          }),
        ),
      )

      if (result.outcome === 'success') {
        await clearPendingAutomaticSyncBestEffort()
      }

      return result
    })
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

        await saveReviewResultWithTrackProgress(
          db,
          {
            ...reviewInput,
            reviewedAt,
            ...(request.reviewMode ? { reviewMode: request.reviewMode } : {}),
          },
          settings,
        )
        const details = await getPracticeDetails(db, request.problemSlug, {
          targetRetention: settings.review.targetRetention,
        })

        return serializePracticeDetails(details)
      },
      () =>
        broadcastPracticeInvalidation({
          problemSlug: request.problemSlug,
          source: request.surface,
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
        await overrideLastReviewResultWithTrackProgress(
          db,
          {
            problemSlug: request.problemSlug,
            rating: request.rating,
            elapsedSeconds: request.elapsedSeconds,
            isCorrect: request.isCorrect,
            log: readReviewLogRequest(request),
            targetRetention: settings.review.targetRetention,
          },
          settings,
        )
        const details = await getPracticeDetails(db, request.problemSlug, {
          targetRetention: settings.review.targetRetention,
        })

        return serializePracticeDetails(details)
      },
      () =>
        broadcastPracticeInvalidation({
          problemSlug: request.problemSlug,
          source: request.surface,
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
        }),
    )
  })

  onMessage('analytics.getSummary', ({ data, sender }) => {
    const request = analyticsSummaryRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'analytics.getSummary',
      'dashboard',
      sender,
    )

    void request

    return getAppDb().then(async ({ db }) =>
      analyticsSummarySchema.parse(await getAnalyticsSummary(db)),
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

  onMessage('settings.cycleThemeMode', ({ data, sender }) => {
    const request = settingsCycleThemeModeRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'settings.cycleThemeMode',
      request.surface,
      sender,
    )
    return runSettingsMutation(request.surface, (db) =>
      cycleThemeMode(db),
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
  let prev: UserSettings | undefined
  return runDbMutation(
    async (db) => {
      prev = await getSettings(db)
      return writeSettings(db)
    },
    async (next) => {
      await broadcastCacheInvalidation({
        reason: 'settings-updated',
        source,
        tags: ['settings'],
      })
      if (prev !== undefined) {
        try {
          await dueNotification.onSettingsChanged(prev, next)
        } catch {
          // Notification rescheduling must not fail settings mutations.
        }
      }
    },
  )
}

function createSyncServiceForDb(db: Db) {
  return createSyncServiceForDbInQueue(db, false)
}

function createSyncServiceForDbInQueue(db: Db, isInsideMutationQueue: boolean) {
  return createBackgroundSyncService(
    db,
    async () => {
      await broadcastDataManagementInvalidation('dashboard')
    },
    {
      runRemoteRestore: (work) =>
        runRemoteRestoreInMutationQueue(work, isInsideMutationQueue),
    },
  )
}

type BackgroundSyncService = ReturnType<typeof createBackgroundSyncService>

function runQueuedSyncAction<T>(
  db: Db,
  action: (service: BackgroundSyncService) => Promise<T>,
) {
  return runInMutationQueue(async () => {
    const dirtyMarkReady = await retryPendingDirtyMark()

    if (!dirtyMarkReady) {
      throw new Error(
        'Local data changed but sync metadata could not be saved.',
      )
    }

    return action(createSyncServiceForDbInQueue(db, true))
  })
}

function parseSyncActionResult(result: unknown) {
  return syncActionResultSchema.parse(result)
}

type DbMutationSyncMode = 'mark-dirty' | 'none'

let dbMutationQueue: Promise<void> = Promise.resolve()
let dbMutationDepth = 0
let hasPendingDirtyMarkRetry = false

function runDbMutation<T>(
  write: (db: Db) => Promise<T>,
  afterFlush?: (result: T) => unknown,
  options: { syncMode?: DbMutationSyncMode } = {},
) {
  const syncMode = options.syncMode ?? 'mark-dirty'
  return runInMutationQueue(async () => {
    const { db } = await getAppDb()
    const result = await write(db)

    if (syncMode === 'mark-dirty') {
      await markSyncLocalDataChangedBestEffort()
    }

    await flushDbSnapshot()
    await afterFlush?.(result)

    if (syncMode === 'mark-dirty') {
      await scheduleAutoPushAfterMutationBestEffort()
    }

    return result
  })
}

function runInMutationQueue<T>(work: () => Promise<T>) {
  const queued = dbMutationQueue.then(async () => {
    dbMutationDepth += 1

    try {
      return await work()
    } finally {
      dbMutationDepth -= 1
    }
  })
  dbMutationQueue = queued.then(
    () => undefined,
    () => undefined,
  )

  return queued
}

async function scheduleAutoPushAfterMutationBestEffort() {
  try {
    await syncAutoSync.scheduleAutoPushAfterMutation()
  } catch {
    // Local saves already succeeded; automatic sync scheduling must not fail them.
  }
}

async function clearPendingAutomaticSyncBestEffort() {
  try {
    await syncAutoSync.clearPendingAutomaticSync()
  } catch {
    // Manual sync already succeeded; alarm cleanup should not change its result.
  }
}

async function markSyncLocalDataChangedBestEffort() {
  try {
    await markSyncLocalDataChanged()
    hasPendingDirtyMarkRetry = false
  } catch {
    hasPendingDirtyMarkRetry = true
    // Local data is already written; sync metadata failure must not fail saves.
  }
}

async function retryPendingDirtyMark() {
  if (!hasPendingDirtyMarkRetry) {
    return true
  }

  try {
    await markSyncLocalDataChanged()
    hasPendingDirtyMarkRetry = false
    return true
  } catch {
    return false
  }
}

function runRemoteRestoreInMutationQueue<T>(
  work: () => Promise<T>,
  isInsideMutationQueue: boolean,
) {
  const guardedWork = async () => {
    const metadata = await readSyncMetadata()

    if (metadata.dirtySinceLastSync) {
      throw new Error(
        'Sync conflict detected. Local data changed before remote data could be applied.',
      )
    }

    return work()
  }

  if (isInsideMutationQueue && dbMutationDepth > 0) {
    return guardedWork()
  }

  return runInMutationQueue(guardedWork)
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
}) {
  return broadcastCacheInvalidation({
    problemSlug: input.problemSlug,
    reason: 'practice-updated',
    source: input.source,
    tags: ['practice'],
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

function serializeTodayQueue(queue: TodayQueue): SerializedTodayQueue {
  const serializeItem = (item: QueueItem) => ({
    category: item.category,
    problemSlug: item.problemSlug,
    title: item.title,
    difficulty: item.difficulty,
    isPremium: item.isPremium,
    state: serializeNormalizedPracticeState(item.state),
    reason: item.reason,
  })

  return todayQueueSchema.parse({
    generatedAt: queue.generatedAt.toISOString(),
    dueCount: queue.dueCount,
    newCount: queue.newCount,
    reinforcementCount: queue.reinforcementCount,
    excludedCount: queue.excludedCount,
    items: queue.items.map(serializeItem),
    topRecommendation: queue.topRecommendation
      ? serializeItem(queue.topRecommendation)
      : null,
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
