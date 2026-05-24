import { describe, expect, it, beforeEach, vi } from 'vitest'

import {
  activeTrackSchema,
  queueRequestSchema,
  trackForEditResponseSchema,
  tracksClearActiveTrackRequestSchema,
  tracksCreateTrackRequestSchema,
  tracksDeleteTrackRequestSchema,
  tracksGetTrackForEditRequestSchema,
  tracksGetWorkspaceRequestSchema,
  tracksResetTrackProgressRequestSchema,
  tracksSetActiveGroupRequestSchema,
  tracksSetActiveTrackRequestSchema,
  tracksUpdateTrackRequestSchema,
  trackWorkspaceResponseSchema,
  todayQueueSchema,
} from '@/extension/messaging'
import type { PopupAppShellData } from '@/features/app-shell/api/app-shell-contracts'
import { defaultUserSettings } from '@/features/settings/domain'
import type { ActiveTrack } from '@/features/tracks/domain'
import { createSerializedPracticeDetails } from '@/testing/practice-fixtures'
import {
  createProblemForEditResponse,
  createProblemLibraryResponse,
} from '@/testing/problem-fixtures'
import {
  createTrackForEditResponse,
  createTrackWorkspaceResponse,
} from '@/testing/track-fixtures'

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
    createTrack: vi.fn(),
    clearActiveTrack: vi.fn(),
    deleteTrack: vi.fn(),
    bulkUpdateProblems: vi.fn(),
    getPracticeDetails: vi.fn(),
    getTrackForEdit: vi.fn(),
    getWorkspace: vi.fn(),
    recordActiveTrackProblemCompletion: vi.fn(),
    overrideLastReviewResult: vi.fn(),
    resetPracticeSchedule: vi.fn(),
    resetTrackProgress: vi.fn(),
    saveReviewResult: vi.fn(),
    setActiveGroup: vi.fn(),
    setPracticeSuspended: vi.fn(),
    setActiveTrack: vi.fn(),
    getSettings: vi.fn(),
    toggleStudyMode: vi.fn(),
    updateTrack: vi.fn(),
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
const extensionSender = { id: 'extension-id' }

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

vi.mock(
  '@/features/practice/server/practice-service',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/features/practice/server/practice-service')
      >()

    return {
      ...actual,
      getPracticeDetails: backgroundMocks.getPracticeDetails,
      overrideLastReviewResult: backgroundMocks.overrideLastReviewResult,
      resetPracticeSchedule: backgroundMocks.resetPracticeSchedule,
      saveReviewResult: backgroundMocks.saveReviewResult,
      setPracticeSuspended: backgroundMocks.setPracticeSuspended,
    }
  },
)

vi.mock(
  '@/features/problems/server/problems-service',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/features/problems/server/problems-service')
      >()

    return {
      ...actual,
      getProblemLibrary: backgroundMocks.getProblemLibrary,
      createProblem: backgroundMocks.createProblem,
      bulkUpdateProblems: backgroundMocks.bulkUpdateProblems,
    }
  },
)

vi.mock('@/features/tracks/server/tracks-service', () => ({
  createTrack: backgroundMocks.createTrack,
  deleteTrack: backgroundMocks.deleteTrack,
  getActiveTrack: backgroundMocks.getActiveTrack,
  getTrackForEdit: backgroundMocks.getTrackForEdit,
  getWorkspace: backgroundMocks.getWorkspace,
  recordActiveTrackProblemCompletion:
    backgroundMocks.recordActiveTrackProblemCompletion,
  resetTrackProgress: backgroundMocks.resetTrackProgress,
  setActiveGroup: backgroundMocks.setActiveGroup,
  setActiveTrack: backgroundMocks.setActiveTrack,
  clearActiveTrack: backgroundMocks.clearActiveTrack,
  updateTrack: backgroundMocks.updateTrack,
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
    backgroundMocks.createTrack.mockResolvedValue(trackForEditResponse)
    backgroundMocks.deleteTrack.mockResolvedValue(undefined)
    backgroundMocks.bulkUpdateProblems.mockResolvedValue(undefined)
    backgroundMocks.getPracticeDetails.mockResolvedValue(practiceDetails)
    backgroundMocks.getTrackForEdit.mockResolvedValue(trackForEditResponse)
    backgroundMocks.getWorkspace.mockResolvedValue(trackWorkspaceResponse)
    backgroundMocks.recordActiveTrackProblemCompletion.mockResolvedValue(false)
    backgroundMocks.resetPracticeSchedule.mockResolvedValue(practiceDetails)
    backgroundMocks.resetTrackProgress.mockResolvedValue(undefined)
    backgroundMocks.saveReviewResult.mockResolvedValue(undefined)
    backgroundMocks.setActiveGroup.mockResolvedValue(undefined)
    backgroundMocks.setPracticeSuspended.mockResolvedValue(practiceDetails)
    backgroundMocks.setActiveTrack.mockResolvedValue(undefined)
    backgroundMocks.clearActiveTrack.mockResolvedValue(undefined)
    backgroundMocks.getSettings.mockResolvedValue(defaultUserSettings)
    backgroundMocks.toggleStudyMode.mockResolvedValue(defaultUserSettings)
    backgroundMocks.updateSettings.mockResolvedValue(defaultUserSettings)
  })

  it('registers app-shell payload handling with policy and schema parsing', async () => {
    const popupData = createPopupShellData()
    backgroundMocks.getAppShellData.mockResolvedValue(popupData)

    const response = await sendRuntimeMessage('app.getShellData', {
      surface: 'popup',
    })

    expectRuntimePolicy('app.getShellData', 'popup')
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
    const dueAt = new Date('2026-03-01T00:00:00.000Z')
    backgroundMocks.getActiveTrack.mockResolvedValue(createActiveTrack(dueAt))

    const response = await sendRuntimeMessage('tracks.getActiveTrack', {
      surface: 'popup',
    })

    expectRuntimePolicy('tracks.getActiveTrack', 'popup')
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

  it('registers track workspace handling with request and response parsing', async () => {
    const request = {
      surface: 'dashboard',
      at: '2026-01-01T10:00:00.000Z',
    } as const

    const response = await sendRuntimeMessage('tracks.getWorkspace', request)

    expectRuntimePolicy('tracks.getWorkspace', 'dashboard')
    expect(backgroundMocks.getWorkspace).toHaveBeenCalledWith(
      backgroundMocks.db,
      tracksGetWorkspaceRequestSchema.parse(request),
    )
    expect(response).toEqual(trackWorkspaceResponseSchema.parse(response))

    backgroundMocks.getWorkspace.mockResolvedValueOnce({
      ...trackWorkspaceResponse,
      generatedAt: 'not-a-date',
    })
    await expect(
      sendRuntimeMessage('tracks.getWorkspace', request),
    ).rejects.toThrow()
  })

  it('registers track edit handling for create and edit requests', async () => {
    const createRequest = { surface: 'dashboard' } as const
    const editRequest = {
      surface: 'dashboard',
      trackId: 'leetcode-75',
    } as const

    const createResponse = await sendRuntimeMessage(
      'tracks.getTrackForEdit',
      createRequest,
    )
    const editResponse = await sendRuntimeMessage(
      'tracks.getTrackForEdit',
      editRequest,
    )

    expectRuntimePolicy('tracks.getTrackForEdit', 'dashboard')
    expectRuntimePolicy('tracks.getTrackForEdit', 'dashboard')
    expect(backgroundMocks.getTrackForEdit).toHaveBeenNthCalledWith(
      1,
      backgroundMocks.db,
      tracksGetTrackForEditRequestSchema.parse(createRequest),
    )
    expect(backgroundMocks.getTrackForEdit).toHaveBeenNthCalledWith(
      2,
      backgroundMocks.db,
      tracksGetTrackForEditRequestSchema.parse(editRequest),
    )
    expect(createResponse).toEqual(
      trackForEditResponseSchema.parse(createResponse),
    )
    expect(editResponse).toEqual(trackForEditResponseSchema.parse(editResponse))
  })

  it('flushes and broadcasts tracks invalidation after active selection writes', async () => {
    await expectTrackWrite({
      method: 'tracks.setActiveTrack',
      request: {
        surface: 'dashboard',
        trackId: 'leetcode-75',
      },
      schema: tracksSetActiveTrackRequestSchema,
      service: backgroundMocks.setActiveTrack,
      expectedResponse: null,
      expectedTags: ['tracks'],
    })

    await expectTrackWrite({
      method: 'tracks.setActiveGroup',
      request: {
        surface: 'dashboard',
        trackId: 'leetcode-75',
        groupId: 'leetcode-75:arrays-hashing',
      },
      schema: tracksSetActiveGroupRequestSchema,
      service: backgroundMocks.setActiveGroup,
      expectedResponse: null,
      expectedTags: ['tracks'],
    })

    await expectTrackWrite({
      method: 'tracks.clearActiveTrack',
      request: {
        surface: 'dashboard',
      },
      schema: tracksClearActiveTrackRequestSchema,
      service: backgroundMocks.clearActiveTrack,
      expectedResponse: null,
      expectedTags: ['tracks'],
    })
  })

  it('flushes and broadcasts tracks plus problems invalidation after management writes', async () => {
    await expectTrackWrite({
      method: 'tracks.createTrack',
      request: createTrackRequest(),
      schema: tracksCreateTrackRequestSchema,
      service: backgroundMocks.createTrack,
      expectedResponse: parsedTrackForEditResponse,
      expectedTags: ['tracks', 'problems'],
    })

    await expectTrackWrite({
      method: 'tracks.updateTrack',
      request: {
        ...createTrackRequest(),
        trackId: 'leetcode-75',
      },
      schema: tracksUpdateTrackRequestSchema,
      service: backgroundMocks.updateTrack,
      expectedResponse: parsedTrackForEditResponse,
      expectedTags: ['tracks', 'problems'],
    })

    await expectTrackWrite({
      method: 'tracks.deleteTrack',
      request: {
        surface: 'dashboard',
        trackId: 'leetcode-75',
      },
      schema: tracksDeleteTrackRequestSchema,
      service: backgroundMocks.deleteTrack,
      expectedResponse: null,
      expectedTags: ['tracks', 'problems'],
    })

    await expectTrackWrite({
      method: 'tracks.resetTrackProgress',
      request: {
        surface: 'dashboard',
        trackId: 'leetcode-75',
      },
      schema: tracksResetTrackProgressRequestSchema,
      service: backgroundMocks.resetTrackProgress,
      expectedResponse: null,
      expectedTags: ['tracks', 'problems'],
    })
  })

  it('broadcasts cross-surface invalidation after settings writes', async () => {
    const updatedSettings = {
      ...defaultUserSettings,
      assessment: {
        ...defaultUserSettings.assessment,
        strictTiming: true,
      },
    }
    backgroundMocks.updateSettings.mockResolvedValue(updatedSettings)

    const response = await sendRuntimeMessage('settings.updateSettings', {
      surface: 'popup',
      patch: { assessment: { strictTiming: true } },
    })

    expectRuntimePolicy('settings.updateSettings', 'popup')
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
    const toggleResponse = await sendRuntimeMessage(
      'settings.toggleStudyMode',
      {
        surface: 'popup',
      },
    )

    expectRuntimePolicy('settings.toggleStudyMode', 'popup')
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
    const response = await sendRuntimeMessage('settings.getSettings', {
      surface: 'dashboard',
    })

    expectRuntimePolicy('settings.getSettings', 'dashboard')
    expect(backgroundMocks.getSettings).toHaveBeenCalledWith(backgroundMocks.db)
    expect(response).toBe(defaultUserSettings)
  })

  it('rejects invalid settings patches before writing or broadcasting', () => {
    expect(() =>
      sendRuntimeMessage('settings.updateSettings', {
        surface: 'dashboard',
        patch: { practice: { dailyGoal: 0 } },
      }),
    ).toThrow()
    expect(backgroundMocks.updateSettings).not.toHaveBeenCalled()
    expect(backgroundMocks.flushDbSnapshot).not.toHaveBeenCalled()
    expect(backgroundMocks.broadcastCacheInvalidation).not.toHaveBeenCalled()
  })

  it('reads the Library without flushing or broadcasting invalidation', async () => {
    const response = await sendRuntimeMessage('problems.getLibrary', {
      surface: 'dashboard',
      at: '2026-01-01T10:00:00.000Z',
    })

    expectRuntimePolicy('problems.getLibrary', 'dashboard')
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
    const request = binarySearchCreateRequest()
    const response = await sendRuntimeMessage('problems.createProblem', request)

    expectRuntimePolicy('problems.createProblem', 'dashboard')
    expect(backgroundMocks.createProblem).toHaveBeenCalledWith(
      backgroundMocks.db,
      request,
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
    expect(() =>
      sendRuntimeMessage('problems.bulkUpdateProblems', {
        surface: 'dashboard',
        problemSlugs: ['two-sum'],
        set: {},
      }),
    ).toThrow()
    expect(backgroundMocks.bulkUpdateProblems).not.toHaveBeenCalled()
    expect(backgroundMocks.flushDbSnapshot).not.toHaveBeenCalled()
    expect(backgroundMocks.broadcastCacheInvalidation).not.toHaveBeenCalled()
  })

  it('includes problem invalidation for practice state that changes Library rows', async () => {
    const response = await sendRuntimeMessage('practice.setSuspended', {
      surface: 'dashboard',
      problemSlug: 'two-sum',
      suspended: true,
    })

    expectRuntimePolicy('practice.setSuspended', 'dashboard')
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
      tags: ['practice', 'problems', 'queue', 'app-shell', 'tracks'],
    })
    expectFlushBeforeBroadcast()
    expect(response).toMatchObject({
      problemSlug: 'two-sum',
      summary: {
        suspended: false,
      },
    })
  })

  it('records active-track progress only for good and easy saved reviews', async () => {
    await sendRuntimeMessage('practice.saveReviewResult', {
      surface: 'dashboard',
      problemSlug: 'two-sum',
      rating: 'hard',
      reviewedAt: '2026-01-02T00:00:00.000Z',
    })

    expect(
      backgroundMocks.recordActiveTrackProblemCompletion,
    ).not.toHaveBeenCalled()
    expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledWith({
      problemSlug: 'two-sum',
      reason: 'practice-updated',
      source: 'dashboard',
      tags: ['practice', 'problems', 'queue', 'app-shell', 'tracks'],
    })

    vi.clearAllMocks()
    backgroundMocks.getAppDb.mockResolvedValue({ db: backgroundMocks.db })
    backgroundMocks.broadcastCacheInvalidation.mockResolvedValue(null)
    backgroundMocks.flushDbSnapshot.mockResolvedValue(undefined)
    backgroundMocks.getSettings.mockResolvedValue(defaultUserSettings)
    backgroundMocks.getPracticeDetails.mockResolvedValue(practiceDetails)
    backgroundMocks.recordActiveTrackProblemCompletion.mockResolvedValueOnce(
      true,
    )

    await sendRuntimeMessage('practice.saveReviewResult', {
      surface: 'dashboard',
      problemSlug: 'two-sum',
      rating: 'good',
      reviewedAt: '2026-01-02T00:00:00.000Z',
    })

    expect(
      backgroundMocks.recordActiveTrackProblemCompletion,
    ).toHaveBeenCalledWith(backgroundMocks.db, {
      problemSlug: 'two-sum',
      rating: 'good',
      completedAt: new Date('2026-01-02T00:00:00.000Z'),
    })
    expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledWith({
      problemSlug: 'two-sum',
      reason: 'practice-updated',
      source: 'dashboard',
      tags: ['practice', 'problems', 'queue', 'app-shell', 'tracks'],
    })
  })

  it('records active-track progress for easy saved reviews', async () => {
    resetRuntimeMutationMocks()
    backgroundMocks.recordActiveTrackProblemCompletion.mockResolvedValueOnce(
      true,
    )

    await sendRuntimeMessage('practice.saveReviewResult', {
      surface: 'dashboard',
      problemSlug: 'two-sum',
      rating: 'easy',
      reviewedAt: '2026-01-03T00:00:00.000Z',
    })

    expect(
      backgroundMocks.recordActiveTrackProblemCompletion,
    ).toHaveBeenCalledWith(backgroundMocks.db, {
      problemSlug: 'two-sum',
      rating: 'easy',
      completedAt: new Date('2026-01-03T00:00:00.000Z'),
    })
    expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledWith({
      problemSlug: 'two-sum',
      reason: 'practice-updated',
      source: 'dashboard',
      tags: ['practice', 'problems', 'queue', 'app-shell', 'tracks'],
    })
  })

  it('does not record active-track progress for free-practice saved reviews', async () => {
    resetRuntimeMutationMocks()
    backgroundMocks.getSettings.mockResolvedValueOnce({
      ...defaultUserSettings,
      practice: {
        ...defaultUserSettings.practice,
        mode: 'freePractice',
      },
    })

    await sendRuntimeMessage('practice.saveReviewResult', {
      surface: 'dashboard',
      problemSlug: 'two-sum',
      rating: 'good',
      reviewedAt: '2026-01-05T00:00:00.000Z',
    })

    expect(
      backgroundMocks.recordActiveTrackProblemCompletion,
    ).not.toHaveBeenCalled()
    expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledWith({
      problemSlug: 'two-sum',
      reason: 'practice-updated',
      source: 'dashboard',
      tags: ['practice', 'problems', 'queue', 'app-shell', 'tracks'],
    })
  })

  it('invalidates tracks when an eligible saved review records no new track completion', async () => {
    resetRuntimeMutationMocks()
    backgroundMocks.recordActiveTrackProblemCompletion.mockResolvedValueOnce(
      false,
    )

    await sendRuntimeMessage('practice.saveReviewResult', {
      surface: 'dashboard',
      problemSlug: 'two-sum',
      rating: 'good',
      reviewedAt: '2026-01-04T00:00:00.000Z',
    })

    expect(
      backgroundMocks.recordActiveTrackProblemCompletion,
    ).toHaveBeenCalledWith(backgroundMocks.db, {
      problemSlug: 'two-sum',
      rating: 'good',
      completedAt: new Date('2026-01-04T00:00:00.000Z'),
    })
    expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledWith({
      problemSlug: 'two-sum',
      reason: 'practice-updated',
      source: 'dashboard',
      tags: ['practice', 'problems', 'queue', 'app-shell', 'tracks'],
    })
  })

  it('invalidates tracks after overriding a saved review result', async () => {
    resetRuntimeMutationMocks()
    backgroundMocks.overrideLastReviewResult.mockResolvedValue(undefined)

    await sendRuntimeMessage('practice.overrideLastReviewResult', {
      surface: 'dashboard',
      problemSlug: 'two-sum',
      rating: 'hard',
    })

    expect(backgroundMocks.overrideLastReviewResult).toHaveBeenCalledWith(
      backgroundMocks.db,
      expect.objectContaining({
        problemSlug: 'two-sum',
        rating: 'hard',
      }),
    )
    expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledWith({
      problemSlug: 'two-sum',
      reason: 'practice-updated',
      source: 'dashboard',
      tags: ['practice', 'problems', 'queue', 'app-shell', 'tracks'],
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

function sendRuntimeMessage(
  method: string,
  data: unknown,
  sender: unknown = extensionSender,
) {
  return readRegisteredHandler(method)({ data, sender })
}

function expectRuntimePolicy(
  method: string,
  surface: 'popup' | 'dashboard' | 'content-script',
  sender: unknown = extensionSender,
) {
  expect(
    backgroundMocks.assertCanSenderCallExtensionMethod,
  ).toHaveBeenCalledWith(method, surface, sender)
}

function resetRuntimeMutationMocks() {
  vi.clearAllMocks()
  backgroundMocks.getAppDb.mockResolvedValue({ db: backgroundMocks.db })
  backgroundMocks.broadcastCacheInvalidation.mockResolvedValue(null)
  backgroundMocks.flushDbSnapshot.mockResolvedValue(undefined)
  backgroundMocks.getSettings.mockResolvedValue(defaultUserSettings)
  backgroundMocks.getPracticeDetails.mockResolvedValue(practiceDetails)
  backgroundMocks.saveReviewResult.mockResolvedValue(undefined)
}

async function expectTrackWrite<TRequest>(input: {
  method: string
  request: TRequest
  schema: { parse: (value: unknown) => unknown }
  service: ReturnType<typeof vi.fn>
  expectedResponse: unknown
  expectedTags: readonly string[]
}) {
  vi.clearAllMocks()
  backgroundMocks.getAppDb.mockResolvedValue({ db: backgroundMocks.db })
  backgroundMocks.broadcastCacheInvalidation.mockResolvedValue(null)
  backgroundMocks.flushDbSnapshot.mockResolvedValue(undefined)
  input.service.mockResolvedValue(input.expectedResponse ?? undefined)

  const response = await sendRuntimeMessage(input.method, input.request)

  expectRuntimePolicy(input.method, 'dashboard')
  expect(input.service).toHaveBeenCalledWith(
    backgroundMocks.db,
    input.schema.parse(input.request),
  )
  expect(backgroundMocks.flushDbSnapshot).toHaveBeenCalledTimes(1)
  expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledWith({
    reason: 'tracks-updated',
    source: 'dashboard',
    tags: input.expectedTags,
  })
  expectFlushBeforeBroadcast()
  expect(response).toEqual(input.expectedResponse)
}

function binarySearchCreateRequest() {
  return {
    surface: 'dashboard',
    slugOrUrl: 'binary-search',
    title: 'Binary Search',
    difficulty: 'easy',
    isPremium: false,
    topicLabels: [],
    companyLabels: [],
  } as const
}

function createTrackRequest() {
  return {
    surface: 'dashboard',
    title: 'Interview Track',
    description: null,
    dueAt: null,
    groups: [{ title: 'Arrays', problemSlugs: ['two-sum'] }],
    setActive: true,
  } as const
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
      state: 'ready',
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
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  }
}

const problemForEditResponse = createProblemForEditResponse()
const problemLibraryResponse = createProblemLibraryResponse()
const practiceDetails = createSerializedPracticeDetails()
const trackForEditResponse = createTrackForEditResponse()
const parsedTrackForEditResponse =
  trackForEditResponseSchema.parse(trackForEditResponse)
const trackWorkspaceResponse = createTrackWorkspaceResponse()
