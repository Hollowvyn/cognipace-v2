import {
  activeTrackSchema,
  appShellDataSchema,
  appShellRequestSchema,
  leetcodeProblemRemoteRuntimeRequestSchema,
  leetcodeSubmissionResultRemoteRuntimeRequestSchema,
  onMessage,
  pingRequestSchema,
  practiceOverrideLastReviewResultRequestSchema,
  practiceSaveReviewResultRequestSchema,
  problemContextSchema,
  problemContextRequestSchema,
  problemsUpsertFromPageRequestSchema,
  queueRequestSchema,
  reviewResultSchema,
  settingsRequestSchema,
  settingsUpdateRequestSchema,
  todayQueueSchema,
  tracksRequestSchema,
  type SerializedActiveTrack,
  type SerializedProblem,
  type SerializedProblemContext,
  type SerializedReviewResult,
  type SerializedTodayQueue,
} from '@/extension/messaging'
import { getAppShellData } from '@/features/app-shell'
import {
  readLeetCodeProblemContentInBackground,
  readLeetCodeProblemMetadataInBackground,
  readLeetCodeSubmissionResultInBackground,
} from '@/features/leetcode-capture'
import { overrideLastReviewResult, saveReviewResult } from '@/features/practice'
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
        ...(request.reviewedAt
          ? { reviewedAt: new Date(request.reviewedAt) }
          : {}),
      })

      return serializeReviewResult(result)
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
  log?: {
    interviewPattern?: string | null | undefined
    timeComplexity?: string | null | undefined
    spaceComplexity?: string | null | undefined
    languages?: string | null | undefined
    notes?: string | null | undefined
  } | undefined
  notes?: string | null | undefined
}) {
  if (request.log) {
    return request.log
  }

  return request.notes === undefined ? undefined : { notes: request.notes }
}

function serializeReviewResult(result: {
  problemId: string
  cardId: string
  rating: SerializedReviewResult['rating']
  status: string
  dueAt: Date
  reviewedAt: Date
  summary: {
    phase: SerializedReviewResult['summary']['phase']
    nextReviewAt: Date | null
    lastReviewedAt: Date | null
    reviewCount: number
    lapses: number
    difficulty: number | null
    stability: number | null
    scheduledDays: number | null
    suspended: boolean
    isStarted: boolean
    isDue: boolean
    isOverdue: boolean
    overdueDays: number
    retrievability: number | null
  }
}): SerializedReviewResult {
  return reviewResultSchema.parse({
    problemId: result.problemId,
    cardId: result.cardId,
    rating: result.rating,
    status: result.status,
    dueAt: result.dueAt.toISOString(),
    reviewedAt: result.reviewedAt.toISOString(),
    summary: {
      ...result.summary,
      nextReviewAt: result.summary.nextReviewAt?.toISOString() ?? null,
      lastReviewedAt: result.summary.lastReviewedAt?.toISOString() ?? null,
    },
  })
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
      summary: {
        ...item.summary,
        nextReviewAt: item.summary.nextReviewAt?.toISOString() ?? null,
        lastReviewedAt: item.summary.lastReviewedAt?.toISOString() ?? null,
      },
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
