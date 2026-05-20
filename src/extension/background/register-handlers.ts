import {
  activeTrackSchema,
  appShellDataSchema,
  appShellRequestSchema,
  leetcodeProblemRemoteRuntimeRequestSchema,
  leetcodeSubmissionResultRemoteRuntimeRequestSchema,
  onMessage,
  pingRequestSchema,
  problemContextSchema,
  problemContextRequestSchema,
  problemsUpsertFromPageRequestSchema,
  queueRequestSchema,
  settingsRequestSchema,
  settingsUpdateRequestSchema,
  todayQueueSchema,
  tracksRequestSchema,
  type SerializedActiveTrack,
  type SerializedProblem,
  type SerializedProblemContext,
  type SerializedTodayQueue,
} from '@/extension/messaging'
import { getAppShellData } from '@/features/app-shell'
import {
  readLeetCodeProblemContentInBackground,
  readLeetCodeProblemMetadataInBackground,
  readLeetCodeSubmissionResultInBackground,
} from '@/features/leetcode-capture'
import {
  practiceDetailsRequestSchema,
  practiceDetailsSchema,
  practiceOverrideLastReviewResultRequestSchema,
  practiceResetScheduleRequestSchema,
  practiceReviewResultSchema,
  practiceSaveReviewResultRequestSchema,
  practiceSetSuspendedRequestSchema,
  type SerializedPracticeDetails,
  type SerializedReviewResult,
} from '@/features/practice/api/practice-contracts'
import {
  getPracticeDetails,
  overrideLastReviewResult,
  resetPracticeSchedule,
  saveReviewResult,
  setPracticeSuspended,
  type PracticeDetails,
} from '@/features/practice'
import {
  getProblemContext,
  upsertProblemFromPage,
  type Problem,
  type ProblemContext,
} from '@/features/problems'
import { getTodayQueue, type TodayQueue } from '@/features/queue'
import {
  getSettings,
  updateSettings,
  type UserSettings,
} from '@/features/settings'
import { getActiveTrack, type ActiveTrack } from '@/features/tracks'
import { getAppDb } from '@/platform/db'

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
      request.surface,
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
      return serializeProblem(problem)
    })
  })

  onMessage('problems.getContext', ({ data, sender }) => {
    const request = problemContextRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'problems.getContext',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) =>
      serializeProblemContext(await getProblemContext(db, request.slug)),
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
    return getAppDb().then(async ({ db }) =>
      serializePracticeDetails(
        await setPracticeSuspended(db, {
          problemId: request.problemId,
          suspended: request.suspended,
        }),
      ),
    )
  })

  onMessage('practice.resetSchedule', ({ data, sender }) => {
    const request = practiceResetScheduleRequestSchema.parse(data)

    assertCanSenderCallExtensionMethod(
      'practice.resetSchedule',
      request.surface,
      sender,
    )
    return getAppDb().then(async ({ db }) =>
      serializePracticeDetails(
        await resetPracticeSchedule(db, {
          problemId: request.problemId,
          keepLog: request.keepLog,
        }),
      ),
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
    return getAppDb().then(async ({ db }) => updateSettings(db, request.patch))
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

function serializeProblemContext(
  context: ProblemContext | null,
): SerializedProblemContext {
  return problemContextSchema.parse(
    context
      ? {
          ...context,
          problem: serializeProblem(context.problem),
          dueAt: context.dueAt?.toISOString() ?? null,
        }
      : null,
  )
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

function serializePracticeDetails(
  details: PracticeDetails,
): SerializedPracticeDetails {
  return practiceDetailsSchema.parse({
    problemId: details.problemId,
    cardId: details.cardId,
    practice: details.practice
      ? {
          ...details.practice,
          lastReviewedAt:
            details.practice.lastReviewedAt?.toISOString() ?? null,
        }
      : null,
    card: details.card ? serializeFsrsCard(details.card) : null,
    summary: serializePracticeSummary(details.summary),
    currentLog: details.currentLog,
    recentAttempts: details.recentAttempts.map(serializePracticeAttempt),
    latestAttempt: details.latestAttempt
      ? serializePracticeAttempt(details.latestAttempt)
      : null,
    canOverrideLatestReview: details.canOverrideLatestReview,
  })
}

function serializeFsrsCard(card: NonNullable<PracticeDetails['card']>) {
  return {
    ...card,
    dueAt: card.dueAt.toISOString(),
    lastReviewAt: card.lastReviewAt?.toISOString() ?? null,
  }
}

function serializePracticeAttempt(
  attempt: PracticeDetails['recentAttempts'][number],
) {
  return {
    ...attempt,
    reviewedAt: attempt.reviewedAt.toISOString(),
    createdAt: attempt.createdAt.toISOString(),
    updatedAt: attempt.updatedAt.toISOString(),
  }
}

function serializeReviewResult(result: {
  problemId: string
  cardId: string
  rating: SerializedReviewResult['rating']
  status: SerializedReviewResult['status']
  dueAt: Date
  reviewedAt: Date
  summary: PracticeDetails['summary']
}): SerializedReviewResult {
  return practiceReviewResultSchema.parse({
    problemId: result.problemId,
    cardId: result.cardId,
    rating: result.rating,
    status: result.status,
    dueAt: result.dueAt.toISOString(),
    reviewedAt: result.reviewedAt.toISOString(),
    summary: serializePracticeSummary(result.summary),
  })
}

function serializePracticeSummary(summary: PracticeDetails['summary']) {
  return {
    ...summary,
    nextReviewAt: summary.nextReviewAt?.toISOString() ?? null,
    lastReviewedAt: summary.lastReviewedAt?.toISOString() ?? null,
  }
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

function serializeActiveTrack(
  activeTrack: ActiveTrack | null,
): SerializedActiveTrack {
  return activeTrackSchema.parse(
    activeTrack
      ? {
          ...activeTrack,
          nextProblem: activeTrack.nextProblem
            ? serializeProblem(activeTrack.nextProblem)
            : null,
        }
      : null,
  )
}
