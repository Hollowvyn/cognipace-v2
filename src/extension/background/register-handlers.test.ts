import { describe, expect, it, beforeEach, vi } from 'vitest'

import {
  activeTrackSchema,
  backupFileSchema,
  backupSummarySchema,
  problemsGetLibraryRequestSchema,
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
import {
  backupSchemaVersion,
  createBackupSummary,
} from '@/features/backup/api/backup-contracts'
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
    backupExportFullBackup: vi.fn(),
    backupResetLocalData: vi.fn(),
    backupRestoreFullBackup: vi.fn(),
    backupValidateFullBackup: vi.fn(),
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
    cycleThemeMode: vi.fn(),
    toggleStudyMode: vi.fn(),
    tabsCreate: vi.fn(),
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

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      getURL: (path: string) => `chrome-extension://extension-id${path}`,
    },
    tabs: {
      create: backgroundMocks.tabsCreate,
    },
  },
}))

vi.mock('@/features/app-shell/server/app-shell-service', () => ({
  getAppShellData: backgroundMocks.getAppShellData,
}))

vi.mock('@/features/backup/server/backup-service', () => ({
  exportFullBackup: backgroundMocks.backupExportFullBackup,
  resetLocalData: backgroundMocks.backupResetLocalData,
  restoreFullBackup: backgroundMocks.backupRestoreFullBackup,
  validateFullBackup: backgroundMocks.backupValidateFullBackup,
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
  cycleThemeMode: backgroundMocks.cycleThemeMode,
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
    backgroundMocks.backupExportFullBackup.mockResolvedValue(validBackup)
    backgroundMocks.backupResetLocalData.mockResolvedValue(null)
    backgroundMocks.backupRestoreFullBackup.mockResolvedValue(
      validBackupSummary,
    )
    backgroundMocks.backupValidateFullBackup.mockReturnValue(validBackupSummary)
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
    backgroundMocks.cycleThemeMode.mockResolvedValue(defaultUserSettings)
    backgroundMocks.toggleStudyMode.mockResolvedValue(defaultUserSettings)
    backgroundMocks.tabsCreate.mockResolvedValue({})
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

  it('opens dashboard pages from content scripts through the background tab API', async () => {
    const contentScriptSender = {
      tab: { id: 7 },
      url: 'https://leetcode.com/problems/two-sum/',
    }

    const response = await sendRuntimeMessage(
      'app.openDashboard',
      {
        surface: 'content-script',
        route: 'settings',
      },
      contentScriptSender,
    )

    expectRuntimePolicy(
      'app.openDashboard',
      'content-script',
      contentScriptSender,
    )
    expect(backgroundMocks.tabsCreate).toHaveBeenCalledWith({
      url: 'chrome-extension://extension-id/dashboard.html#/settings',
    })
    expect(response).toBeNull()
    expect(backgroundMocks.getAppDb).not.toHaveBeenCalled()
    expect(backgroundMocks.flushDbSnapshot).not.toHaveBeenCalled()
    expect(backgroundMocks.broadcastCacheInvalidation).not.toHaveBeenCalled()
  })

  it.each([
    [
      'reads and serializes active-track data',
      'tracks.getActiveTrack',
      'popup',
      () => ({ surface: 'popup' }) as const,
      backgroundMocks.getActiveTrack,
      () => [backgroundMocks.db],
      (response) => {
        expect(response).toMatchObject({
          track: { id: 'leetcode-75', dueAt: '2026-03-01T00:00:00.000Z' },
          activeGroup: { title: 'Arrays and Hashing' },
          progress: { completedCount: 1, totalCount: 2, percent: 50 },
          nextProblem: { slug: 'two-sum' },
        })
      },
      {
        arrange: () =>
          backgroundMocks.getActiveTrack.mockResolvedValue(
            createActiveTrack(new Date('2026-03-01T00:00:00.000Z')),
          ),
      },
    ],
    [
      'reads track workspace with request and response parsing',
      'tracks.getWorkspace',
      'dashboard',
      () => ({ surface: 'dashboard', at: '2026-01-01T10:00:00.000Z' }) as const,
      backgroundMocks.getWorkspace,
      (request) => [
        backgroundMocks.db,
        tracksGetWorkspaceRequestSchema.parse(request),
      ],
      (response) =>
        expect(response).toEqual(trackWorkspaceResponseSchema.parse(response)),
      {
        invalidServiceResponse: () => ({
          ...trackWorkspaceResponse,
          generatedAt: 'not-a-date',
        }),
      },
    ],
    [
      'reads track edit data for existing tracks',
      'tracks.getTrackForEdit',
      'dashboard',
      () => ({ surface: 'dashboard', trackId: 'leetcode-75' }) as const,
      backgroundMocks.getTrackForEdit,
      (request) => [
        backgroundMocks.db,
        tracksGetTrackForEditRequestSchema.parse(request),
      ],
      (response) =>
        expect(response).toEqual(trackForEditResponseSchema.parse(response)),
    ],
    [
      'reads settings through the runtime DB boundary',
      'settings.getSettings',
      'dashboard',
      () => ({ surface: 'dashboard' }) as const,
      backgroundMocks.getSettings,
      () => [backgroundMocks.db],
      (response) => expect(response).toBe(defaultUserSettings),
    ],
    [
      'reads the Library through request and response parsing',
      'problems.getLibrary',
      'dashboard',
      () => ({ surface: 'dashboard', at: '2026-01-01T10:00:00.000Z' }) as const,
      backgroundMocks.getProblemLibrary,
      (request) => [
        backgroundMocks.db,
        problemsGetLibraryRequestSchema.parse(request),
      ],
      (response) => expect(response).toEqual(problemLibraryResponse),
    ],
    [
      'exports backups through dashboard policy',
      'backup.exportFullBackup',
      'dashboard',
      () => ({ surface: 'dashboard' }) as const,
      backgroundMocks.backupExportFullBackup,
      () => [backgroundMocks.db],
      (response) => {
        expect(response).toEqual(validBackup)
      },
    ],
    [
      'validates backup payloads without opening the DB',
      'backup.validateFullBackup',
      'dashboard',
      () => ({ surface: 'dashboard', backup: validBackup }) as const,
      backgroundMocks.backupValidateFullBackup,
      (request) => [(request as { backup: unknown }).backup],
      (response) =>
        expect(backupSummarySchema.parse(response).counts.problems).toBe(
          validBackupSummary.counts.problems,
        ),
      { usesDb: false },
    ],
  ] satisfies ReadonlyArray<ReadOnlyHandlerCase>)(
    '%s',
    async (
      _name,
      method,
      surface,
      createRequest,
      service,
      expectedServiceArgs,
      assertResponse,
      options,
    ) => {
      const request = createRequest()
      options?.arrange?.()

      const response = await sendRuntimeMessage(method, request)

      expectRuntimePolicy(method, surface)
      if (options?.usesDb === false) {
        expect(backgroundMocks.getAppDb).not.toHaveBeenCalled()
      }
      expect(service).toHaveBeenCalledWith(...expectedServiceArgs(request))
      await assertResponse(response)
      expectNoMutationSideEffects()

      if (!options?.invalidServiceResponse) {
        return
      }

      vi.clearAllMocks()
      backgroundMocks.getAppDb.mockResolvedValue({ db: backgroundMocks.db })
      service.mockResolvedValueOnce(options.invalidServiceResponse())

      await expect(sendRuntimeMessage(method, request)).rejects.toThrow()
      expectNoMutationSideEffects()
    },
  )

  it.each([
    [
      'tracks.setActiveTrack active selection write',
      'tracks.setActiveTrack',
      () => ({ surface: 'dashboard', trackId: 'leetcode-75' }) as const,
      tracksSetActiveTrackRequestSchema,
      backgroundMocks.setActiveTrack,
      () => null,
      ['tracks'],
    ],
    [
      'tracks.setActiveGroup active session write',
      'tracks.setActiveGroup',
      () =>
        ({
          surface: 'dashboard',
          trackId: 'leetcode-75',
          groupId: 'leetcode-75:arrays-hashing',
        }) as const,
      tracksSetActiveGroupRequestSchema,
      backgroundMocks.setActiveGroup,
      () => null,
      ['tracks'],
    ],
    [
      'tracks.clearActiveTrack active session write',
      'tracks.clearActiveTrack',
      () => ({ surface: 'dashboard' }) as const,
      tracksClearActiveTrackRequestSchema,
      backgroundMocks.clearActiveTrack,
      () => null,
      ['tracks'],
    ],
    [
      'tracks.createTrack management write',
      'tracks.createTrack',
      createTrackRequest,
      tracksCreateTrackRequestSchema,
      backgroundMocks.createTrack,
      () => parsedTrackForEditResponse,
      ['tracks', 'problems'],
    ],
    [
      'tracks.updateTrack management write',
      'tracks.updateTrack',
      () => ({ ...createTrackRequest(), trackId: 'leetcode-75' }) as const,
      tracksUpdateTrackRequestSchema,
      backgroundMocks.updateTrack,
      () => parsedTrackForEditResponse,
      ['tracks', 'problems'],
    ],
    [
      'tracks.deleteTrack management write',
      'tracks.deleteTrack',
      () => ({ surface: 'dashboard', trackId: 'leetcode-75' }) as const,
      tracksDeleteTrackRequestSchema,
      backgroundMocks.deleteTrack,
      () => null,
      ['tracks', 'problems'],
    ],
    [
      'tracks.resetTrackProgress management write',
      'tracks.resetTrackProgress',
      () => ({ surface: 'dashboard', trackId: 'leetcode-75' }) as const,
      tracksResetTrackProgressRequestSchema,
      backgroundMocks.resetTrackProgress,
      () => null,
      ['tracks', 'problems'],
    ],
  ] satisfies ReadonlyArray<TrackWriteHandlerCase>)(
    'flushes and broadcasts invalidation for %s',
    async (
      _name,
      method,
      createRequest,
      schema,
      service,
      expectedResponse,
      expectedTags,
    ) => {
      await expectTrackWrite({
        method,
        request: createRequest(),
        schema,
        service,
        expectedResponse: expectedResponse(),
        expectedTags,
      })
    },
  )

  it.each([
    [
      'settings.updateSettings',
      () =>
        ({
          surface: 'popup',
          patch: { assessment: { strictTiming: true } },
        }) as const,
      backgroundMocks.updateSettings,
      () => [{ assessment: { strictTiming: true } }],
      () => ({
        ...defaultUserSettings,
        assessment: {
          ...defaultUserSettings.assessment,
          strictTiming: true,
        },
      }),
    ],
    [
      'settings.toggleStudyMode',
      () => ({ surface: 'popup' }) as const,
      backgroundMocks.toggleStudyMode,
      () => [],
      () => null,
    ],
    [
      'settings.cycleThemeMode',
      () => ({ surface: 'dashboard' }) as const,
      backgroundMocks.cycleThemeMode,
      () => [],
      () => null,
    ],
  ] satisfies ReadonlyArray<SettingsWriteHandlerCase>)(
    'broadcasts cross-surface invalidation after %s',
    async (
      method,
      createRequest,
      service,
      expectedServiceArgs,
      expectedResponse,
    ) => {
      const request = createRequest()
      const serviceResponse = expectedResponse() ?? defaultUserSettings
      service.mockResolvedValue(serviceResponse)

      const response = await sendRuntimeMessage(method, request)

      expectRuntimePolicy(method, request.surface)
      expect(service).toHaveBeenCalledWith(
        backgroundMocks.db,
        ...expectedServiceArgs(),
      )
      expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledWith({
        reason: 'settings-updated',
        source: request.surface,
        tags: ['settings'],
      })
      expectFlushBeforeBroadcast()
      expect(response).toEqual(expectedResponse())
    },
  )

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

  it('passes backup payloads to service-owned validation before app and version rejection', async () => {
    const mismatchedBackup = {
      ...validBackup,
      app: 'other-app',
      schemaVersion: backupSchemaVersion + 1,
    }

    const response = await sendRuntimeMessage('backup.validateFullBackup', {
      surface: 'dashboard',
      backup: mismatchedBackup,
    })

    expectRuntimePolicy('backup.validateFullBackup', 'dashboard')
    expect(backgroundMocks.backupValidateFullBackup).toHaveBeenCalledWith(
      mismatchedBackup,
    )
    expect(response).toEqual(validBackupSummary)
  })

  it.each([
    [
      'backup.restoreFullBackup',
      () => ({ surface: 'dashboard', backup: validBackup }) as const,
      backgroundMocks.backupRestoreFullBackup,
      () => [validBackup],
      validBackupSummary,
    ],
    [
      'backup.resetLocalData',
      () => ({ surface: 'dashboard' }) as const,
      backgroundMocks.backupResetLocalData,
      () => [],
      null,
    ],
  ] satisfies ReadonlyArray<BackupWriteHandlerCase>)(
    'registers %s handling with snapshot flush and broad invalidation',
    async (method, createRequest, service, expectedServiceArgs, expected) => {
      const response = await sendRuntimeMessage(method, createRequest())

      expectRuntimePolicy(method, 'dashboard')
      expect(service).toHaveBeenCalledWith(
        backgroundMocks.db,
        ...expectedServiceArgs(),
      )
      expect(response).toEqual(expected)
      expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledWith({
        reason: 'problem-catalog-updated',
        source: 'dashboard',
        tags: [
          'settings',
          'problems',
          'practice',
          'queue',
          'tracks',
          'app-shell',
        ],
      })
      expectFlushBeforeBroadcast()
    },
  )

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

  it.each([
    [
      'practice.setSuspended',
      () =>
        ({
          surface: 'dashboard',
          problemSlug: 'two-sum',
          suspended: true,
        }) as const,
      backgroundMocks.setPracticeSuspended,
      () => [{ problemSlug: 'two-sum', suspended: true }],
      (response) =>
        expect(response).toMatchObject({
          problemSlug: 'two-sum',
          isSuspended: false,
        }),
    ],
    [
      'practice.overrideLastReviewResult',
      () =>
        ({
          surface: 'dashboard',
          problemSlug: 'two-sum',
          rating: 'hard',
        }) as const,
      backgroundMocks.overrideLastReviewResult,
      () => [
        expect.objectContaining({
          problemSlug: 'two-sum',
          rating: 'hard',
        }),
      ],
      () => undefined,
    ],
  ] satisfies ReadonlyArray<PracticeMutationHandlerCase>)(
    'flushes and broadcasts practice invalidation for %s',
    async (
      method,
      createRequest,
      service,
      expectedServiceArgs,
      assertResponse,
    ) => {
      const response = await sendRuntimeMessage(method, createRequest())

      expectRuntimePolicy(method, 'dashboard')
      expect(service).toHaveBeenCalledWith(
        backgroundMocks.db,
        ...expectedServiceArgs(),
      )
      expectPracticeTrackInvalidation()
      expectFlushBeforeBroadcast()
      assertResponse(response)
    },
  )

  it.each([
    ['hard', '2026-01-02T00:00:00.000Z', false],
    ['good', '2026-01-02T00:00:00.000Z', true],
    ['easy', '2026-01-03T00:00:00.000Z', true],
  ] as const)(
    'handles active-track progress for %s saved reviews',
    async (rating, reviewedAt, recordsCompletion) => {
      resetRuntimeMutationMocks()
      if (recordsCompletion) {
        backgroundMocks.recordActiveTrackProblemCompletion.mockResolvedValueOnce(
          true,
        )
      }

      await sendRuntimeMessage('practice.saveReviewResult', {
        surface: 'dashboard',
        problemSlug: 'two-sum',
        rating,
        reviewedAt,
      })

      expectRuntimePolicy('practice.saveReviewResult', 'dashboard')
      if (recordsCompletion) {
        expect(
          backgroundMocks.recordActiveTrackProblemCompletion,
        ).toHaveBeenCalledWith(backgroundMocks.db, {
          problemSlug: 'two-sum',
          rating,
          completedAt: new Date(reviewedAt),
        })
      } else {
        expect(
          backgroundMocks.recordActiveTrackProblemCompletion,
        ).not.toHaveBeenCalled()
      }
      expectPracticeTrackInvalidation()
      expectFlushBeforeBroadcast()
    },
  )

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
    expectPracticeTrackInvalidation()
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

type RuntimeSurface = 'popup' | 'dashboard' | 'content-script'
type RuntimeServiceMock = ReturnType<typeof vi.fn>
type RuntimeRequestSchema = { parse: (value: unknown) => unknown }

type ReadOnlyHandlerCase = readonly [
  string,
  string,
  RuntimeSurface,
  () => unknown,
  RuntimeServiceMock,
  expectedServiceArgs: (request: unknown) => unknown[],
  assertResponse: (response: unknown) => void | Promise<void>,
  options?: {
    arrange?: () => void
    invalidServiceResponse?: () => unknown
    usesDb?: boolean
  },
]

type TrackWriteHandlerCase = readonly [
  string,
  string,
  () => unknown,
  RuntimeRequestSchema,
  RuntimeServiceMock,
  () => unknown,
  readonly string[],
]

type SettingsWriteHandlerCase = readonly [
  string,
  () => { surface: 'popup' | 'dashboard' },
  RuntimeServiceMock,
  () => unknown[],
  () => unknown,
]

type BackupWriteHandlerCase = readonly [
  string,
  () => unknown,
  RuntimeServiceMock,
  () => unknown[],
  unknown,
]

type PracticeMutationHandlerCase = readonly [
  string,
  () => unknown,
  RuntimeServiceMock,
  () => unknown[],
  (response: unknown) => void,
]

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

function expectNoMutationSideEffects() {
  expect(backgroundMocks.flushDbSnapshot).not.toHaveBeenCalled()
  expect(backgroundMocks.broadcastCacheInvalidation).not.toHaveBeenCalled()
}

function expectPracticeTrackInvalidation() {
  expect(backgroundMocks.broadcastCacheInvalidation).toHaveBeenCalledWith({
    problemSlug: 'two-sum',
    reason: 'practice-updated',
    source: 'dashboard',
    tags: ['practice', 'problems', 'queue', 'app-shell', 'tracks'],
  })
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
    practiceProgress: {
      completedToday: 0,
      dailyGoal: 4,
      currentStreak: 0,
      goalMetToday: false,
      todayDateKey: '2026-01-01',
    },
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
      appearance: defaultUserSettings.appearance,
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
const backupTimestamp = '2026-05-25T12:00:00.000Z'
const validBackup = backupFileSchema.parse({
  schemaVersion: backupSchemaVersion,
  app: 'cognipace',
  exportedAt: backupTimestamp,
  source: { appVersion: '0.0.0' },
  data: {
    problems: [
      {
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'easy',
        isPremium: false,
        createdAt: backupTimestamp,
        updatedAt: backupTimestamp,
      },
    ],
    topics: [{ id: 'array', label: 'Array' }],
    companies: [{ id: 'meta', label: 'Meta' }],
    problemTopics: [{ problemSlug: 'two-sum', topicId: 'array' }],
    problemCompanies: [{ problemSlug: 'two-sum', companyId: 'meta' }],
    practice: {
      problemPractice: [
        {
          problemSlug: 'two-sum',
          status: 'review',
          firstSeenAt: backupTimestamp,
          lastSeenAt: backupTimestamp,
          lastReviewedAt: backupTimestamp,
          lastRating: 'good',
          lastElapsedSeconds: 600,
          bestElapsedSeconds: 600,
          interviewPattern: 'hash-map',
          timeComplexity: 'O(n)',
          spaceComplexity: 'O(n)',
          languages: 'TypeScript',
          notes: 'review note',
          solvedCount: 1,
          attemptCount: 1,
          isSuspended: false,
          createdAt: backupTimestamp,
          updatedAt: backupTimestamp,
        },
      ],
      fsrsCards: [
        {
          id: 'card-1',
          problemSlug: 'two-sum',
          cardKind: 'default',
          dueAt: backupTimestamp,
          stability: 2.5,
          difficulty: 4.5,
          elapsedDays: 0,
          scheduledDays: 1,
          learningSteps: 0,
          reps: 1,
          lapses: 0,
          state: 'review',
          lastReviewAt: backupTimestamp,
          createdAt: backupTimestamp,
          updatedAt: backupTimestamp,
        },
      ],
      reviewAttempts: [
        {
          id: 'attempt-1',
          problemSlug: 'two-sum',
          cardId: 'card-1',
          rating: 'good',
          reviewMode: 'manual',
          reviewedAt: backupTimestamp,
          elapsedSeconds: 600,
          isCorrect: true,
          interviewPattern: 'hash-map',
          timeComplexity: 'O(n)',
          spaceComplexity: 'O(n)',
          languages: 'TypeScript',
          notes: 'review note',
          fsrsReviewLog: null,
          createdAt: backupTimestamp,
          updatedAt: backupTimestamp,
        },
      ],
    },
    tracks: {
      tracks: [
        {
          id: 'custom-track',
          slug: 'custom-track',
          title: 'Custom Track',
          description: 'A local track',
          dueAt: null,
          createdAt: backupTimestamp,
          updatedAt: backupTimestamp,
        },
      ],
      groups: [
        {
          id: 'custom-track:arrays',
          trackId: 'custom-track',
          title: 'Arrays',
          position: 1,
          createdAt: backupTimestamp,
          updatedAt: backupTimestamp,
        },
      ],
      memberships: [
        {
          trackGroupId: 'custom-track:arrays',
          problemSlug: 'two-sum',
          position: 1,
        },
      ],
      progress: [
        {
          trackGroupId: 'custom-track:arrays',
          problemSlug: 'two-sum',
          completedAt: backupTimestamp,
          completedRating: 'good',
          createdAt: backupTimestamp,
          updatedAt: backupTimestamp,
        },
      ],
      session: [
        {
          id: 'active',
          activeTrackId: 'custom-track',
          activeGroupId: 'custom-track:arrays',
          startedAt: backupTimestamp,
          updatedAt: backupTimestamp,
        },
      ],
    },
    settings: [
      {
        key: 'user-settings',
        value: JSON.stringify(defaultUserSettings),
        updatedAt: backupTimestamp,
      },
    ],
  },
})
const validBackupSummary = createBackupSummary(validBackup)
