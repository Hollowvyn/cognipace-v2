import { describe, expect, it } from 'vitest'

import {
  problemLibraryOptionsSchema,
  problemTopicSchema,
  problemsBulkUpdateProblemsRequestSchema,
  problemsCreateProblemRequestSchema,
} from './problems-contracts'

describe('problems contracts', () => {
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

  it('defaults problem topic parent rollups and keeps options simple', () => {
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
            parentTopics: [{ id: 'graph-theory', label: 'Graph Theory' }],
          },
        ],
        companies: [{ id: 'meta', label: 'Meta' }],
      }),
    ).toEqual({
      topics: [{ id: 'breadth-first-search', label: 'Breadth-First Search' }],
      companies: [{ id: 'meta', label: 'Meta' }],
    })
  })
})
