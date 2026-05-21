import { describe, expect, it } from 'vitest'

import { createPracticeRepository } from '@/features/practice'
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
      queue: {
        dailyGoal: 4,
        dueCount: 0,
        newCount: 1,
        reinforcementCount: 0,
      },
      activeTrack: {
        title: 'LeetCode 75',
        nextProblem: {
          slug: 'two-sum',
        },
      },
      settings: {
        timing: {
          requireSolveTime: false,
          hardMode: false,
        },
      },
    })
    expect(payload.recommendation.problem?.slug).toBe('two-sum')
    expect(payload.popup.queuePreview).toHaveLength(1)
  })

  it('composes dashboard payload with a larger queue preview', async () => {
    const handle = await createTestDb()

    const payload = await getDashboardPayload(handle)

    expect(payload.surface).toBe('dashboard')
    expect(
      payload.dashboard.queuePreview.map((item) => item.problem.slug),
    ).toEqual(['two-sum'])
  })

  it('composes overlay payload with current problem practice details', async () => {
    const handle = await createTestDb()
    const practiceRepository = createPracticeRepository(handle.db)

    await practiceRepository.updateCurrentPracticeLog({
      problemId: 'leetcode:two-sum',
      log: {
        interviewPattern: 'Hash map',
        notes: 'Track complements.',
      },
    })

    const payload = await getOverlayPayload(handle, 'two-sum')

    expect(payload).toMatchObject({
      surface: 'overlay',
      overlay: {
        problem: {
          id: 'leetcode:two-sum',
          slug: 'two-sum',
        },
        practice: {
          problemId: 'leetcode:two-sum',
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
          hardMode: false,
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
        problem: null,
        practice: null,
        timing: {
          requireSolveTime: false,
          hardMode: false,
        },
      },
    })
  })

  it('reflects saved reviews in overlay practice details and queue categories', async () => {
    const handle = await createTestDb()
    const practiceRepository = createPracticeRepository(handle.db)

    await practiceRepository.saveReviewResult({
      problemId: 'leetcode:two-sum',
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

async function getPopupPayload(
  handle: TestDbHandle,
  readAt = generatedAt,
) {
  return popupAppShellDataSchema.parse(
    await getAppShellData(handle.db, { surface: 'popup' }, new Date(readAt)),
  )
}

async function getDashboardPayload(
  handle: TestDbHandle,
  readAt = generatedAt,
) {
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
