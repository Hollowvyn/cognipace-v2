import { describe, expect, it } from 'vitest'

import type { RetentionProxyResult, ForecastEntry } from './summary'
import {
  buildRetentionProxy,
  buildDueForecast,
  buildWeakProblems,
  buildAnalyticsSummary,
  buildMemoryProfile,
} from './summary'

const now = new Date(2026, 0, 15, 12, 0, 0)
const recentDate = new Date(2026, 0, 14, 12, 0, 0)
const oldDate = new Date(2025, 11, 14, 12, 0, 0) // > 30 days before now

describe('buildRetentionProxy', () => {
  it('returns lowSample when fewer than 10 ratings in the 30-day window', () => {
    const attempts = Array.from({ length: 9 }, () => ({
      rating: 'good',
      reviewedAt: recentDate,
    }))

    const result = buildRetentionProxy(attempts, now)

    expect(result.lowSample).toBe(true)
    expect(result.value).toBe(0)
    expect(result.label).toBe('—')
    expect(result.sampleSize).toBe(9)
  })

  it('returns correct percentage for sufficient sample', () => {
    const attempts = [
      ...Array.from({ length: 7 }, () => ({
        rating: 'good',
        reviewedAt: recentDate,
      })),
      ...Array.from({ length: 3 }, () => ({
        rating: 'again',
        reviewedAt: recentDate,
      })),
    ]

    const result = buildRetentionProxy(attempts, now)

    expect(result.lowSample).toBe(false)
    expect(result.value).toBeCloseTo(0.7)
    expect(result.label).toBe('70%')
    expect(result.sampleSize).toBe(10)
  })

  it('counts good and easy as positive; again and hard as not positive', () => {
    const attempts = [
      { rating: 'good', reviewedAt: recentDate },
      { rating: 'easy', reviewedAt: recentDate },
      { rating: 'again', reviewedAt: recentDate },
      { rating: 'hard', reviewedAt: recentDate },
      ...Array.from({ length: 6 }, () => ({
        rating: 'good',
        reviewedAt: recentDate,
      })),
    ]

    const result = buildRetentionProxy(attempts, now)

    expect(result.value).toBeCloseTo(0.8)
    expect(result.label).toBe('80%')
  })

  it('excludes ratings older than 30 days', () => {
    const attempts = Array.from({ length: 10 }, () => ({
      rating: 'good',
      reviewedAt: oldDate,
    }))

    const result = buildRetentionProxy(attempts, now)

    expect(result.lowSample).toBe(true)
    expect(result.sampleSize).toBe(0)
  })

  it('boundary: exactly 10 ratings in window is not lowSample', () => {
    const attempts = Array.from({ length: 10 }, () => ({
      rating: 'good',
      reviewedAt: recentDate,
    }))

    const result = buildRetentionProxy(attempts, now)

    expect(result.lowSample).toBe(false)
  })
})

describe('buildDueForecast', () => {
  it('returns exactly 14 entries starting from today', () => {
    const result = buildDueForecast([], now)

    expect(result).toHaveLength(14)
    expect(result[0]?.date).toBe('2026-01-15')
    expect(result[13]?.date).toBe('2026-01-28')
  })

  it('fills all entries with zero when no cards provided', () => {
    const result = buildDueForecast([], now)

    expect(result.every((e) => e.dueCount === 0)).toBe(true)
  })

  it('counts cards due on their local date', () => {
    const result = buildDueForecast(
      [
        { dueAt: new Date(2026, 0, 16, 0, 0, 0) },
        { dueAt: new Date(2026, 0, 16, 8, 0, 0) },
        { dueAt: new Date(2026, 0, 20, 0, 0, 0) },
      ],
      now,
    )

    // Jan 16 = index 1, Jan 20 = index 5
    expect(result[1]?.dueCount).toBe(2)
    expect(result[5]?.dueCount).toBe(1)
  })

  it('clamps overdue cards (dueAt < now) to today (index 0)', () => {
    const result = buildDueForecast(
      [{ dueAt: new Date(2026, 0, 10, 0, 0, 0) }],
      now,
    )

    expect(result[0]?.dueCount).toBe(1)
  })

  it('ignores cards outside the 14-day window', () => {
    const result = buildDueForecast(
      [{ dueAt: new Date(2026, 0, 29, 0, 0, 0) }], // day 14 — outside window
      now,
    )

    expect(result.every((e) => e.dueCount === 0)).toBe(true)
  })
})

describe('buildWeakProblems', () => {
  it('sorts by lapses DESC, then difficulty DESC, then retrievability ASC', () => {
    const result = buildWeakProblems([
      {
        slug: 'a',
        title: 'A',
        lapseCount: 2,
        difficulty: 5,
        retrievability: 0.8,
      },
      {
        slug: 'b',
        title: 'B',
        lapseCount: 3,
        difficulty: 4,
        retrievability: 0.9,
      },
      {
        slug: 'c',
        title: 'C',
        lapseCount: 2,
        difficulty: 7,
        retrievability: 0.5,
      },
      {
        slug: 'd',
        title: 'D',
        lapseCount: 2,
        difficulty: 5,
        retrievability: 0.3,
      },
    ])

    expect(result.map((p) => p.slug)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('returns at most 10 problems', () => {
    const candidates = Array.from({ length: 15 }, (_, i) => ({
      slug: `problem-${i}`,
      title: `Problem ${i}`,
      lapseCount: i + 1,
      difficulty: 5,
      retrievability: 0.5,
    }))

    expect(buildWeakProblems(candidates)).toHaveLength(10)
  })

  it('does not mutate the input array', () => {
    const candidates = [
      {
        slug: 'a',
        title: 'A',
        lapseCount: 1,
        difficulty: 5,
        retrievability: 0.8,
      },
      {
        slug: 'b',
        title: 'B',
        lapseCount: 3,
        difficulty: 5,
        retrievability: 0.5,
      },
    ]
    const copy = [...candidates]
    buildWeakProblems(candidates)

    expect(candidates).toEqual(copy)
  })
})

describe('buildMemoryProfile', () => {
  it('computes counts and rounded average retrievability', () => {
    const result = buildMemoryProfile({
      totalTracked: 12,
      dueToday: 4,
      overdue: 2,
      learning: 1,
      review: 8,
      mastered: 2,
      suspended: 1,
      retrievabilities: [
        0.812, 0.744, 0.654, 0.913, 0.881, 0.777, 0.699, 0.955, 0.833, 0.701,
      ],
    })

    expect(result).toEqual({
      totalTracked: 12,
      dueToday: 4,
      overdue: 2,
      learning: 1,
      review: 8,
      mastered: 2,
      suspended: 1,
      averageRetrievability: 0.8,
      lowSample: false,
    })
  })

  it('returns null averageRetrievability when no samples exist', () => {
    const result = buildMemoryProfile({
      totalTracked: 3,
      dueToday: 0,
      overdue: 0,
      learning: 0,
      review: 3,
      mastered: 0,
      suspended: 0,
      retrievabilities: [],
    })

    expect(result.averageRetrievability).toBeNull()
    expect(result.lowSample).toBe(true)
  })
})

describe('buildAnalyticsSummary', () => {
  it('assembles all fields into the summary shape', () => {
    const generatedAt = new Date(2026, 0, 15, 12, 0, 0)
    const retention: RetentionProxyResult = {
      value: 0.75,
      label: '75%',
      sampleSize: 20,
      lowSample: false,
    }
    const forecast: ForecastEntry[] = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-01-${String(15 + i).padStart(2, '0')}`,
      dueCount: i,
    }))
    const memoryProfile = {
      totalTracked: 12,
      dueToday: 4,
      overdue: 2,
      learning: 1,
      review: 8,
      mastered: 2,
      suspended: 1,
      averageRetrievability: 0.8,
      lowSample: false,
    }

    const result = buildAnalyticsSummary({
      generatedAt,
      reviewDays: 10,
      totalReviews: 42,
      currentStreak: 3,
      retention,
      forecast,
      weakProblems: [],
      memoryProfile,
    })

    expect(result.generatedAt).toBe(generatedAt.toISOString())
    expect(result.reviewDays).toBe(10)
    expect(result.totalReviews).toBe(42)
    expect(result.currentStreak).toBe(3)
    expect(result.retentionProxy).toBe(0.75)
    expect(result.retentionProxyLabel).toBe('75%')
    expect(result.retentionSampleSize).toBe(20)
    expect(result.lowSample).toBe(false)
    expect(result.dueForecast14Days).toBe(forecast)
    expect(result.weakProblems).toEqual([])
    expect(result.memoryProfile).toBe(memoryProfile)
  })
})
