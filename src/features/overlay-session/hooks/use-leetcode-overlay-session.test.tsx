import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { OverlayAppShellData } from '@/features/app-shell'
import {
  getOverlayAppShellDataViaRuntime,
} from '@/features/app-shell'
import { saveReviewResultViaRuntime } from '@/features/practice'
import { upsertProblemFromPageViaRuntime } from '@/features/problems'
import type {
  LeetCodePageEvent,
  LeetCodeProblemLocation,
  LeetCodeProblemMetadata,
} from '@/lib/leetcode'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { useLeetCodeOverlaySession } from './use-leetcode-overlay-session'

const leetcodeMockState = vi.hoisted(() => ({
  onEvent: null as ((event: LeetCodePageEvent) => void) | null,
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
  saveReviewResultViaRuntime: vi.fn(),
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

describe('useLeetCodeOverlaySession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    leetcodeMockState.onEvent = null
    vi.mocked(upsertProblemFromPageViaRuntime).mockResolvedValue(problemRecord)
    vi.mocked(saveReviewResultViaRuntime).mockResolvedValue(reviewResult)
    vi.mocked(getOverlayAppShellDataViaRuntime).mockResolvedValue(
      createOverlayData(),
    )
  })

  it.each([
    {
      name: 'selected rating with current solve time',
      ready: {},
      rating: 'good',
      expectedSave: {
        rating: 'good',
        reviewMode: 'leetcode',
        isCorrect: true,
      },
      assert: ({ invalidateQueries }: RenderedOverlaySession) => {
        const request = readSaveReviewRequest()

        expect(request.elapsedSeconds).toBeGreaterThanOrEqual(95)
        expect(invalidateQueries).toHaveBeenCalledWith({
          queryKey: ['app-shell-data'],
        })
      },
    },
    {
      name: 'overtime hard-mode review as Again',
      ready: {
        elapsedSeconds: 21 * 60,
        timing: { hardMode: true },
      },
      rating: 'good',
      expectedSave: {
        rating: 'again',
        isCorrect: false,
      },
      assert: ({ result }: RenderedOverlaySession) => {
        expect(result.current.feedback).toBe(
          'Over the solve-time target. Saved as Again.',
        )
      },
    },
    {
      name: 'Again as fail semantics when solve time is required and missing',
      ready: {
        elapsedSeconds: 0,
        timing: { requireSolveTime: true },
      },
      rating: 'again',
      expectedSave: {
        rating: 'again',
        elapsedSeconds: null,
        isCorrect: false,
      },
    },
  ] as const)(
    'saves $name',
    async ({ ready, rating, expectedSave, assert }) => {
      const session = await renderReadySession(ready)

      await saveReview(session.result, rating)

      expect(readSaveReviewRequest()).toMatchObject({
        surface: 'content-script',
        problemId: 'leetcode:two-sum',
        ...expectedSave,
      })
      assert?.(session)
    },
  )

  it('blocks non-Again saves when solve time is required and missing', async () => {
    const { result } = await renderReadySession({
      elapsedSeconds: 0,
      timing: { requireSolveTime: true },
    })

    await saveReview(result, 'good')

    expect(saveReviewResultViaRuntime).not.toHaveBeenCalled()
    expect(result.current.status).toBe('error')
    expect(result.current.feedback).toBe(
      'Solve time is required before saving this review.',
    )
  })

  it.each([
    ['result', (deferred: DeferredReviewResult) => deferred.resolve(reviewResult)],
    ['error', (deferred: DeferredReviewResult) =>
      deferred.reject(new Error('Old save failed.'))],
  ] as const)(
    'ignores an in-flight save %s after page navigation',
    async (_, finishSave) => {
      const deferredSave = createDeferred()
      vi.mocked(saveReviewResultViaRuntime).mockReturnValueOnce(
        deferredSave.promise,
      )
      const { result } = await renderReadySession()

      const savePromise = saveReview(result, 'good')

      emitNextPage()
      finishSave(deferredSave)
      await savePromise

      expect(result.current.status).toBe('reading-page')
      expect(result.current.feedback).toBeNull()
      expect(getOverlayAppShellDataViaRuntime).toHaveBeenCalledTimes(1)
    },
  )
})

type RenderedOverlaySession = ReturnType<typeof renderOverlaySession>
type DeferredReviewResult = ReturnType<typeof createDeferred>
type SaveReview =
  ReturnType<typeof renderOverlaySession>['result']['current']['saveReview']

async function renderReadySession(options?: {
  elapsedSeconds?: number
  timing?: Partial<OverlayAppShellData['overlay']['timing']>
}): Promise<RenderedOverlaySession> {
  if (options?.timing) {
    vi.mocked(getOverlayAppShellDataViaRuntime).mockResolvedValue(
      createOverlayData({ timing: options.timing }),
    )
  }

  const session = renderOverlaySession()

  emitPageReady(options?.elapsedSeconds ?? 95)
  await waitFor(() => expect(session.result.current.status).toBe('ready'))

  return session
}

function saveReview(
  result: RenderedOverlaySession['result'],
  rating: Parameters<SaveReview>[0],
) {
  return act(async () => {
    await result.current.saveReview(rating)
  })
}

function readSaveReviewRequest() {
  expect(saveReviewResultViaRuntime).toHaveBeenCalledOnce()

  const request = vi.mocked(saveReviewResultViaRuntime).mock.calls[0]?.[0]

  if (!request) {
    throw new Error('Expected a saved review request.')
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

function emitPageReady(elapsedSeconds: number) {
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
      pageReadyAt: Date.now() - elapsedSeconds * 1000,
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
      problem: {
        id: 'leetcode:two-sum',
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'easy',
        url: 'https://leetcode.com/problems/two-sum/',
        isPremium: false,
      },
      practice: null,
      timing: {
        ...defaultTiming,
        ...options?.timing,
      },
    },
  }
}

function createDeferred() {
  let resolve!: (value: typeof reviewResult) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<typeof reviewResult>((resolver, rejecter) => {
    resolve = resolver
    reject = rejecter
  })

  return {
    promise,
    reject,
    resolve,
  }
}

const problemRecord = {
  id: 'leetcode:two-sum',
  source: 'leetcode',
  externalId: '1',
  slug: 'two-sum',
  title: 'Two Sum',
  difficulty: 'easy',
  url: 'https://leetcode.com/problems/two-sum/',
  isPremium: false,
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
  summary: {
    phase: 'learning',
    nextReviewAt: '2026-01-02T10:00:00.000Z',
    lastReviewedAt: '2026-01-01T10:00:00.000Z',
    reviewCount: 1,
    lapses: 0,
    difficulty: 5,
    stability: 1,
    scheduledDays: 1,
    suspended: false,
    isStarted: true,
    isDue: false,
    isOverdue: false,
    overdueDays: 0,
    retrievability: 1,
  },
} as const
