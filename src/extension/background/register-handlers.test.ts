import { describe, expect, it, beforeEach, vi } from 'vitest'

import {
  activeTrackSchema,
  queueRequestSchema,
  todayQueueSchema,
} from '@/extension/messaging'
import type { PopupAppShellData } from '@/features/app-shell/api/app-shell-contracts'
import { defaultUserSettings } from '@/features/settings/domain'
import type { ActiveTrack } from '@/features/tracks/domain'

import {
  registerBackgroundHandlers,
  serializeActiveTrack,
} from './register-handlers'

const backgroundMocks = vi.hoisted(() => {
  const handlers = new Map<
    string,
    (message: { data: unknown; sender: unknown }) => unknown
  >()
  const db = { kind: 'test-db' }

  return {
    db,
    handlers,
    assertCanSenderCallExtensionMethod: vi.fn(),
    broadcastCacheInvalidation: vi.fn(),
    getActiveTrack: vi.fn(),
    getAppDb: vi.fn(),
    getAppShellData: vi.fn(),
    getSettings: vi.fn(),
    onMessage: vi.fn(
      (
        method: string,
        handler: (message: { data: unknown; sender: unknown }) => unknown,
      ) => {
        handlers.set(method, handler)

        return () => undefined
      },
    ),
    updateSettings: vi.fn(),
  }
})

vi.mock('@/extension/messaging', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/extension/messaging')>()

  return {
    ...actual,
    onMessage: backgroundMocks.onMessage,
  }
})

vi.mock('@/features/app-shell/server/app-shell-service', () => ({
  getAppShellData: backgroundMocks.getAppShellData,
}))

vi.mock('@/features/tracks/server/tracks-service', () => ({
  getActiveTrack: backgroundMocks.getActiveTrack,
}))

vi.mock('@/features/settings/server/settings-service', () => ({
  getSettings: backgroundMocks.getSettings,
  updateSettings: backgroundMocks.updateSettings,
}))

vi.mock('@/platform/db', () => ({
  getAppDb: backgroundMocks.getAppDb,
}))

vi.mock('./cache-invalidation-broadcaster', () => ({
  broadcastCacheInvalidation: backgroundMocks.broadcastCacheInvalidation,
}))

vi.mock('./runtime-policy', () => ({
  assertCanSenderCallExtensionMethod:
    backgroundMocks.assertCanSenderCallExtensionMethod,
}))

describe('background handler registration', () => {
  beforeEach(() => {
    backgroundMocks.handlers.clear()
    vi.clearAllMocks()
    backgroundMocks.broadcastCacheInvalidation.mockResolvedValue(null)
    backgroundMocks.getAppDb.mockResolvedValue({ db: backgroundMocks.db })
    backgroundMocks.getSettings.mockResolvedValue(defaultUserSettings)
    backgroundMocks.updateSettings.mockResolvedValue(defaultUserSettings)
  })

  it('registers app-shell payload handling with policy and schema parsing', async () => {
    const sender = { id: 'extension-id' }
    const popupData = createPopupShellData()
    backgroundMocks.getAppShellData.mockResolvedValue(popupData)

    const handler = readRegisteredHandler('app.getShellData')
    const response = await handler({
      data: { surface: 'popup' },
      sender,
    })

    expect(
      backgroundMocks.assertCanSenderCallExtensionMethod,
    ).toHaveBeenCalledWith('app.getShellData', 'popup', sender)
    expect(backgroundMocks.getAppDb).toHaveBeenCalledTimes(1)
    expect(backgroundMocks.getAppShellData).toHaveBeenCalledWith(
      backgroundMocks.db,
      { surface: 'popup' },
    )
    expect(response).toMatchObject({
      surface: 'popup',
      activeTrack: {
        dueAt: '2026-03-01T00:00:00.000Z',
      },
    })
  })

  it('registers active-track handling with runtime serialization', async () => {
    const sender = { id: 'extension-id' }
    const dueAt = new Date('2026-03-01T00:00:00.000Z')
    backgroundMocks.getActiveTrack.mockResolvedValue(createActiveTrack(dueAt))

    const handler = readRegisteredHandler('tracks.getActiveTrack')
    const response = await handler({
      data: { surface: 'popup' },
      sender,
    })

    expect(
      backgroundMocks.assertCanSenderCallExtensionMethod,
    ).toHaveBeenCalledWith('tracks.getActiveTrack', 'popup', sender)
    expect(backgroundMocks.getActiveTrack).toHaveBeenCalledWith(
      backgroundMocks.db,
    )
    expect(response).toMatchObject({
      track: {
        id: 'leetcode-75',
        dueAt: dueAt.toISOString(),
      },
      activeGroup: {
        title: 'Arrays and Hashing',
      },
      progress: {
        completedCount: 1,
        totalCount: 2,
        percent: 50,
      },
      nextProblem: {
        slug: 'two-sum',
      },
    })
  })

  it('broadcasts cross-surface invalidation after settings updates', async () => {
    const sender = { id: 'extension-id' }
    const updatedSettings = {
      ...defaultUserSettings,
      timing: {
        ...defaultUserSettings.timing,
        hardMode: true,
      },
    }
    backgroundMocks.updateSettings.mockResolvedValue(updatedSettings)

    const handler = readRegisteredHandler('settings.updateSettings')
    const response = await handler({
      data: {
        surface: 'popup',
        patch: { timing: { hardMode: true } },
      },
      sender,
    })

    expect(
      backgroundMocks.assertCanSenderCallExtensionMethod,
    ).toHaveBeenCalledWith('settings.updateSettings', 'popup', sender)
    expect(backgroundMocks.updateSettings).toHaveBeenCalledWith(
      backgroundMocks.db,
      { timing: { hardMode: true } },
    )
    expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledWith({
      reason: 'settings-updated',
      source: 'popup',
      tags: ['settings'],
    })
    expect(response).toBe(updatedSettings)
  })
})

describe('background handler serializers', () => {
  it('serializes active track due date and progress for runtime responses', () => {
    const dueAt = new Date('2026-03-01T00:00:00.000Z')

    expect(serializeActiveTrack(createActiveTrack(dueAt))).toMatchObject({
      track: {
        id: 'leetcode-75',
        dueAt: dueAt.toISOString(),
      },
      activeGroup: {
        title: 'Arrays and Hashing',
      },
      progress: {
        completedCount: 1,
        totalCount: 2,
        percent: 50,
      },
      nextProblem: {
        slug: 'two-sum',
      },
    })
  })

  it('validates queue request timestamps at the runtime boundary', () => {
    expect(() =>
      queueRequestSchema.parse({
        surface: 'popup',
        at: 'not-a-date',
      }),
    ).toThrow()
    expect(() =>
      queueRequestSchema.parse({
        surface: 'popup',
        at: '2026-01-01T10:00:00.000Z',
      }),
    ).not.toThrow()
  })

  it('validates queue response timestamps and track progress consistency', () => {
    expect(() =>
      todayQueueSchema.parse({
        generatedAt: 'not-a-date',
        dailyGoal: 4,
        dueCount: 0,
        newCount: 0,
        reinforcementCount: 0,
        items: [],
      }),
    ).toThrow()
    expect(() =>
      activeTrackSchema.parse({
        ...serializeActiveTrack(createActiveTrack(null)),
        progress: {
          completedCount: 2,
          totalCount: 1,
          percent: 100,
        },
      }),
    ).toThrow()
  })
})

function readRegisteredHandler(method: string) {
  registerBackgroundHandlers()

  const handler = backgroundMocks.handlers.get(method)
  expect(handler).toBeDefined()

  return handler!
}

function createPopupShellData(): PopupAppShellData {
  return {
    surface: 'popup',
    generatedAt: '2026-01-01T00:00:00.000Z',
    status: {
      label: 'Practice ready',
      detail: '0 due, 1 new, 0 reinforcement available.',
    },
    metrics: [
      { label: 'Due Today', value: '0' },
      { label: 'Streak', value: '0 days' },
    ],
    recommendation: {
      title: 'Two Sum',
      detail: 'Start easy.',
      category: 'new',
      problem: {
        id: 'leetcode:two-sum',
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'easy',
        url: 'https://leetcode.com/problems/two-sum/',
        isPremium: false,
      },
      dueAt: null,
    },
    activeTrack: {
      trackId: 'leetcode-75',
      title: 'LeetCode 75',
      description: 'Focused starter track.',
      groupTitle: 'Arrays and Hashing',
      dueAt: '2026-03-01T00:00:00.000Z',
      progress: {
        completedCount: 1,
        totalCount: 2,
        percent: 50,
      },
      detail: 'Next: Two Sum',
      nextProblem: {
        id: 'leetcode:two-sum',
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'easy',
        url: 'https://leetcode.com/problems/two-sum/',
        isPremium: false,
      },
    },
    queue: {
      dailyGoal: 4,
      dueCount: 0,
      newCount: 1,
      reinforcementCount: 0,
      items: [],
    },
    settings: {
      studyMode: defaultUserSettings.studyMode,
      timing: defaultUserSettings.timing,
      memoryReview: defaultUserSettings.memoryReview,
      questionFilters: defaultUserSettings.questionFilters,
    },
    popup: {
      queuePreview: [],
    },
  }
}

function createActiveTrack(dueAt: Date | null): ActiveTrack {
  return {
    track: {
      id: 'leetcode-75',
      slug: 'leetcode-75',
      title: 'LeetCode 75',
      description: 'Focused starter track.',
      dueAt,
      isActive: true,
    },
    activeGroup: {
      id: 'leetcode-75:arrays-hashing',
      trackId: 'leetcode-75',
      title: 'Arrays and Hashing',
      position: 1,
    },
    progress: {
      completedCount: 1,
      totalCount: 2,
      percent: 50,
    },
    nextProblem: {
      id: 'leetcode:two-sum',
      source: 'leetcode',
      externalId: '1',
      slug: 'two-sum',
      title: 'Two Sum',
      difficulty: 'easy',
      url: 'https://leetcode.com/problems/two-sum/',
      isPremium: false,
      acceptanceRate: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  }
}
