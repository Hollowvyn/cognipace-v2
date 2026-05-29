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
  it('creates one Main group with selected slugs in order for none grouping', () => {
    expect(
      createGroupsFromInitialDraftRows(
        [
          row('two-sum', 'Two Sum'),
          row('valid-parentheses', 'Valid Parentheses'),
          row('binary-search', 'Binary Search'),
        ],
        'none',
      ),
    ).toEqual([
      {
        key: 'draft-group-1',
        problemSlugs: ['two-sum', 'valid-parentheses', 'binary-search'],
        title: 'Main',
      },
    ])
  })

  it('groups by difficulty in product order and omits empty groups', () => {
    expect(
      createGroupsFromInitialDraftRows(
        [
          row('unknown-problem', 'Unknown Problem', { difficulty: 'unknown' }),
          row('hard-problem', 'Hard Problem', { difficulty: 'hard' }),
          row('easy-problem', 'Easy Problem', { difficulty: 'easy' }),
        ],
        'difficulty',
      ),
    ).toEqual([
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
    ])
  })

  it('groups by first topic and falls back to No topic', () => {
    expect(
      createGroupsFromInitialDraftRows(
        [
          row('two-sum', 'Two Sum', {
            topics: [
              { id: 'arrays', label: 'Arrays', parentTopics: [] },
              { id: 'hashing', label: 'Hashing', parentTopics: [] },
            ],
          }),
          row('binary-tree', 'Binary Tree', {
            topics: [{ id: 'trees', label: 'Trees', parentTopics: [] }],
          }),
          row('untagged', 'Untagged'),
        ],
        'topic',
      ),
    ).toEqual([
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
    ])
  })

  it('groups by first company and falls back to No company', () => {
    expect(
      createGroupsFromInitialDraftRows(
        [
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
        'company',
      ),
    ).toEqual([
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
    ])
  })
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
