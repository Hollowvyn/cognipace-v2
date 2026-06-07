import { describe, expect, it } from 'vitest'

import {
  analyticsSummaryRequestSchema,
  analyticsSummarySchema,
  forecastEntrySchema,
  weakProblemSchema,
  type SerializedAnalyticsSummary,
} from './analytics-contracts'

const validForecast = Array.from({ length: 14 }, (_, index) => ({
  date: `2026-01-${String(15 + index).padStart(2, '0')}`,
  dueCount: index,
}))

const validSummary: SerializedAnalyticsSummary = {
  generatedAt: '2026-01-15T12:00:00.000Z',
  reviewDays: 10,
  totalReviews: 42,
  currentStreak: 3,
  retentionProxy: 0.75,
  retentionProxyLabel: '75%',
  retentionSampleSize: 20,
  lowSample: false,
  dueForecast14Days: validForecast,
  weakProblems: [],
  memoryProfile: {
    totalTracked: 1,
    dueToday: 0,
    overdue: 0,
    learning: 0,
    review: 1,
    mastered: 0,
    suspended: 0,
    averageRetrievability: 0.8,
    lowSample: true,
  },
}

describe('analyticsSummaryRequestSchema', () => {
  it('requires the dashboard surface', () => {
    expect(() => analyticsSummaryRequestSchema.parse({})).toThrow()
    expect(
      analyticsSummaryRequestSchema.parse({ surface: 'dashboard' }),
    ).toEqual({ surface: 'dashboard' })
  })

  it('accepts optional ISO at', () => {
    expect(
      analyticsSummaryRequestSchema.parse({
        surface: 'dashboard',
        at: '2026-01-15T12:00:00.000Z',
      }),
    ).toEqual({
      surface: 'dashboard',
      at: '2026-01-15T12:00:00.000Z',
    })
  })
})

describe('analyticsSummarySchema', () => {
  it('accepts a valid full summary', () => {
    expect(analyticsSummarySchema.safeParse(validSummary).success).toBe(true)
  })

  it('rejects a forecast with fewer than 14 entries', () => {
    const result = analyticsSummarySchema.safeParse({
      ...validSummary,
      dueForecast14Days: validForecast.slice(0, 13),
    })
    expect(result.success).toBe(false)
  })

  it('rejects a forecast with more than 14 entries', () => {
    const result = analyticsSummarySchema.safeParse({
      ...validSummary,
      dueForecast14Days: [
        ...validForecast,
        { date: '2026-01-29', dueCount: 0 },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than 10 weak problems', () => {
    const tooMany = Array.from({ length: 11 }, (_, index) => ({
      slug: `problem-${index}`,
      title: `Problem ${index}`,
      lapseCount: 1,
      difficulty: 5,
      retrievability: 0.8,
    }))
    expect(
      analyticsSummarySchema.safeParse({
        ...validSummary,
        weakProblems: tooMany,
      }).success,
    ).toBe(false)
  })

  it('rejects negative integer counts', () => {
    expect(
      analyticsSummarySchema.safeParse({ ...validSummary, reviewDays: -1 })
        .success,
    ).toBe(false)
    expect(
      analyticsSummarySchema.safeParse({ ...validSummary, totalReviews: -1 })
        .success,
    ).toBe(false)
    expect(
      analyticsSummarySchema.safeParse({ ...validSummary, currentStreak: -1 })
        .success,
    ).toBe(false)
    expect(
      analyticsSummarySchema.safeParse({
        ...validSummary,
        retentionSampleSize: -1,
      }).success,
    ).toBe(false)
  })

  it('rejects out-of-range average retrievability', () => {
    expect(() =>
      analyticsSummarySchema.parse({
        ...validSummary,
        memoryProfile: {
          ...validSummary.memoryProfile,
          averageRetrievability: 1.01,
        },
      }),
    ).toThrow()
    expect(() =>
      analyticsSummarySchema.parse({
        ...validSummary,
        memoryProfile: {
          ...validSummary.memoryProfile,
          averageRetrievability: -0.01,
        },
      }),
    ).toThrow()
  })
})

describe('forecastEntrySchema', () => {
  it('accepts a valid forecast entry', () => {
    expect(
      forecastEntrySchema.safeParse({ date: '2026-01-15', dueCount: 3 })
        .success,
    ).toBe(true)
  })

  it('rejects a negative dueCount', () => {
    expect(
      forecastEntrySchema.safeParse({ date: '2026-01-15', dueCount: -1 })
        .success,
    ).toBe(false)
  })

  it('rejects a missing date', () => {
    expect(forecastEntrySchema.safeParse({ dueCount: 3 }).success).toBe(false)
  })
})

describe('weakProblemSchema', () => {
  it('accepts a valid weak problem', () => {
    expect(
      weakProblemSchema.safeParse({
        slug: 'two-sum',
        title: 'Two Sum',
        lapseCount: 3,
        difficulty: 7.5,
        retrievability: 0.4,
      }).success,
    ).toBe(true)
  })

  it('rejects a negative lapseCount', () => {
    expect(
      weakProblemSchema.safeParse({
        slug: 'two-sum',
        title: 'Two Sum',
        lapseCount: -1,
        difficulty: 7.5,
        retrievability: 0.4,
      }).success,
    ).toBe(false)
  })

  it('rejects a missing slug', () => {
    expect(
      weakProblemSchema.safeParse({
        title: 'Two Sum',
        lapseCount: 3,
        difficulty: 7.5,
        retrievability: 0.4,
      }).success,
    ).toBe(false)
  })
})
