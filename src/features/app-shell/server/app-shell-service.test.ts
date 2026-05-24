import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { createPracticeRepository } from '@/features/practice/data/practice-repository'
import { createSettingsRepository } from '@/features/settings/data/settings-repository'
import { recordActiveTrackProblemCompletion } from '@/features/tracks/server/tracks-service'
import { tracks } from '@/platform/db/schema'
import { createTestDb } from '@/platform/db/test-db'

import {
  dashboardAppShellDataSchema,
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
        trackId: 'leetcode-75',
        title: 'LeetCode 75',
        groupTitle: 'Arrays and Hashing',
        dueAt: null,
        progress: {
          completedCount: 0,
          totalCount: 1,
          percent: 0,
        },
        nextProblem: {
          problemSlug: 'two-sum',
        },
      },
      settings: {
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
    expect(payload.popup.queuePreview).toHaveLength(0)
  })

  it('serializes the active track due date when present', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const dueAt = new Date('2026-02-14T00:00:00.000Z')

    await handle.db
      .update(tracks)
      .set({ dueAt: dueAt.getTime() })
      .where(eq(tracks.id, 'leetcode-75'))

    const payload = await getPopupPayload(handle)

    expect(payload.activeTrack.dueAt).toBe(dueAt.toISOString())
  })

  it('uses the track ledger instead of global practice history for popup progress', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const practiceRepository = createPracticeRepository(handle.db)

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
      progress: {
        completedCount: 1,
        totalCount: 1,
        percent: 100,
      },
      nextProblem: null,
    })
  })

  it('marks active track guidance exhausted instead of falling back to queue in popup data', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })

    await recordActiveTrackProblemCompletion(handle.db, {
      problemSlug: 'two-sum',
      rating: 'good',
      completedAt: new Date(generatedAt),
    })

    const payload = await getPopupPayload(handle)

    expect(payload.activeTrack).toMatchObject({
      state: 'exhausted',
      trackId: 'leetcode-75',
      detail: 'No more problems in track.',
      nextProblem: null,
    })
    expect(payload.recommendation.problem).toBeNull()
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

  it('composes dashboard payload with a larger queue preview', async () => {
    const handle = await createTestDb()

    const payload = await getDashboardPayload(handle)

    expect(payload.surface).toBe('dashboard')
    expect(
      payload.dashboard.queuePreview.map((item) => item.problem.problemSlug),
    ).toEqual([])
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
          summary: {
            phase: 'new',
            isStarted: false,
          },
        },
        timing: {
          requireSolveTime: false,
          strictTiming: false,
        },
        nextStep: {
          kind: 'empty',
          problem: null,
        },
      },
    })
    expect('queue' in payload).toBe(false)
  })

  it('returns an empty overlay payload before a page problem is known', async () => {
    const handle = await createTestDb()

    const payload = await getOverlayPayload(handle)

    expect(payload).toMatchObject({
      surface: 'overlay',
      overlay: {
        automation: {
          autoDetectSolved: true,
        },
        problem: null,
        practice: null,
        timing: {
          requireSolveTime: false,
          strictTiming: false,
        },
        nextStep: null,
      },
    })
  })

  it('uses the distinct active-track problem for overlay next step', async () => {
    const handle = await createTestDb()

    const payload = await getOverlayPayload(handle, 'valid-parentheses')

    expect(payload.overlay.nextStep).toMatchObject({
      kind: 'track',
      title: 'Two Sum',
      problem: {
        problemSlug: 'two-sum',
      },
    })
  })

  it('ignores active-track next step in overlay free practice mode', async () => {
    const handle = await createTestDb()

    await createSettingsRepository(handle.db).updateSettings({
      practice: { mode: 'freePractice' },
    })

    const payload = await getOverlayPayload(handle, 'valid-parentheses')

    expect(payload.overlay.nextStep).toMatchObject({
      kind: 'empty',
      problem: null,
    })
  })

  it('falls back to the queue for overlay next step when active track has no next problem', async () => {
    const handle = await createTestDb({
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    const practiceRepository = createPracticeRepository(handle.db)

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

  it('exposes disabled overlay auto-detect from overlay settings', async () => {
    const handle = await createTestDb()

    await createSettingsRepository(handle.db).updateSettings({
      overlay: {
        autoDetectSolved: false,
      },
    })

    const payload = await getOverlayPayload(handle, 'two-sum')

    expect(payload.overlay.automation.autoDetectSolved).toBe(false)
  })

  it('reflects saved reviews in overlay practice details and queue categories', async () => {
    const handle = await createTestDb()
    const practiceRepository = createPracticeRepository(handle.db)

    await practiceRepository.saveReviewResult({
      problemSlug: 'two-sum',
      rating: 'good',
      reviewedAt: new Date(generatedAt),
      reviewMode: 'leetcode',
    })

    const readAt = '2026-01-01T10:05:00.000Z'
    const popupPayload = await getPopupPayload(handle, readAt)
    const overlayPayload = await getOverlayPayload(handle, 'two-sum', readAt)

    expect(popupPayload.queue).toMatchObject({
      dueCount: 0,
      newCount: 0,
      reinforcementCount: 1,
    })
    expect(popupPayload.recommendation.category).toBe('reinforcement')
    expect(overlayPayload.overlay.practice?.latestAttempt).toMatchObject({
      rating: 'good',
      reviewMode: 'leetcode',
    })
  })
})

type TestDbHandle = Awaited<ReturnType<typeof createTestDb>>

async function getPopupPayload(handle: TestDbHandle, readAt = generatedAt) {
  return popupAppShellDataSchema.parse(
    await getAppShellData(handle.db, { surface: 'popup' }, new Date(readAt)),
  )
}

async function getDashboardPayload(handle: TestDbHandle, readAt = generatedAt) {
  return dashboardAppShellDataSchema.parse(
    await getAppShellData(
      handle.db,
      { surface: 'dashboard' },
      new Date(readAt),
    ),
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
