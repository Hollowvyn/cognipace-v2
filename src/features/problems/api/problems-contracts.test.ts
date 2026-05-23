import { describe, expect, it } from 'vitest'

import {
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
})
