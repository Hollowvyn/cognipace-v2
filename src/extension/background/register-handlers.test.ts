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
    flushDbSnapshot: vi.fn(),
    getActiveTrack: vi.fn(),
    getAppDb: vi.fn(),
    getAppShellData: vi.fn(),
    getProblemLibrary: vi.fn(),
    createProblem: vi.fn(),
    bulkUpdateProblems: vi.fn(),
    setPracticeSuspended: vi.fn(),
    getSettings: vi.fn(),
    toggleStudyMode: vi.fn(),
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

vi.mock('@/features/practice/server/practice-service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/practice/server/practice-service')>()

  return {
    ...actual,
    setPracticeSuspended: backgroundMocks.setPracticeSuspended,
  }
})

vi.mock('@/features/problems/server/problems-service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/problems/server/problems-service')>()

  return {
    ...actual,
    getProblemLibrary: backgroundMocks.getProblemLibrary,
    createProblem: backgroundMocks.createProblem,
    bulkUpdateProblems: backgroundMocks.bulkUpdateProblems,
  }
})

vi.mock('@/features/tracks/server/tracks-service', () => ({
  getActiveTrack: backgroundMocks.getActiveTrack,
}))

vi.mock('@/features/settings/server/settings-service', () => ({
  getSettings: backgroundMocks.getSettings,
  toggleStudyMode: backgroundMocks.toggleStudyMode,
  updateSettings: backgroundMocks.updateSettings,
}))

vi.mock('@/platform/db', () => ({
  flushDbSnapshot: backgroundMocks.flushDbSnapshot,
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
    backgroundMocks.flushDbSnapshot.mockResolvedValue(undefined)
    backgroundMocks.getAppDb.mockResolvedValue({ db: backgroundMocks.db })
    backgroundMocks.getProblemLibrary.mockResolvedValue(problemLibraryResponse)
    backgroundMocks.createProblem.mockResolvedValue(problemForEditResponse)
    backgroundMocks.bulkUpdateProblems.mockResolvedValue({
      updatedProblemSlugs: ['binary-search'],
      missingProblemSlugs: [],
    })
    backgroundMocks.setPracticeSuspended.mockResolvedValue(practiceDetails)
    backgroundMocks.getSettings.mockResolvedValue(defaultUserSettings)
    backgroundMocks.toggleStudyMode.mockResolvedValue(defaultUserSettings)
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

  it('broadcasts cross-surface invalidation after settings writes', async () => {
    const sender = { id: 'extension-id' }
    const updatedSettings = {
      ...defaultUserSettings,
      assessment: {
        ...defaultUserSettings.assessment,
        strictTiming: true,
      },
    }
    backgroundMocks.updateSettings.mockResolvedValue(updatedSettings)

    const handler = readRegisteredHandler('settings.updateSettings')
    const response = await handler({
      data: {
        surface: 'popup',
        patch: { assessment: { strictTiming: true } },
      },
      sender,
    })

    expect(
      backgroundMocks.assertCanSenderCallExtensionMethod,
    ).toHaveBeenCalledWith('settings.updateSettings', 'popup', sender)
    expect(backgroundMocks.updateSettings).toHaveBeenCalledWith(
      backgroundMocks.db,
      { assessment: { strictTiming: true } },
    )
    expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledWith({
      reason: 'settings-updated',
      source: 'popup',
      tags: ['settings'],
    })
    expectFlushBeforeBroadcast()
    expect(response).toBe(updatedSettings)

    vi.clearAllMocks()
    const toggleHandler = readRegisteredHandler('settings.toggleStudyMode')
    const toggleResponse = await toggleHandler({
      data: {
        surface: 'popup',
      },
      sender,
    })

    expect(
      backgroundMocks.assertCanSenderCallExtensionMethod,
    ).toHaveBeenCalledWith('settings.toggleStudyMode', 'popup', sender)
    expect(backgroundMocks.toggleStudyMode).toHaveBeenCalledWith(
      backgroundMocks.db,
    )
    expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledWith({
      reason: 'settings-updated',
      source: 'popup',
      tags: ['settings'],
    })
    expectFlushBeforeBroadcast()
    expect(toggleResponse).toBeNull()
  })

  it('reads settings through the runtime policy and DB boundary', async () => {
    const sender = { id: 'extension-id' }
    const handler = readRegisteredHandler('settings.getSettings')
    const response = await handler({
      data: { surface: 'dashboard' },
      sender,
    })

    expect(
      backgroundMocks.assertCanSenderCallExtensionMethod,
    ).toHaveBeenCalledWith('settings.getSettings', 'dashboard', sender)
    expect(backgroundMocks.getSettings).toHaveBeenCalledWith(backgroundMocks.db)
    expect(response).toBe(defaultUserSettings)
  })

  it('rejects invalid settings patches before writing or broadcasting', () => {
    const handler = readRegisteredHandler('settings.updateSettings')

    expect(() =>
      handler({
        data: {
          surface: 'dashboard',
          patch: { practice: { dailyGoal: 0 } },
        },
        sender: { id: 'extension-id' },
      }),
    ).toThrow()
    expect(backgroundMocks.updateSettings).not.toHaveBeenCalled()
    expect(backgroundMocks.flushDbSnapshot).not.toHaveBeenCalled()
    expect(backgroundMocks.broadcastCacheInvalidation).not.toHaveBeenCalled()
  })

  it('reads the Library without flushing or broadcasting invalidation', async () => {
    const sender = { id: 'extension-id' }
    const handler = readRegisteredHandler('problems.getLibrary')
    const response = await handler({
      data: {
        surface: 'dashboard',
        at: '2026-01-01T10:00:00.000Z',
      },
      sender,
    })

    expect(
      backgroundMocks.assertCanSenderCallExtensionMethod,
    ).toHaveBeenCalledWith('problems.getLibrary', 'dashboard', sender)
    expect(backgroundMocks.getProblemLibrary).toHaveBeenCalledWith(
      backgroundMocks.db,
      {
        surface: 'dashboard',
        at: '2026-01-01T10:00:00.000Z',
      },
    )
    expect(response).toEqual(problemLibraryResponse)
    expect(backgroundMocks.flushDbSnapshot).not.toHaveBeenCalled()
    expect(backgroundMocks.broadcastCacheInvalidation).not.toHaveBeenCalled()
  })

  it('flushes and broadcasts problem invalidation after create writes', async () => {
    const sender = { id: 'extension-id' }
    const handler = readRegisteredHandler('problems.createProblem')
    const response = await handler({
      data: {
        surface: 'dashboard',
        slugOrUrl: 'binary-search',
        title: 'Binary Search',
        difficulty: 'easy',
        isPremium: false,
        topicLabels: [],
        companyLabels: [],
      },
      sender,
    })

    expect(
      backgroundMocks.assertCanSenderCallExtensionMethod,
    ).toHaveBeenCalledWith('problems.createProblem', 'dashboard', sender)
    expect(backgroundMocks.createProblem).toHaveBeenCalledWith(
      backgroundMocks.db,
      {
        surface: 'dashboard',
        slugOrUrl: 'binary-search',
        title: 'Binary Search',
        difficulty: 'easy',
        isPremium: false,
        topicLabels: [],
        companyLabels: [],
      },
    )
    expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledWith({
      problemSlug: 'binary-search',
      reason: 'problem-catalog-updated',
      source: 'dashboard',
      tags: ['problems'],
    })
    expectFlushBeforeBroadcast()
    expect(response).toEqual(problemForEditResponse)
  })

  it('rejects invalid problem writes before mutation side effects', () => {
    const handler = readRegisteredHandler('problems.bulkUpdateProblems')

    expect(() =>
      handler({
        data: {
          surface: 'dashboard',
          problemSlugs: ['two-sum'],
          set: {},
        },
        sender: { id: 'extension-id' },
      }),
    ).toThrow()
    expect(backgroundMocks.bulkUpdateProblems).not.toHaveBeenCalled()
    expect(backgroundMocks.flushDbSnapshot).not.toHaveBeenCalled()
    expect(backgroundMocks.broadcastCacheInvalidation).not.toHaveBeenCalled()
  })

  it('includes problem invalidation for practice state that changes Library rows', async () => {
    const sender = { id: 'extension-id' }
    const handler = readRegisteredHandler('practice.setSuspended')
    const response = await handler({
      data: {
        surface: 'dashboard',
        problemSlug: 'two-sum',
        suspended: true,
      },
      sender,
    })

    expect(
      backgroundMocks.assertCanSenderCallExtensionMethod,
    ).toHaveBeenCalledWith('practice.setSuspended', 'dashboard', sender)
    expect(backgroundMocks.setPracticeSuspended).toHaveBeenCalledWith(
      backgroundMocks.db,
      {
        problemSlug: 'two-sum',
        suspended: true,
      },
    )
    expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledWith({
      problemSlug: 'two-sum',
      reason: 'practice-updated',
      source: 'dashboard',
      tags: ['practice', 'problems', 'queue', 'app-shell'],
    })
    expectFlushBeforeBroadcast()
    expect(response).toMatchObject({
      problemSlug: 'two-sum',
      summary: {
        suspended: false,
      },
    })
  })
})

describe('background handler serializers', () => {
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

function expectFlushBeforeBroadcast() {
  expect(backgroundMocks.flushDbSnapshot).toHaveBeenCalledTimes(1)
  expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledTimes(1)

  const flushOrder =
    backgroundMocks.flushDbSnapshot.mock.invocationCallOrder[0] ?? 0
  const broadcastOrder =
    backgroundMocks.broadcastCacheInvalidation.mock.invocationCallOrder[0] ?? 0

  expect(flushOrder).toBeGreaterThan(0)
  expect(flushOrder).toBeLessThan(broadcastOrder)
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
        problemSlug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'easy',
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
        problemSlug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'easy',
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
      practice: defaultUserSettings.practice,
      review: defaultUserSettings.review,
      assessment: defaultUserSettings.assessment,
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
      slug: 'two-sum',
      title: 'Two Sum',
      difficulty: 'easy',
      isPremium: false,
      isUserCreated: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  }
}

const problemForEditResponse = {
  problem: {
    slug: 'binary-search',
    title: 'Binary Search',
    difficulty: 'easy',
    isPremium: false,
    isUserCreated: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  topics: [],
  companies: [],
  trackMemberships: [],
  options: {
    topics: [],
    companies: [],
    trackGroups: [],
  },
} as const

const problemLibraryResponse = {
  generatedAt: '2026-01-01T10:00:00.000Z',
  summary: {
    totalCount: 1,
    filteredCount: 1,
    dueCount: 0,
    suspendedCount: 0,
  },
  options: {
    topics: [],
    companies: [],
    trackGroups: [],
  },
  rows: [
    {
      problem: problemForEditResponse.problem,
      status: 'not-started',
      summary: {
        phase: 'new',
        nextReviewAt: null,
        lastReviewedAt: null,
        reviewCount: 0,
        lapses: 0,
        difficulty: null,
        stability: null,
        scheduledDays: null,
        suspended: false,
        isStarted: false,
        isDue: false,
        isOverdue: false,
        overdueDays: 0,
        retrievability: null,
      },
      nextReviewAt: null,
      lastReviewedAt: null,
      lastSolvedAt: null,
      topics: [],
      companies: [],
      trackMemberships: [],
    },
  ],
} as const

const practiceDetails = {
  problemSlug: 'two-sum',
  cardId: 'two-sum:default',
  practice: null,
  card: null,
  summary: {
    phase: 'new',
    nextReviewAt: null,
    lastReviewedAt: null,
    reviewCount: 0,
    lapses: 0,
    difficulty: null,
    stability: null,
    scheduledDays: null,
    suspended: false,
    isStarted: false,
    isDue: false,
    isOverdue: false,
    overdueDays: 0,
    retrievability: null,
  },
  currentLog: {
    interviewPattern: null,
    timeComplexity: null,
    spaceComplexity: null,
    languages: null,
    notes: null,
  },
  recentAttempts: [],
  latestAttempt: null,
  canOverrideLatestReview: false,
} as const
