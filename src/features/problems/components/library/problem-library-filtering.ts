import type {
  ProblemLibraryResponse,
  ProblemLibraryRow,
  ProblemLibraryStatus,
} from '../../api/problems-contracts'

export type ProblemDifficultyFilter =
  | 'all'
  | 'easy'
  | 'medium'
  | 'hard'
  | 'unknown'
export type ProblemStatusFilter = 'all' | ProblemLibraryStatus
export type ProblemPremiumFilter = 'all' | 'free' | 'premium'
export type ProblemLibrarySortDirection = 'asc' | 'desc'
export type ProblemLibrarySortKey =
  | 'difficulty'
  | 'lastSolvedAt'
  | 'nextReviewAt'
  | 'status'
  | 'title'

export interface ProblemLibraryFilters {
  companyId: string
  difficulty: ProblemDifficultyFilter
  premium: ProblemPremiumFilter
  search: string
  status: ProblemStatusFilter
  topicId: string
  trackGroupId: string
}

export interface ProblemLibrarySort {
  direction: ProblemLibrarySortDirection
  key: ProblemLibrarySortKey
}

export const defaultProblemLibraryFilters = {
  companyId: 'all',
  difficulty: 'all',
  premium: 'all',
  search: '',
  status: 'all',
  topicId: 'all',
  trackGroupId: 'all',
} as const satisfies ProblemLibraryFilters

export const defaultProblemLibrarySort = {
  direction: 'asc',
  key: 'title',
} as const satisfies ProblemLibrarySort

export function filterProblemLibraryRows(
  rows: readonly ProblemLibraryRow[],
  filters: ProblemLibraryFilters,
) {
  const search = normalizeSearch(filters.search)

  return rows.filter((row) => {
    if (filters.difficulty !== 'all') {
      if (row.problem.difficulty !== filters.difficulty) {
        return false
      }
    }

    if (filters.status !== 'all' && row.status !== filters.status) {
      return false
    }

    if (filters.premium === 'free' && row.problem.isPremium) {
      return false
    }

    if (filters.premium === 'premium' && !row.problem.isPremium) {
      return false
    }

    if (
      filters.topicId !== 'all' &&
      !row.topics.some((topic) => topic.id === filters.topicId)
    ) {
      return false
    }

    if (
      filters.companyId !== 'all' &&
      !row.companies.some((company) => company.id === filters.companyId)
    ) {
      return false
    }

    if (
      filters.trackGroupId !== 'all' &&
      !row.trackMemberships.some(
        (membership) => membership.groupId === filters.trackGroupId,
      )
    ) {
      return false
    }

    return !search || createProblemSearchText(row).includes(search)
  })
}

export function sortProblemLibraryRows(
  rows: readonly ProblemLibraryRow[],
  sort: ProblemLibrarySort,
) {
  return [...rows].sort((left, right) => {
    const result = compareProblemRows(left, right, sort.key)

    return sort.direction === 'asc' ? result : result * -1
  })
}

export function summarizeVisibleLibraryRows(
  library: ProblemLibraryResponse,
  rows: readonly ProblemLibraryRow[],
) {
  return {
    totalCount: library.summary.totalCount,
    filteredCount: rows.length,
    dueCount: rows.filter((row) => row.status === 'due').length,
    suspendedCount: rows.filter((row) => row.status === 'suspended').length,
  }
}

export function hasProblemLibraryFilters(filters: ProblemLibraryFilters) {
  return Object.entries(defaultProblemLibraryFilters).some(
    ([key, value]) => filters[key as keyof ProblemLibraryFilters] !== value,
  )
}

function createProblemSearchText(row: ProblemLibraryRow) {
  return normalizeSearch(
    [
      row.problem.title,
      row.problem.slug,
      row.problem.difficulty,
      ...row.topics.map((topic) => topic.label),
      ...row.companies.map((company) => company.label),
      ...row.trackMemberships.flatMap((membership) => [
        membership.trackTitle,
        membership.groupTitle,
      ]),
    ].join(' '),
  )
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

const difficultyOrder = {
  easy: 1,
  medium: 2,
  hard: 3,
  unknown: 4,
} as const

const statusOrder = {
  due: 1,
  scheduled: 2,
  'not-started': 3,
  suspended: 4,
} as const

function compareProblemRows(
  left: ProblemLibraryRow,
  right: ProblemLibraryRow,
  key: ProblemLibrarySortKey,
) {
  switch (key) {
    case 'difficulty':
      return compareNumber(
        difficultyOrder[left.problem.difficulty],
        difficultyOrder[right.problem.difficulty],
      )
    case 'lastSolvedAt':
      return compareNullableDate(left.lastSolvedAt, right.lastSolvedAt)
    case 'nextReviewAt':
      return compareNullableDate(left.nextReviewAt, right.nextReviewAt)
    case 'status':
      return compareNumber(statusOrder[left.status], statusOrder[right.status])
    case 'title':
      return left.problem.title.localeCompare(right.problem.title)
  }
}

function compareNullableDate(left: string | null, right: string | null) {
  if (left === right) {
    return 0
  }

  if (!left) {
    return 1
  }

  if (!right) {
    return -1
  }

  return compareNumber(new Date(left).getTime(), new Date(right).getTime())
}

function compareNumber(left: number, right: number) {
  return left - right
}
