import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import {
  useBulkUpdateProblems,
  useCreateProblem,
  useProblemLibrary,
} from './problems-api'
import type {
  ProblemForEditResponse,
  ProblemLibraryResponse,
  ProblemsBulkUpdateProblemsRequest,
  ProblemsCreateProblemRequest,
} from './problems-contracts'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('problems API hooks', () => {
  it('reads the problem library through the runtime boundary', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(libraryResponse)
    const { wrapper } = createQueryTestHarness()

    const { result } = renderHook(
      () =>
        useProblemLibrary({
          surface: 'dashboard',
          at: '2026-01-01T10:00:00.000Z',
        }),
      { wrapper },
    )

    await waitFor(() => {
      expect(result.current.data).toBe(libraryResponse)
    })
    expect(sendMessage).toHaveBeenCalledWith('problems.getLibrary', {
      surface: 'dashboard',
      at: '2026-01-01T10:00:00.000Z',
    })
  })

  it('invalidates problem-backed queries after create and bulk mutations', async () => {
    await expectProblemMutation({
      method: 'problems.createProblem',
      response: problemForEditResponse,
      request: {
        surface: 'dashboard',
        slugOrUrl: 'binary-search',
        title: 'Binary Search',
        difficulty: 'easy',
        isPremium: false,
        topicLabels: [],
        companyLabels: [],
      } satisfies ProblemsCreateProblemRequest,
      useHook: useCreateProblem,
    })
    await expectProblemMutation({
      method: 'problems.bulkUpdateProblems',
      response: {
        updatedProblemSlugs: ['binary-search'],
        missingProblemSlugs: [],
      },
      request: {
        surface: 'dashboard',
        problemSlugs: ['binary-search'],
        set: { isPremium: true },
      } satisfies ProblemsBulkUpdateProblemsRequest,
      useHook: useBulkUpdateProblems,
    })
  })
})

async function expectProblemMutation<TRequest>(input: {
  method: string
  request: TRequest
  response: Awaited<ReturnType<typeof sendMessage>>
  useHook: () => {
    mutateAsync: (request: TRequest) => Promise<unknown>
  }
}) {
  const { queryClient, wrapper } = createQueryTestHarness()
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  vi.mocked(sendMessage).mockResolvedValue(input.response)
  const { result } = renderHook(() => input.useHook(), { wrapper })

  await act(async () => {
    await result.current.mutateAsync(input.request)
  })

  expect(sendMessage).toHaveBeenCalledWith(input.method, input.request)
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['problems'] })
}

const summary = {
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
} as const

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
} satisfies ProblemForEditResponse

const libraryResponse = {
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
      summary,
      nextReviewAt: null,
      lastReviewedAt: null,
      lastSolvedAt: null,
      topics: [],
      companies: [],
      trackMemberships: [],
    },
  ],
} satisfies ProblemLibraryResponse
