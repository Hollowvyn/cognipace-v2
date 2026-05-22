import {
  activeTrackSchema,
  leetcodeProblemRemoteRuntimeRequestSchema,
  leetcodeSubmissionResultRemoteRuntimeRequestSchema,
  onMessage,
  pingRequestSchema,
  problemsUpsertFromPageRequestSchema,
  queueRequestSchema,
  settingsRequestSchema,
  settingsUpdateRequestSchema,
  todayQueueSchema,
  tracksRequestSchema,
  type SerializedActiveTrack,
  type SerializedProblem,
  type SerializedTodayQueue,
} from '@/extension/messaging'
import {
  appShellDataSchema,
  appShellRequestSchema,
  type AppShellRequest,
} from '@/features/app-shell/api/app-shell-contracts'
import { getAppShellData } from '@/features/app-shell/server/app-shell-service'
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
  serializePracticeDetails,
  serializePracticeSummary,
  serializeReviewResult,
} from '@/features/practice/api/practice-serializers'
import {
  getPracticeDetails,
  overrideLastReviewResult,
  resetPracticeSchedule,
  saveReviewResult,
  setPracticeSuspended,
  updateCurrentPracticeLog,
} from '@/features/practice/server/practice-service'
import type { Problem } from '@/features/problems/domain'
import { upsertProblemFromPage } from '@/features/problems/server/problems-service'
import type { TodayQueue } from '@/features/queue/domain'
import { getTodayQueue } from '@/features/queue/server/queue-service'
import type { UserSettings } from '@/features/settings/domain'
import {
  getSettings,
  updateSettings,
} from '@/features/settings/server/settings-service'
import type { ActiveTrack } from '@/features/tracks/domain'
import { getActiveTrack } from '@/features/tracks/server/tracks-service'
import { getAppDb } from '@/platform/db'

import { broadcastCacheInvalidation } from './cache-invalidation-broadcaster'
import { assertCanSenderCallExtensionMethod } from './runtime-policy'

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

  onMessage('problems.upsertFromPage', ({ data, sender }) => {
    const request = problemsUpsertFromPageRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'problems.upsertFromPage',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) => {
      const problem = await upsertProblemFromPage(db, request)
      await broadcastCacheInvalidation({
        problemId: problem.id,
        problemSlug: problem.slug,
        reason: 'problem-catalog-updated',
        source: request.surface,
        tags: ['problems'],
      })

      return serializeProblem(problem)
    })
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
      const details = await getPracticeDetails(db, request.problemId, {
        targetRetention: settings.memoryReview.targetRetention,
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
    return getAppDb().then(async ({ db }) => {
      const settings = await getSettings(db)
      const reviewInput = {
        problemId: request.problemId,
        rating: request.rating,
        elapsedSeconds: request.elapsedSeconds,
        isCorrect: request.isCorrect,
        log: readReviewLogRequest(request),
        targetRetention: settings.memoryReview.targetRetention,
      }

      const result = await saveReviewResult(db, {
        ...reviewInput,
        ...(request.reviewedAt
          ? { reviewedAt: new Date(request.reviewedAt) }
          : {}),
        ...(request.reviewMode ? { reviewMode: request.reviewMode } : {}),
      })

      await broadcastCacheInvalidation({
        problemId: request.problemId,
        reason: 'practice-updated',
        source: request.surface,
        tags: ['practice', 'queue', 'app-shell'],
      })

      return serializeReviewResult(result)
    })
  })

  onMessage('practice.overrideLastReviewResult', ({ data, sender }) => {
    const request = practiceOverrideLastReviewResultRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'practice.overrideLastReviewResult',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) => {
      const settings = await getSettings(db)
      const result = await overrideLastReviewResult(db, {
        problemId: request.problemId,
        rating: request.rating,
        elapsedSeconds: request.elapsedSeconds,
        isCorrect: request.isCorrect,
        log: readReviewLogRequest(request),
        targetRetention: settings.memoryReview.targetRetention,
      })

      await broadcastCacheInvalidation({
        problemId: request.problemId,
        reason: 'practice-updated',
        source: request.surface,
        tags: ['practice', 'queue', 'app-shell'],
      })

      return serializeReviewResult(result)
    })
  })

  onMessage('practice.setSuspended', ({ data, sender }) => {
    const request = practiceSetSuspendedRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'practice.setSuspended',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) => {
      const details = await setPracticeSuspended(db, {
        problemId: request.problemId,
        suspended: request.suspended,
      })

      await broadcastCacheInvalidation({
        problemId: request.problemId,
        reason: 'practice-updated',
        source: request.surface,
        tags: ['practice', 'queue', 'app-shell'],
      })

      return serializePracticeDetails(details)
    })
  })

  onMessage('practice.resetSchedule', ({ data, sender }) => {
    const request = practiceResetScheduleRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'practice.resetSchedule',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) => {
      const details = await resetPracticeSchedule(db, {
        problemId: request.problemId,
        keepLog: request.keepLog,
      })

      await broadcastCacheInvalidation({
        problemId: request.problemId,
        reason: 'practice-updated',
        source: request.surface,
        tags: ['practice', 'queue', 'app-shell'],
      })

      return serializePracticeDetails(details)
    })
  })

  onMessage('practice.updateCurrentLog', ({ data, sender }) => {
    const request = practiceUpdateCurrentLogRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'practice.updateCurrentLog',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) => {
      const settings = await getSettings(db)

      const details = await updateCurrentPracticeLog(db, {
        problemId: request.problemId,
        log: request.log,
        targetRetention: settings.memoryReview.targetRetention,
      })

      await broadcastCacheInvalidation({
        problemId: request.problemId,
        reason: 'practice-updated',
        source: request.surface,
        tags: ['practice', 'app-shell'],
      })

      return serializePracticeDetails(details)
    })
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
    return getAppDb().then(async ({ db }) => {
      const settings = await updateSettings(db, request.patch)

      await broadcastCacheInvalidation({
        reason: 'settings-updated',
        source: request.surface,
        tags: ['settings'],
      })

      return settings
    })
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

function serializeProblem(problem: Problem): SerializedProblem {
  return {
    ...problem,
    createdAt: problem.createdAt.toISOString(),
    updatedAt: problem.updatedAt.toISOString(),
  }
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

function serializeTodayQueue(queue: TodayQueue): SerializedTodayQueue {
  return todayQueueSchema.parse({
    generatedAt: queue.generatedAt.toISOString(),
    dailyGoal: queue.dailyGoal,
    dueCount: queue.dueCount,
    newCount: queue.newCount,
    reinforcementCount: queue.reinforcementCount,
    items: queue.items.map((item) => ({
      ...item,
      dueAt: item.dueAt?.toISOString() ?? null,
      summary: serializePracticeSummary(item.summary),
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
  return activeTrackSchema.parse(
    activeTrack
      ? {
          ...activeTrack,
          track: {
            ...activeTrack.track,
            dueAt: activeTrack.track.dueAt?.toISOString() ?? null,
          },
          nextProblem: activeTrack.nextProblem
            ? serializeProblem(activeTrack.nextProblem)
            : null,
        }
      : null,
  )
}
