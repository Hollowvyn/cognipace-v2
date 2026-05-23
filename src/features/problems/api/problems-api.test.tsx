import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import {
  useBulkUpdateProblems,
  useCreateProblem,
  useProblemLibrary,
  useUpdateProblem,
} from './problems-api'
import type {
  ProblemForEditResponse,
  ProblemLibraryResponse,
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

  it('invalidates problem-backed queries after create/update/bulk mutations', async () => {
    const { queryClient, wrapper } = createQueryTestHarness()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    vi.mocked(sendMessage).mockResolvedValue(problemForEditResponse)

    const createHook = renderHook(() => useCreateProblem(), { wrapper })
    await act(async () => {
      await createHook.result.current.mutateAsync({
        surface: 'dashboard',
        slugOrUrl: 'binary-search',
        title: 'Binary Search',
        difficulty: 'easy',
        isPremium: false,
        topicLabels: [],
        companyLabels: [],
      })
    })

    expect(sendMessage).toHaveBeenCalledWith('problems.createProblem', {
      surface: 'dashboard',
      slugOrUrl: 'binary-search',
      title: 'Binary Search',
      difficulty: 'easy',
      isPremium: false,
      topicLabels: [],
      companyLabels: [],
    })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['problems'] })

    vi.clearAllMocks()
    vi.mocked(sendMessage).mockResolvedValue(problemForEditResponse)
    const updateHook = renderHook(() => useUpdateProblem(), { wrapper })
    await act(async () => {
      await updateHook.result.current.mutateAsync({
        surface: 'dashboard',
        problemSlug: 'binary-search',
        title: 'Binary Search',
        difficulty: 'medium',
        isPremium: true,
        topicLabels: ['Search'],
        companyLabels: ['Meta'],
      })
    })

    expect(sendMessage).toHaveBeenCalledWith('problems.updateProblem', {
      surface: 'dashboard',
      problemSlug: 'binary-search',
      title: 'Binary Search',
      difficulty: 'medium',
      isPremium: true,
      topicLabels: ['Search'],
      companyLabels: ['Meta'],
    })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['problems'] })

    vi.clearAllMocks()
    vi.mocked(sendMessage).mockResolvedValue({
      updatedProblemSlugs: ['binary-search'],
      missingProblemSlugs: [],
    })
    const bulkHook = renderHook(() => useBulkUpdateProblems(), { wrapper })
    await act(async () => {
      await bulkHook.result.current.mutateAsync({
        surface: 'dashboard',
        problemSlugs: ['binary-search'],
        set: { isPremium: true },
      })
    })

    expect(sendMessage).toHaveBeenCalledWith('problems.bulkUpdateProblems', {
      surface: 'dashboard',
      problemSlugs: ['binary-search'],
      set: { isPremium: true },
    })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['problems'] })
  })
})

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
