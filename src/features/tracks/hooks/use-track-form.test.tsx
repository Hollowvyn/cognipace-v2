import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { createSerializedProblem } from '@/testing/problem-fixtures'
import {
  createSerializedTrackGroup,
  createTrackForEditResponse,
  createTrackProblemRow,
} from '@/testing/track-fixtures'

import type { TrackFormInitialDraft } from './track-form-initial-draft'
import { useTrackForm } from './use-track-form'

function row(
  slug: string,
  title: string,
  overrides: {
    companies?: ReturnType<typeof createTrackProblemRow>['companies']
    difficulty?: 'easy' | 'medium' | 'hard' | 'unknown'
    topics?: ReturnType<typeof createTrackProblemRow>['topics']
  } = {},
) {
  return createTrackProblemRow({
    problem: createSerializedProblem({
      difficulty: overrides.difficulty ?? 'easy',
      slug,
      title,
    }),
    companies: overrides.companies ?? [],
    topics: overrides.topics ?? [],
  })
}

function initialDraft(
  problemRows: TrackFormInitialDraft['problemRows'],
): TrackFormInitialDraft {
  return {
    id: 'draft-1',
    problemRows,
    selectedCount: problemRows.length,
    source: 'library-selection',
  }
}

describe('useTrackForm initial draft behavior', () => {
  it('initializes create-mode groups from initialDraft rows', () => {
    const problemRows = [
      row('two-sum', 'Two Sum'),
      row('valid-parentheses', 'Valid Parentheses'),
    ]
    const source = createTrackForEditResponse({
      groups: [],
      problemRows,
      track: null,
    })

    const { result } = renderHook(() =>
      useTrackForm(source, { initialDraft: initialDraft(problemRows) }),
    )

    expect(result.current.state.groupBy).toBe('none')
    expect(result.current.state.selectedGroupKey).toBe('draft-group-1')
    expect(result.current.state.groups).toEqual([
      {
        key: 'draft-group-1',
        problemSlugs: ['two-sum', 'valid-parentheses'],
        title: 'Main',
      },
    ])
  })

  it('ignores initialDraft in edit mode and preserves source groups', () => {
    const source = createTrackForEditResponse({
      groups: [
        {
          ...createSerializedTrackGroup({
            id: 'track-1:arrays',
            position: 2,
            title: 'Arrays',
          }),
          problemSlugs: ['two-sum'],
        },
        {
          ...createSerializedTrackGroup({
            id: 'track-1:trees',
            position: 1,
            title: 'Trees',
          }),
          problemSlugs: ['binary-tree-inorder-traversal'],
        },
      ],
      problemRows: [
        row('two-sum', 'Two Sum'),
        row('binary-tree-inorder-traversal', 'Binary Tree Inorder Traversal'),
      ],
    })

    const { result } = renderHook(() =>
      useTrackForm(source, {
        initialDraft: initialDraft([row('draft-only', 'Draft Only')]),
      }),
    )

    expect(result.current.state.groups).toEqual([
      {
        id: 'track-1:trees',
        key: 'track-1:trees',
        problemSlugs: ['binary-tree-inorder-traversal'],
        title: 'Trees',
      },
      {
        id: 'track-1:arrays',
        key: 'track-1:arrays',
        problemSlugs: ['two-sum'],
        title: 'Arrays',
      },
    ])
  })

  it('rebuilds groups from provided rows when groupBy changes', () => {
    const problemRows = [
      row('two-sum', 'Two Sum', { difficulty: 'easy' }),
      row('valid-parentheses', 'Valid Parentheses', { difficulty: 'medium' }),
      row('merge-k-sorted-lists', 'Merge K Sorted Lists', {
        difficulty: 'hard',
      }),
    ]
    const source = createTrackForEditResponse({
      groups: [],
      problemRows,
      track: null,
    })
    const { result } = renderHook(() =>
      useTrackForm(source, { initialDraft: initialDraft(problemRows) }),
    )

    act(() => {
      result.current.dispatch({
        type: 'remove-problem',
        groupKey: 'draft-group-1',
        problemSlug: 'valid-parentheses',
      })
      result.current.dispatch({
        type: 'set-group-by',
        groupBy: 'difficulty',
        problemRows,
      })
    })

    expect(result.current.state.groupBy).toBe('difficulty')
    expect(result.current.state.selectedGroupKey).toBe('draft-group-1')
    expect(result.current.state.groups).toEqual([
      {
        key: 'draft-group-1',
        problemSlugs: ['two-sum'],
        title: 'Easy',
      },
      {
        key: 'draft-group-2',
        problemSlugs: ['valid-parentheses'],
        title: 'Medium',
      },
      {
        key: 'draft-group-3',
        problemSlugs: ['merge-k-sorted-lists'],
        title: 'Hard',
      },
    ])
  })
})

describe('useTrackForm problem movement', () => {
  it('moves a problem from one group to another', () => {
    const problemRows = [
      row('two-sum', 'Two Sum', { difficulty: 'easy' }),
      row('valid-parentheses', 'Valid Parentheses', { difficulty: 'medium' }),
      row('merge-intervals', 'Merge Intervals', { difficulty: 'medium' }),
    ]
    const source = createTrackForEditResponse({
      groups: [],
      problemRows,
      track: null,
    })
    const { result } = renderHook(() =>
      useTrackForm(source, { initialDraft: initialDraft(problemRows) }),
    )

    act(() => {
      result.current.dispatch({
        type: 'set-group-by',
        groupBy: 'difficulty',
        problemRows,
      })
      result.current.dispatch({
        type: 'move-problem-to-group',
        fromGroupKey: 'draft-group-1',
        problemSlug: 'two-sum',
        toGroupKey: 'draft-group-2',
      })
    })

    expect(result.current.state.groups).toEqual([
      {
        key: 'draft-group-1',
        problemSlugs: [],
        title: 'Easy',
      },
      {
        key: 'draft-group-2',
        problemSlugs: ['valid-parentheses', 'merge-intervals', 'two-sum'],
        title: 'Medium',
      },
    ])
  })
})
