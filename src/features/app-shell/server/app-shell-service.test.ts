import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { createPracticeRepository } from '@/features/practice/data/practice-repository'
import { createSettingsRepository } from '@/features/settings/data/settings-repository'
import { recordActiveTrackProblemCompletion } from '@/features/tracks/server/tracks-service'
import { trackSession } from '@/platform/db/schema'
import { createTestDb } from '@/platform/db/test-db'

import {
  overlayAppShellDataSchema,
  popupAppShellDataSchema,
} from '../api/app-shell-contracts'
import { getAppShellData } from './app-shell-service'

const generatedAt = '2026-01-01T10:00:00.000Z'

describe('app-shell service', () => {
  it('composes popup payload from queue, settings, and active track state', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    const payload = await getPopupPayload(handle)

    expect(payload).toMatchObject({
      surface: 'popup',
      generatedAt,
      status: {
        label: 'Practice ready',
      },
      metrics: [
        { label: 'Due Today', value: '0' },
        { label: 'Streak', value: '0 days' },
      ],
      queue: {
        dailyGoal: 4,
        dueCount: 0,
        newCount: 0,
        reinforcementCount: 0,
      },
      activeTrack: {
        state: 'ready',
        trackId: 'bytebytego-coding-patterns-101',
        title: 'ByteByteGo Coding Patterns 101',
        groupTitle: 'Two Pointers',
        dueAt: null,
        progress: {
          completedCount: 0,
          totalCount: 101,
          percent: 0,
        },
        nextProblem: {
          problemSlug: 'two-sum-ii-input-array-is-sorted',
          title: 'Pair Sum - Sorted',
        },
      },
      settings: {
        appearance: {
          themeMode: 'system',
        },
        practice: {
          mode: 'studyPlan',
        },
        assessment: {
          requireSolveTime: false,
          strictTiming: false,
        },
      },
    })
    expect(payload.recommendation).toMatchObject({
      category: null,
      problem: null,
    })
    expect(payload.settings.appearance).toEqual({
      themeMode: 'system',
    })
    expect(payload.popup.queuePreview).toHaveLength(0)
  })

  it('uses the track ledger instead of global practice history for popup progress', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const practiceRepository = createPracticeRepository(handle.db)

    await activateLeetCode75Track(handle)
    await practiceRepository.saveReviewResult({
      problemSlug: 'two-sum',
      rating: 'good',
      reviewedAt: new Date(generatedAt),
      reviewMode: 'manual',
    })

    const payloadAfterGlobalReview = await getPopupPayload(handle)

    expect(payloadAfterGlobalReview.activeTrack).toMatchObject({
      progress: {
        completedCount: 0,
        totalCount: 1,
        percent: 0,
      },
      nextProblem: {
        problemSlug: 'two-sum',
      },
    })

    await recordActiveTrackProblemCompletion(handle.db, {
      problemSlug: 'two-sum',
      rating: 'good',
      completedAt: new Date(generatedAt),
    })

    const payloadAfterLedgerCompletion = await getPopupPayload(handle)

    expect(payloadAfterLedgerCompletion.activeTrack).toMatchObject({
      state: 'exhausted',
      trackId: 'leetcode-75',
      detail: 'No more problems in track.',
      progress: {
        completedCount: 1,
        totalCount: 1,
        percent: 100,
      },
      nextProblem: null,
    })
  })

  it('does not include active-track state in popup free practice mode', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await createSettingsRepository(handle.db).updateSettings({
      practice: { mode: 'freePractice' },
    })

    const payload = await getPopupPayload(handle)

    expect(payload.recommendation.problem).toBeNull()
    expect(payload.activeTrack).toMatchObject({
      state: 'disabled-free-practice',
      trackId: null,
      title: 'Track guidance disabled',
      nextProblem: null,
    })
    expect(payload.settings.practice.mode).toBe('freePractice')
  })

  it('composes overlay payload with current problem practice details', async () => {
    const handle = await createTestDb()
    const practiceRepository = createPracticeRepository(handle.db)

    await practiceRepository.updateCurrentPracticeLog({
      problemSlug: 'two-sum',
      log: {
        interviewPattern: 'Hash map',
        notes: 'Track complements.',
      },
    })

    const payload = await getOverlayPayload(handle, 'two-sum')

    expect(payload).toMatchObject({
      surface: 'overlay',
      overlay: {
        appearance: {
          themeMode: 'system',
        },
        automation: {
          autoDetectSolved: true,
        },
        problem: {
          problemSlug: 'two-sum',
        },
        practice: {
          problemSlug: 'two-sum',
          card: null,
          currentLog: {
            interviewPattern: 'Hash map',
            notes: 'Track complements.',
          },
          phase: 'new',
          isStarted: false,
        },
        timing: {
          requireSolveTime: false,
          strictTiming: false,
        },
        nextStep: {
          kind: 'track',
          title: 'Pair Sum - Sorted',
          problem: {
            problemSlug: 'two-sum-ii-input-array-is-sorted',
          },
        },
      },
    })
    expect('queue' in payload).toBe(false)
  })

  it('falls back to the queue for overlay next step when active track has no next problem', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const practiceRepository = createPracticeRepository(handle.db)

    await activateLeetCode75Track(handle)
    await recordActiveTrackProblemCompletion(handle.db, {
      problemSlug: 'two-sum',
      rating: 'easy',
      completedAt: new Date('2025-12-31T10:00:00.000Z'),
    })
    await practiceRepository.saveReviewResult({
      problemSlug: 'valid-parentheses',
      rating: 'again',
      reviewedAt: new Date('2025-12-01T10:00:00.000Z'),
      reviewMode: 'manual',
    })

    const payload = await getOverlayPayload(handle, 'two-sum')

    expect(payload.overlay.nextStep).toMatchObject({
      kind: 'recommendation',
      title: 'Valid Parentheses',
      problem: {
        problemSlug: 'valid-parentheses',
      },
      category: 'due',
    })
  })
})

type TestDbHandle = Awaited<ReturnType<typeof createTestDb>>

async function activateLeetCode75Track(handle: TestDbHandle) {
  await handle.db
    .update(trackSession)
    .set({
      activeTrackId: 'leetcode-75',
      activeGroupId: 'leetcode-75:arrays-hashing',
    })
    .where(eq(trackSession.id, 'active'))
}

async function getPopupPayload(handle: TestDbHandle, readAt = generatedAt) {
  return popupAppShellDataSchema.parse(
    await getAppShellData(handle.db, { surface: 'popup' }, new Date(readAt)),
  )
}

async function getOverlayPayload(
  handle: TestDbHandle,
  problemSlug?: string,
  readAt = generatedAt,
) {
  return overlayAppShellDataSchema.parse(
    await getAppShellData(
      handle.db,
      {
        surface: 'overlay',
        ...(problemSlug ? { problemSlug } : {}),
      },
      new Date(readAt),
    ),
  )
}
