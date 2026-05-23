import type {
  ColumnFiltersState,
  FilterFn,
  Row,
} from '@tanstack/react-table'

import type { ProblemDifficulty } from '@/lib/problem-catalog'

import type {
  ProblemLibraryResponse,
  ProblemLibraryRow,
  ProblemLibraryStatus,
} from '../../api/problems-contracts'

export const problemLibraryColumnIds = {
  companyIds: 'companyIds',
  difficulty: 'difficulty',
  expander: 'expander',
  isPremium: 'isPremium',
  isSuspended: 'isSuspended',
  lastReviewedAt: 'lastReviewedAt',
  nextReviewAt: 'nextReviewAt',
  retention: 'retention',
  selection: 'selection',
  status: 'status',
  title: 'title',
  topicIds: 'topicIds',
} as const

export interface ProblemLibraryFilters {
  companyIds: string[]
  difficultyValues: ProblemDifficulty[]
  hidePremium: boolean
  hideSuspended: boolean
  search: string
  statusValues: ProblemLibraryStatus[]
  topicIds: string[]
}

export const defaultProblemLibraryFilters = {
  companyIds: [],
  difficultyValues: [],
  hidePremium: false,
  hideSuspended: false,
  search: '',
  statusValues: [],
  topicIds: [],
} as const satisfies ProblemLibraryFilters

export function createProblemLibraryColumnFilters(
  filters: ProblemLibraryFilters,
): ColumnFiltersState {
  const columnFilters: ColumnFiltersState = []

  pushArrayColumnFilter(
    columnFilters,
    problemLibraryColumnIds.difficulty,
    filters.difficultyValues,
  )
  pushArrayColumnFilter(
    columnFilters,
    problemLibraryColumnIds.status,
    filters.statusValues,
  )
  pushArrayColumnFilter(
    columnFilters,
    problemLibraryColumnIds.topicIds,
    filters.topicIds,
  )
  pushArrayColumnFilter(
    columnFilters,
    problemLibraryColumnIds.companyIds,
    filters.companyIds,
  )

  if (filters.hidePremium) {
    columnFilters.push({ id: problemLibraryColumnIds.isPremium, value: true })
  }

  if (filters.hideSuspended) {
    columnFilters.push({
      id: problemLibraryColumnIds.isSuspended,
      value: true,
    })
  }

  return columnFilters
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
  return (
    filters.search.trim().length > 0 ||
    filters.difficultyValues.length > 0 ||
    filters.statusValues.length > 0 ||
    filters.topicIds.length > 0 ||
    filters.companyIds.length > 0 ||
    filters.hidePremium ||
    filters.hideSuspended
  )
}

export const problemLibraryGlobalFilter: FilterFn<ProblemLibraryRow> = (
  row,
  _columnId,
  filterValue,
) => {
  const search = normalizeSearch(String(filterValue ?? ''))

  return !search || createProblemSearchText(row.original).includes(search)
}

problemLibraryGlobalFilter.autoRemove = (value) =>
  normalizeSearch(String(value ?? '')).length === 0

export const problemLibraryIncludesAnyFilter: FilterFn<ProblemLibraryRow> = (
  row,
  columnId,
  filterValue,
) => {
  const selectedValues = toStringArray(filterValue)

  if (selectedValues.length === 0) {
    return true
  }

  const value = row.getValue<string | string[]>(columnId)

  if (Array.isArray(value)) {
    return value.some((candidate) => selectedValues.includes(candidate))
  }

  return selectedValues.includes(value)
}

problemLibraryIncludesAnyFilter.autoRemove = (value) =>
  toStringArray(value).length === 0

export const problemLibraryExcludeTrueFilter: FilterFn<ProblemLibraryRow> = (
  row,
  columnId,
  filterValue,
) => {
  if (filterValue !== true) {
    return true
  }

  return row.getValue<boolean>(columnId) !== true
}

problemLibraryExcludeTrueFilter.autoRemove = (value) => value !== true

export function getFilteredOriginalRows(
  rows: readonly Row<ProblemLibraryRow>[],
) {
  return rows.map((row) => row.original)
}

function pushArrayColumnFilter(
  columnFilters: ColumnFiltersState,
  id: string,
  values: readonly string[],
) {
  if (values.length > 0) {
    columnFilters.push({ id, value: [...values] })
  }
}

function createProblemSearchText(row: ProblemLibraryRow) {
  return normalizeSearch(
    [
      row.problem.title,
      row.problem.slug,
      row.problem.difficulty,
      ...row.topics.map((topic) => topic.label),
      ...row.companies.map((company) => company.label),
    ].join(' '),
  )
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}
