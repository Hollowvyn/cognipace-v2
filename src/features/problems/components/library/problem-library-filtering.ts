import type { ColumnFiltersState, FilterFn, Row } from '@tanstack/react-table'

import type { ProblemDifficulty } from '@/features/problems/domain'

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
  trackIds: 'trackIds',
  topicIds: 'topicIds',
} as const

export interface ProblemLibraryFilters {
  companyIds: string[]
  difficultyValues: ProblemDifficulty[]
  hidePremium: boolean
  hideSuspended: boolean
  search: string
  statusValues: ProblemLibraryStatus[]
  trackIds: string[]
  topicIds: string[]
  topicMatchMode: 'any' | 'all'
  includeSubtopics: boolean
  topicQuery: string
}

export type ProblemTopicFilter = Pick<
  ProblemLibraryFilters,
  'topicIds' | 'topicMatchMode' | 'includeSubtopics'
>

export const defaultProblemLibraryFilters = {
  companyIds: [],
  difficultyValues: [],
  hidePremium: false,
  hideSuspended: false,
  search: '',
  statusValues: [],
  trackIds: [],
  topicIds: [],
  topicMatchMode: 'any',
  includeSubtopics: true,
  topicQuery: '',
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
  if (filters.topicIds.length > 0) {
    columnFilters.push({
      id: problemLibraryColumnIds.topicIds,
      value: {
        topicIds: filters.topicIds,
        topicMatchMode: filters.topicMatchMode,
        includeSubtopics: filters.includeSubtopics,
      } satisfies ProblemTopicFilter,
    })
  }
  pushArrayColumnFilter(
    columnFilters,
    problemLibraryColumnIds.trackIds,
    filters.trackIds,
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
    dueCount: rows.filter(
      (row) => row.status === 'overdue' || row.status === 'due',
    ).length,
    suspendedCount: rows.filter((row) => row.status === 'suspended').length,
  }
}

export function hasProblemLibraryFilters(filters: ProblemLibraryFilters) {
  return (
    filters.search.trim().length > 0 ||
    filters.topicQuery !== '' ||
    filters.difficultyValues.length > 0 ||
    filters.statusValues.length > 0 ||
    filters.trackIds.length > 0 ||
    filters.topicIds.length > 0 ||
    filters.topicMatchMode !== 'any' ||
    !filters.includeSubtopics ||
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

export function matchesProblemTopics(
  row: Pick<ProblemLibraryRow, 'topics' | 'effectiveTopicIds'>,
  filter: ProblemTopicFilter,
): boolean {
  if (filter.topicIds.length === 0) return true

  const actual = new Set(
    filter.includeSubtopics
      ? row.effectiveTopicIds
      : row.topics.map((topic) => topic.id),
  )

  return filter.topicMatchMode === 'all'
    ? filter.topicIds.every((id) => actual.has(id))
    : filter.topicIds.some((id) => actual.has(id))
}

export const problemLibraryTopicFilter: FilterFn<ProblemLibraryRow> = (
  row,
  _columnId,
  value: ProblemTopicFilter,
) => matchesProblemTopics(row.original, value)

problemLibraryTopicFilter.autoRemove = (value: ProblemTopicFilter) =>
  value.topicIds.length === 0

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

// ⚡ Bolt: Caching search text to optimize table filtering performance.
// Expected Impact: Eliminates expensive string concatenation and array mapping during global
// search (e.g. typing in the search box). Since TanStack Table creates new objects when row
// data changes, using a WeakMap guarantees no memory leaks and fresh cache for updated rows.
const searchTextCache = new WeakMap<ProblemLibraryRow, string>()

function createProblemSearchText(row: ProblemLibraryRow) {
  const cached = searchTextCache.get(row)
  if (cached !== undefined) {
    return cached
  }

  const text = normalizeSearch(
    [
      row.problem.title,
      row.problem.slug,
      row.problem.difficulty,
      ...row.topics.map((topic) => topic.label),
      ...row.companies.map((company) => company.label),
      ...row.trackMemberships.map((membership) => membership.trackTitle),
      ...row.trackMemberships.map((membership) => membership.groupTitle),
    ].join(' '),
  )

  searchTextCache.set(row, text)
  return text
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}
