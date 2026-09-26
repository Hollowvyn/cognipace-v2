import { describe, expect, it } from 'vitest'

import { createProblemLibraryResponse } from '@/testing/problem-fixtures'

import {
  problemLibraryOptionsSchema,
  problemLibraryRowSchema,
  problemLibraryStatusSchema,
  problemTopicSchema,
  problemsBulkUpdateProblemsRequestSchema,
  problemsCreateProblemRequestSchema,
  problemsUpsertFromPageRequestSchema,
} from './problems-contracts'

describe('problems contracts', () => {
  it('accepts overdue as a Library status', () => {
    expect(problemLibraryStatusSchema.parse('overdue')).toBe('overdue')
  })

  it('accepts Library create payloads without track writes', () => {
    expect(
      problemsCreateProblemRequestSchema.parse({
        surface: 'dashboard',
        slugOrUrl: 'two-sum',
        title: 'Two Sum',
      }),
    ).toEqual({
      surface: 'dashboard',
      slugOrUrl: 'two-sum',
      title: 'Two Sum',
      difficulty: 'unknown',
      isPremium: false,
      topicLabels: [],
      companyLabels: [],
    })
  })

  it('requires at least one set field for bulk problem updates', () => {
    expect(() =>
      problemsBulkUpdateProblemsRequestSchema.parse({
        surface: 'dashboard',
        problemSlugs: ['two-sum'],
        set: {},
      }),
    ).toThrow(/At least one bulk update field/)

    expect(
      problemsBulkUpdateProblemsRequestSchema.parse({
        surface: 'dashboard',
        problemSlugs: ['two-sum'],
        set: {
          difficulty: 'hard',
          topicLabels: [],
          companyLabels: ['Meta'],
        },
      }),
    ).toEqual({
      surface: 'dashboard',
      problemSlugs: ['two-sum'],
      set: {
        difficulty: 'hard',
        topicLabels: [],
        companyLabels: ['Meta'],
      },
    })
  })

  it('parses LeetCode page topic labels for capture upserts', () => {
    expect(
      problemsUpsertFromPageRequestSchema.parse({
        surface: 'content-script',
        url: 'https://leetcode.com/problems/two-sum/',
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'Easy',
        isPremium: false,
        topicLabels: ['Array', 'Hash Table'],
      }),
    ).toMatchObject({
      topicLabels: ['Array', 'Hash Table'],
    })
  })

  it('defaults direct topic parents and requires alias-rich topic options', () => {
    expect(
      problemTopicSchema.parse({
        id: 'breadth-first-search',
        label: 'Breadth-First Search',
      }),
    ).toEqual({
      id: 'breadth-first-search',
      label: 'Breadth-First Search',
      parentTopics: [],
    })

    expect(
      problemLibraryOptionsSchema.parse({
        topics: [
          {
            id: 'breadth-first-search',
            label: 'Breadth-First Search',
            aliases: ['BFS'],
          },
        ],
        companies: [{ id: 'meta', label: 'Meta' }],
      }),
    ).toEqual({
      topics: [
        {
          id: 'breadth-first-search',
          label: 'Breadth-First Search',
          aliases: ['BFS'],
        },
      ],
      companies: [{ id: 'meta', label: 'Meta' }],
    })

    expect(
      problemLibraryOptionsSchema.safeParse({
        topics: [{ id: 'dfs', label: 'Depth-First Search' }],
        companies: [],
      }).success,
    ).toBe(false)
    const rowWithoutEffectiveTopicIds = {
      ...createProblemLibraryResponse().rows[0],
    }
    delete (rowWithoutEffectiveTopicIds as { effectiveTopicIds?: string[] })
      .effectiveTopicIds
    expect(
      problemLibraryRowSchema.safeParse(rowWithoutEffectiveTopicIds).success,
    ).toBe(false)
  })
})
