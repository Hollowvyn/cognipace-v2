import type { ProblemLibraryRow } from '@/features/problems'

import type { TrackFormGroupState } from './use-track-form'

export type TrackFormGroupBy = 'none' | 'difficulty' | 'topic' | 'company'

export const trackFormGroupByOptions = [
  { label: 'None', value: 'none' },
  { label: 'Difficulty', value: 'difficulty' },
  { label: 'Topic', value: 'topic' },
  { label: 'Company', value: 'company' },
] as const satisfies ReadonlyArray<{
  label: string
  value: TrackFormGroupBy
}>

export interface TrackFormInitialDraft {
  id: string
  problemRows: readonly ProblemLibraryRow[]
  selectedCount: number
  source: 'library-selection'
}

export function createGroupsFromInitialDraftRows(
  problemRows: readonly ProblemLibraryRow[],
  groupBy: TrackFormGroupBy,
): TrackFormGroupState[] {
  if (groupBy === 'none') {
    return [
      {
        key: 'draft-group-1',
        problemSlugs: problemRows.map((row) => row.problem.slug),
        title: 'Main',
      },
    ]
  }

  if (groupBy === 'difficulty') {
    return createGroupsFromBuckets(problemRows, [
      { key: 'easy', title: 'Easy' },
      { key: 'medium', title: 'Medium' },
      { key: 'hard', title: 'Hard' },
      { key: 'unknown', title: 'Unknown' },
    ])
  }

  const fallbackTitle = groupBy === 'topic' ? 'No topic' : 'No company'

  return createGroupsFromRows(
    problemRows,
    (row) =>
      groupBy === 'topic'
        ? (row.topics[0]?.label ?? fallbackTitle)
        : (row.companies[0]?.label ?? fallbackTitle),
  )
}

function createGroupsFromBuckets(
  problemRows: readonly ProblemLibraryRow[],
  buckets: ReadonlyArray<{ key: string; title: string }>,
) {
  const problemSlugsByKey = new Map<string, string[]>(
    buckets.map((bucket) => [bucket.key, []]),
  )

  for (const row of problemRows) {
    const difficulty = problemSlugsByKey.has(row.problem.difficulty)
      ? row.problem.difficulty
      : 'unknown'
    problemSlugsByKey.get(difficulty)?.push(row.problem.slug)
  }

  return buckets
    .map((bucket) => ({
      problemSlugs: problemSlugsByKey.get(bucket.key) ?? [],
      title: bucket.title,
    }))
    .filter((group) => group.problemSlugs.length > 0)
    .map(addDraftGroupKey)
}

function createGroupsFromRows(
  problemRows: readonly ProblemLibraryRow[],
  getTitle: (row: ProblemLibraryRow) => string,
) {
  const problemSlugsByTitle = new Map<string, string[]>()

  for (const row of problemRows) {
    const title = getTitle(row)
    const problemSlugs = problemSlugsByTitle.get(title) ?? []
    problemSlugs.push(row.problem.slug)
    problemSlugsByTitle.set(title, problemSlugs)
  }

  return Array.from(problemSlugsByTitle, ([title, problemSlugs]) => ({
    problemSlugs,
    title,
  })).map(addDraftGroupKey)
}

function addDraftGroupKey(
  group: Pick<TrackFormGroupState, 'problemSlugs' | 'title'>,
  index: number,
): TrackFormGroupState {
  return {
    key: `draft-group-${index + 1}`,
    problemSlugs: group.problemSlugs,
    title: group.title,
  }
}
