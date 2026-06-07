import { describe, expect, it } from 'vitest'

import {
  analyticsSummaryRequestSchema,
  analyticsSummarySchema,
  type SerializedAnalyticsSummary,
} from './analytics-contracts'

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
  it('rejects out-of-range average retrievability', () => {
    const summary = createAnalyticsSummary()

    expect(() =>
      analyticsSummarySchema.parse({
        ...summary,
        memoryProfile: {
          ...summary.memoryProfile,
          averageRetrievability: 1.01,
        },
      }),
    ).toThrow()
    expect(() =>
      analyticsSummarySchema.parse({
        ...summary,
        memoryProfile: {
          ...summary.memoryProfile,
          averageRetrievability: -0.01,
        },
      }),
    ).toThrow()
  })
})

function createAnalyticsSummary(): SerializedAnalyticsSummary {
  return {
    generatedAt: '2026-01-15T12:00:00.000Z',
    reviewDays: 0,
    totalReviews: 0,
    currentStreak: 0,
    retentionProxy: 0,
    retentionProxyLabel: '—',
    retentionSampleSize: 0,
    lowSample: true,
    dueForecast14Days: Array.from({ length: 14 }, (_, index) => ({
      date: `2026-01-${String(15 + index).padStart(2, '0')}`,
      dueCount: 0,
    })),
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
}
