import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { OverlayAppShellData } from '@/features/app-shell'
import { getOverlayAppShellDataViaRuntime } from '@/features/app-shell'
import {
  overrideLastReviewResultViaRuntime,
  saveReviewResultViaRuntime,
  type SerializedPracticeDetails,
  updateCurrentPracticeLogViaRuntime,
} from '@/features/practice'
import { upsertProblemFromPageViaRuntime } from '@/features/problems'
import type {
  LeetCodePageEvent,
  LeetCodeProblemLocation,
  LeetCodeProblemMetadata,
} from '@/lib/leetcode'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { useLeetCodeOverlaySession } from './use-leetcode-overlay-session'

type LeetCodeMockState = {
  onEvent: ((event: LeetCodePageEvent) => void) | null
  problemLocation: LeetCodeProblemLocation
}

const leetcodeMockState = vi.hoisted<LeetCodeMockState>(() => ({
  onEvent: null,
  problemLocation: {
    slug: 'two-sum',
    url: 'https://leetcode.com/problems/two-sum/',
    host: 'leetcode.com',
  },
}))

vi.mock('@/lib/leetcode', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/leetcode')>()

  return {
    ...actual,
    createLeetCodePageWatcher: vi.fn(
      (options: { onEvent: (event: LeetCodePageEvent) => void }) => {
        leetcodeMockState.onEvent = options.onEvent

        return {
          start: vi.fn(),
          stop: vi.fn(),
        }
      },
    ),
    parseLeetCodeProblemLocation: vi.fn(
      () => leetcodeMockState.problemLocation,
    ),
  }
})

vi.mock('@/features/leetcode-capture', () => ({
  createLeetCodeCaptureRemoteClient: vi.fn(() => ({})),
}))

vi.mock('@/features/problems', () => ({
  upsertProblemFromPageViaRuntime: vi.fn(),
}))

vi.mock('@/features/practice', () => ({
  invalidatePracticeRelatedQueries: vi.fn(
    (queryClient: {
      invalidateQueries: (filters: { queryKey: readonly unknown[] }) => unknown
    }) => {
      void queryClient.invalidateQueries({ queryKey: ['app-shell-data'] })
    },
  ),
  overrideLastReviewResultViaRuntime: vi.fn(),
  saveReviewResultViaRuntime: vi.fn(),
  updateCurrentPracticeLogViaRuntime: vi.fn(),
}))

vi.mock('@/features/app-shell', () => ({
  getOverlayAppShellDataViaRuntime: vi.fn(),
}))

const problemLocation =
  leetcodeMockState.problemLocation satisfies LeetCodeProblemLocation

const problemMetadata = {
  location: problemLocation,
  title: 'Two Sum',
  frontendId: '1',
  difficulty: 'Easy',
  isPremium: false,
  topics: [{ name: 'Array', slug: 'array' }],
  source: 'graphql',
  confidence: 'high',
  capturedAt: 1,
} satisfies LeetCodeProblemMetadata

const defaultTiming = {
  requireSolveTime: false,
  hardMode: false,
  easyMinutes: 20,
  mediumMinutes: 35,
  hardMinutes: 50,
}

const overlayProblem = {
  difficulty: 'easy',
  id: 'leetcode:two-sum',
  isPremium: false,
  slug: 'two-sum',
  title: 'Two Sum',
  url: 'https://leetcode.com/problems/two-sum/',
} satisfies NonNullable<OverlayAppShellData['overlay']['problem']>

const nextStep = {
  category: null,
  detail: 'Next in track · easy',
  dueAt: null,
  kind: 'track',
  problem: {
    difficulty: 'easy',
    id: 'leetcode:valid-parentheses',
    isPremium: false,
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    url: 'https://leetcode.com/problems/valid-parentheses/',
  },
  title: 'Valid Parentheses',
} satisfies NonNullable<OverlayAppShellData['overlay']['nextStep']>

describe('useLeetCodeOverlaySession', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    leetcodeMockState.onEvent = null
    vi.mocked(upsertProblemFromPageViaRuntime).mockResolvedValue(problemRecord)
    vi.mocked(saveReviewResultViaRuntime).mockResolvedValue(reviewResult)
    vi.mocked(overrideLastReviewResultViaRuntime).mockResolvedValue(
      reviewResult,
    )
    vi.mocked(updateCurrentPracticeLogViaRuntime).mockResolvedValue(
      createPracticeDetails(),
    )
    vi.mocked(getOverlayAppShellDataViaRuntime).mockResolvedValue(
      createOverlayData(),
    )
  })

  it('quick submits from collapsed using the assessment policy', async () => {
    const { result } = await renderReadySession()

    await runOverlayAction(result.current.actions.prepareQuickSubmit)

    expect(latestSavedReviewRequest()).toMatchObject({
      rating: 'good',
      elapsedSeconds: null,
      isCorrect: true,
    })
    expect(result.current.overlay.visualMode).toBe('expanded')
    expect(result.current.overlay.selectedRating).toBe('good')
    expect(result.current.overlay.reviewStatus).toBe('submitted-clean')
  })

  it('submits selected rating without requiring timer usage', async () => {
    const { result } = await renderReadySession({
      timing: { requireSolveTime: true },
    })

    await runOverlayAction(result.current.actions.submitReview)

    expect(latestSavedReviewRequest()).toMatchObject({
      surface: 'content-script',
      problemId: 'leetcode:two-sum',
      rating: 'good',
      elapsedSeconds: null,
      isCorrect: true,
      log: {
        interviewPattern: null,
      },
    })
    expect(result.current.overlay.reviewStatus).toBe('submitted-clean')
  })

  it('keeps a saved review submitted when the next-step refresh fails', async () => {
    vi.mocked(getOverlayAppShellDataViaRuntime)
      .mockResolvedValueOnce(createOverlayData())
      .mockRejectedValueOnce(new Error('Next problem unavailable.'))
    const { result } = await renderReadySession()

    await runOverlayAction(result.current.actions.submitReview)

    expect(result.current.overlay.reviewStatus).toBe('submitted-clean')
    expect(result.current.overlay.submittedSession?.rating).toBe('good')
    expect(result.current.overlay.nextStep.status).toBe('error')
    expect(result.current.overlay.nextStep.message).toBe(
      'Review saved. Next problem unavailable.',
    )
  })

  it('forces Hard Mode overtime submissions to Again', async () => {
    const startTime = Date.now()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(startTime)
    const { result } = await renderReadySession({
      timing: { hardMode: true },
    })

    act(() => {
      result.current.actions.startTimer()
    })
    nowSpy.mockReturnValue(startTime + 21 * 60 * 1000)

    await runOverlayAction(result.current.actions.submitReview)

    expect(latestSavedReviewRequest()).toMatchObject({
      rating: 'again',
      elapsedSeconds: 21 * 60,
      isCorrect: false,
    })
    expect(result.current.overlay.ratingLockReason).toBe('hard-mode-overtime')
  })

  it('saves failed attempts immediately as Again and locks assessment', async () => {
    const { result } = await renderReadySession()

    await runOverlayAction(result.current.actions.failReview)

    expect(latestSavedReviewRequest()).toMatchObject({
      rating: 'again',
      isCorrect: false,
    })
    expect(result.current.overlay.visualMode).toBe('expanded')
    expect(result.current.overlay.ratingLockReason).toBe('failed')
  })

  it('updates the latest submitted review instead of appending another attempt', async () => {
    const { result } = await renderReadySession()

    await runOverlayAction(result.current.actions.submitReview)
    act(() => {
      result.current.actions.selectRating('hard')
    })
    act(() => {
      result.current.draft.setField('notes', 'Need to revisit overflow cases.')
    })
    await runOverlayAction(result.current.actions.updateReview)

    expect(saveReviewResultViaRuntime).toHaveBeenCalledOnce()
    expect(overrideLastReviewResultViaRuntime).toHaveBeenCalledOnce()
    expect(
      vi.mocked(overrideLastReviewResultViaRuntime).mock.calls[0]?.[0],
    ).toMatchObject({
      problemId: 'leetcode:two-sum',
      rating: 'hard',
      log: {
        notes: 'Need to revisit overflow cases.',
      },
    })
  })

  it('persists dirty drafts when collapsing without creating a review attempt', async () => {
    const { result } = await renderReadySession()

    act(() => {
      result.current.draft.setField('notes', 'Carry this draft.')
    })
    act(() => {
      result.current.actions.collapse()
    })

    await waitFor(() => {
      expect(updateCurrentPracticeLogViaRuntime).toHaveBeenCalled()
    })

    expect(latestPracticeLogUpdateRequest()).toMatchObject({
      surface: 'content-script',
      problemId: 'leetcode:two-sum',
      log: {
        notes: 'Carry this draft.',
      },
    })
    expect(saveReviewResultViaRuntime).not.toHaveBeenCalled()
  })

  it.each([
    {
      outcome: 'result',
      finishDraftPersist: (deferred: DeferredPracticeDetails) =>
        deferred.resolve(createPracticeDetails()),
    },
    {
      outcome: 'error',
      finishDraftPersist: (deferred: DeferredPracticeDetails) =>
        deferred.reject(new Error('Old draft failed.')),
    },
  ] as const)(
    'ignores an in-flight draft persist $outcome after page navigation',
    async ({ finishDraftPersist }) => {
      const deferredDraftPersist = createDeferred<SerializedPracticeDetails>()
      vi.mocked(updateCurrentPracticeLogViaRuntime).mockReturnValueOnce(
        deferredDraftPersist.promise,
      )
      const { invalidateQueries, result } = await renderReadySession()

      act(() => {
        result.current.draft.setField('notes', 'Old page draft.')
      })
      act(() => {
        result.current.actions.collapse()
      })
      await waitFor(() =>
        expect(updateCurrentPracticeLogViaRuntime).toHaveBeenCalledOnce(),
      )

      emitNextPage()
      await act(async () => {
        finishDraftPersist(deferredDraftPersist)
        await deferredDraftPersist.promise.catch(() => undefined)
      })

      expect(result.current.status).toBe('reading-page')
      expect(result.current.overlay.persistedDraft.notes).toBe('')
      expect(result.current.overlay.feedback).toBeNull()
      expect(invalidateQueries).not.toHaveBeenCalled()
    },
  )

  it.each([
    {
      outcome: 'result',
      finishSave: (deferred: DeferredReviewResult) =>
        deferred.resolve(reviewResult),
    },
    {
      outcome: 'error',
      finishSave: (deferred: DeferredReviewResult) =>
        deferred.reject(new Error('Old save failed.')),
    },
  ] as const)(
    'ignores an in-flight submit $outcome after page navigation',
    async ({ finishSave }) => {
      const deferredSave = createDeferred<typeof reviewResult>()
      vi.mocked(saveReviewResultViaRuntime).mockReturnValueOnce(
        deferredSave.promise,
      )
      const { result } = await renderReadySession()

      const savePromise = runOverlayAction(result.current.actions.submitReview)

      emitNextPage()
      finishSave(deferredSave)
      await savePromise

      expect(result.current.status).toBe('reading-page')
      expect(result.current.overlay.submittedSession).toBeNull()
      expect(getOverlayAppShellDataViaRuntime).toHaveBeenCalledTimes(1)
    },
  )
})

type RenderedOverlaySession = ReturnType<typeof renderOverlaySession>
type DeferredReviewResult = ReturnType<
  typeof createDeferred<typeof reviewResult>
>
type DeferredPracticeDetails = ReturnType<
  typeof createDeferred<SerializedPracticeDetails>
>

async function renderReadySession(options?: {
  timing?: Partial<OverlayAppShellData['overlay']['timing']>
}): Promise<RenderedOverlaySession> {
  if (options?.timing) {
    vi.mocked(getOverlayAppShellDataViaRuntime).mockResolvedValue(
      createOverlayData({ timing: options.timing }),
    )
  }

  const session = renderOverlaySession()

  emitPageReady()
  await waitFor(() =>
    expect(session.result.current).toMatchObject({
      status: 'ready',
      overlay: { activeProblemId: 'leetcode:two-sum' },
    }),
  )

  return session
}

function runOverlayAction(action: () => Promise<void>) {
  return act(async () => {
    await action()
  })
}

function latestSavedReviewRequest() {
  expect(saveReviewResultViaRuntime).toHaveBeenCalled()

  const request = vi.mocked(saveReviewResultViaRuntime).mock.calls.at(-1)?.[0]

  if (!request) {
    throw new Error('Expected a saved review request.')
  }

  return request
}

function latestPracticeLogUpdateRequest() {
  expect(updateCurrentPracticeLogViaRuntime).toHaveBeenCalled()

  const request = vi
    .mocked(updateCurrentPracticeLogViaRuntime)
    .mock.calls.at(-1)?.[0]

  if (!request) {
    throw new Error('Expected a practice log update request.')
  }

  return request
}

function emitNextPage() {
  emitPageChanged({
    ...problemLocation,
    slug: 'add-two-numbers',
    url: 'https://leetcode.com/problems/add-two-numbers/',
  })
}

function renderOverlaySession() {
  const { queryClient, wrapper } = createQueryTestHarness()
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

  return {
    ...renderHook(() => useLeetCodeOverlaySession(), {
      wrapper,
    }),
    invalidateQueries,
    queryClient,
  }
}

function emitPageReady() {
  act(() => {
    leetcodeMockState.onEvent?.({
      type: 'page-ready',
      location: problemLocation,
      snapshot: {
        location: problemLocation,
        title: problemMetadata.title,
        frontendId: problemMetadata.frontendId,
        difficulty: problemMetadata.difficulty,
        isPremium: problemMetadata.isPremium,
        topics: problemMetadata.topics,
        isReady: true,
        capturedAt: problemMetadata.capturedAt,
      },
      metadata: problemMetadata,
      pageReadyAt: Date.now(),
    })
  })
}

function emitPageChanged(location: LeetCodeProblemLocation) {
  act(() => {
    leetcodeMockState.onEvent?.({
      type: 'page-changed',
      location,
      previousLocation: problemLocation,
      changedAt: Date.now(),
    })
  })
}

function createOverlayData(options?: {
  timing?: Partial<OverlayAppShellData['overlay']['timing']>
}): OverlayAppShellData {
  return {
    generatedAt: '2026-01-01T10:00:00.000Z',
    surface: 'overlay',
    overlay: {
      problem: overlayProblem,
      practice: null,
      timing: {
        ...defaultTiming,
        ...options?.timing,
      },
      nextStep,
    },
  }
}

function createPracticeDetails(): SerializedPracticeDetails {
  return {
    problemId: 'leetcode:two-sum',
    cardId: 'fsrs:leetcode:two-sum',
    practice: null,
    card: null,
    summary: createSummary(),
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
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((resolver, rejecter) => {
    resolve = resolver
    reject = rejecter
  })

  return {
    promise,
    reject,
    resolve,
  }
}

function createSummary(
  overrides: Partial<SerializedPracticeDetails['summary']> = {},
): SerializedPracticeDetails['summary'] {
  return {
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
    ...overrides,
  }
}

const problemRecord = {
  id: overlayProblem.id,
  source: 'leetcode',
  externalId: '1',
  slug: overlayProblem.slug,
  title: overlayProblem.title,
  difficulty: overlayProblem.difficulty,
  url: overlayProblem.url,
  isPremium: overlayProblem.isPremium,
  acceptanceRate: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
} as const

const reviewResult = {
  problemId: 'leetcode:two-sum',
  cardId: 'fsrs:leetcode:two-sum',
  rating: 'good',
  status: 'learning',
  dueAt: '2026-01-02T10:00:00.000Z',
  reviewedAt: '2026-01-01T10:00:00.000Z',
  summary: createSummary({
    phase: 'learning',
    nextReviewAt: '2026-01-02T10:00:00.000Z',
    lastReviewedAt: '2026-01-01T10:00:00.000Z',
    reviewCount: 1,
    difficulty: 5,
    stability: 1,
    scheduledDays: 1,
    isStarted: true,
    retrievability: 1,
  }),
} as const
