import { describe, expect, it } from 'vitest'

import { createSerializedProblem } from '@/testing/problem-fixtures'
import { createTrackProblemRow } from '@/testing/track-fixtures'

import {
  createGroupsFromInitialDraftRows,
  trackFormGroupByOptions,
} from './track-form-initial-draft'

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

describe('createGroupsFromInitialDraftRows', () => {
  it.each([
    {
      expectedGroups: [
        {
          key: 'draft-group-1',
          problemSlugs: ['two-sum', 'valid-parentheses', 'binary-search'],
          title: 'Main',
        },
      ],
      groupBy: 'none' as const,
      name: 'none',
      problemRows: [
        row('two-sum', 'Two Sum'),
        row('valid-parentheses', 'Valid Parentheses'),
        row('binary-search', 'Binary Search'),
      ],
    },
    {
      expectedGroups: [
        {
          key: 'draft-group-1',
          problemSlugs: ['easy-problem'],
          title: 'Easy',
        },
        {
          key: 'draft-group-2',
          problemSlugs: ['hard-problem'],
          title: 'Hard',
        },
        {
          key: 'draft-group-3',
          problemSlugs: ['unknown-problem'],
          title: 'Unknown',
        },
      ],
      groupBy: 'difficulty' as const,
      name: 'difficulty',
      problemRows: [
        row('unknown-problem', 'Unknown Problem', { difficulty: 'unknown' }),
        row('hard-problem', 'Hard Problem', { difficulty: 'hard' }),
        row('easy-problem', 'Easy Problem', { difficulty: 'easy' }),
      ],
    },
    {
      expectedGroups: [
        {
          key: 'draft-group-1',
          problemSlugs: ['two-sum'],
          title: 'Arrays',
        },
        {
          key: 'draft-group-2',
          problemSlugs: ['binary-tree'],
          title: 'Trees',
        },
        {
          key: 'draft-group-3',
          problemSlugs: ['untagged'],
          title: 'No topic',
        },
      ],
      groupBy: 'topic' as const,
      name: 'topic',
      problemRows: [
        row('two-sum', 'Two Sum', {
          topics: [
            { id: 'arrays', label: 'Arrays' },
            { id: 'hashing', label: 'Hashing' },
          ],
        }),
        row('binary-tree', 'Binary Tree', {
          topics: [{ id: 'trees', label: 'Trees' }],
        }),
        row('untagged', 'Untagged'),
      ],
    },
    {
      expectedGroups: [
        {
          key: 'draft-group-1',
          problemSlugs: ['two-sum'],
          title: 'Meta',
        },
        {
          key: 'draft-group-2',
          problemSlugs: ['merge-intervals'],
          title: 'Amazon',
        },
        {
          key: 'draft-group-3',
          problemSlugs: ['unlabeled'],
          title: 'No company',
        },
      ],
      groupBy: 'company' as const,
      name: 'company',
      problemRows: [
        row('two-sum', 'Two Sum', {
          companies: [
            { id: 'meta', label: 'Meta' },
            { id: 'google', label: 'Google' },
          ],
        }),
        row('merge-intervals', 'Merge Intervals', {
          companies: [{ id: 'amazon', label: 'Amazon' }],
        }),
        row('unlabeled', 'Unlabeled'),
      ],
    },
  ])(
    'creates groups for $name grouping',
    ({ expectedGroups, groupBy, problemRows }) => {
      expect(createGroupsFromInitialDraftRows(problemRows, groupBy)).toEqual(
        expectedGroups,
      )
    },
  )
})

describe('trackFormGroupByOptions', () => {
  it('lists the supported draft grouping options', () => {
    expect(trackFormGroupByOptions).toEqual([
      { label: 'None', value: 'none' },
      { label: 'Difficulty', value: 'difficulty' },
      { label: 'Topic', value: 'topic' },
      { label: 'Company', value: 'company' },
    ])
  })
})
