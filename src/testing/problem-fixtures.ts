import type {
  ProblemForEditResponse,
  ProblemLibraryResponse,
  SerializedProblem,
} from '@/features/problems/api/problems-contracts'

import { createSerializedPracticeSummary } from './practice-fixtures'

export function createSerializedProblem(
  overrides: Partial<SerializedProblem> = {},
): SerializedProblem {
  return {
    slug: 'binary-search',
    title: 'Binary Search',
    difficulty: 'easy',
    isPremium: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function createProblemForEditResponse(
  overrides: Partial<ProblemForEditResponse> = {},
): ProblemForEditResponse {
  return {
    problem: createSerializedProblem(),
    topics: [],
    companies: [],
    trackMemberships: [],
    options: {
      topics: [],
      companies: [],
      trackGroups: [],
    },
    ...overrides,
  }
}

export function createProblemLibraryResponse(
  overrides: Partial<ProblemLibraryResponse> = {},
): ProblemLibraryResponse {
  const problem = createSerializedProblem()

  return {
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
        problem,
        status: 'not-started',
        summary: createSerializedPracticeSummary(),
        nextReviewAt: null,
        lastReviewedAt: null,
        lastSolvedAt: null,
        topics: [],
        companies: [],
        trackMemberships: [],
      },
    ],
    ...overrides,
  }
}
