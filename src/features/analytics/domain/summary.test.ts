import { describe, expect, it } from 'vitest'

import type {
  ObservedRatingQualityResult,
  ForecastEntry,
  RetentionScatterEntry,
  ReferenceCurvePoint,
} from './summary'
import {
  buildObservedRatingQuality,
  buildDueForecast,
  buildWeakProblems,
  buildAnalyticsSummary,
  buildMemoryProfile,
  buildRetentionScatter,
} from './summary'

const now = new Date(2026, 0, 15, 12, 0, 0)
const recentDate = new Date(2026, 0, 14, 12, 0, 0)
const oldDate = new Date(2025, 11, 14, 12, 0, 0) // > 30 days before now

describe('buildObservedRatingQuality', () => {
  it('returns lowSample when fewer than 10 ratings in the 30-day window', () => {
    const attempts = Array.from({ length: 9 }, () => ({
      rating: 'good',
      reviewedAt: recentDate,
    }))

    const result = buildObservedRatingQuality(attempts, now, 30)

    expect(result.lowSample).toBe(true)
    expect(result.value).toBeNull()
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

    const result = buildObservedRatingQuality(attempts, now, 30)

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

    const result = buildObservedRatingQuality(attempts, now, 30)

    expect(result.value).toBeCloseTo(0.8)
    expect(result.label).toBe('80%')
  })

  it('excludes ratings older than 30 days', () => {
    const attempts = Array.from({ length: 10 }, () => ({
      rating: 'good',
      reviewedAt: oldDate,
    }))

    const result = buildObservedRatingQuality(attempts, now, 30)

    expect(result.lowSample).toBe(true)
    expect(result.sampleSize).toBe(0)
  })

  it('boundary: exactly 10 ratings in window is not lowSample', () => {
    const attempts = Array.from({ length: 10 }, () => ({
      rating: 'good',
      reviewedAt: recentDate,
    }))

    const result = buildObservedRatingQuality(attempts, now, 30)

    expect(result.lowSample).toBe(false)
  })

  it.each([14, 30, 90] as const)(
    'uses the selected %s-day boundary',
    (range) => {
      const inside = new Date(now.getTime() - range * 24 * 60 * 60 * 1000)
      const outside = new Date(
        now.getTime() - (range + 1) * 24 * 60 * 60 * 1000,
      )
      expect(
        buildObservedRatingQuality(
          Array.from({ length: 10 }, () => ({
            rating: 'good',
            reviewedAt: inside,
          })),
          now,
          range,
        ).sampleSize,
      ).toBe(10)
      expect(
        buildObservedRatingQuality(
          [{ rating: 'good', reviewedAt: outside }],
          now,
          range,
        ).sampleSize,
      ).toBe(0)
    },
  )
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
    const retention: ObservedRatingQualityResult = {
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
      observedRatingQuality: retention,
      range: 30,
      periodStart: new Date(2025, 11, 16, 12),
      periodEnd: generatedAt,
      forecast,
      weakProblems: [],
      memoryProfile,
      targetRetention: 0.9,
      scatter: [],
      referenceCurve: [],
    })

    expect(result.generatedAt).toBe(generatedAt.toISOString())
    expect(result.reviewDays).toBe(10)
    expect(result.totalReviews).toBe(42)
    expect(result.currentStreak).toBe(3)
    expect(result.observedRatingQuality).toBe(0.75)
    expect(result.observedRatingQualityLabel).toBe('75%')
    expect(result.observedRatingSampleSize).toBe(20)
    expect(result.lowSample).toBe(false)
    expect(result.dueForecast14Days).toBe(forecast)
    expect(result.weakProblems).toEqual([])
    expect(result.memoryProfile).toBe(memoryProfile)
    expect(result.targetRetention).toBe(0.9)
    expect(result.retentionScatter).toEqual([])
    expect(result.retentionScatterCurve).toEqual([])
  })
})

describe('buildRetentionScatter', () => {
  it('sorts entries ascending by daysSinceReview', () => {
    const entries: RetentionScatterEntry[] = [
      {
        slug: 'b',
        title: 'B',
        retrievability: 0.8,
        daysSinceReview: 10,
        difficulty: 5,
        stability: 20,
        lapseCount: 0,
        lastReviewAt: '2026-01-05T12:00:00.000Z',
      },
      {
        slug: 'a',
        title: 'A',
        retrievability: 0.95,
        daysSinceReview: 2,
        difficulty: 4,
        stability: 30,
        lapseCount: 0,
        lastReviewAt: '2026-01-13T12:00:00.000Z',
      },
    ]
    const curve: ReferenceCurvePoint[] = [
      { days: 0, retrievability: 1 },
      { days: 10, retrievability: 0.7 },
    ]

    const result = buildRetentionScatter(entries, curve)

    expect(result.scatter.map((e) => e.slug)).toEqual(['a', 'b'])
  })

  it('does not mutate the input entries array', () => {
    const entries: RetentionScatterEntry[] = [
      {
        slug: 'b',
        title: 'B',
        retrievability: 0.8,
        daysSinceReview: 10,
        difficulty: 5,
        stability: 20,
        lapseCount: 0,
        lastReviewAt: '2026-01-05T12:00:00.000Z',
      },
      {
        slug: 'a',
        title: 'A',
        retrievability: 0.95,
        daysSinceReview: 2,
        difficulty: 4,
        stability: 30,
        lapseCount: 0,
        lastReviewAt: '2026-01-13T12:00:00.000Z',
      },
    ]
    const copy = [...entries]

    buildRetentionScatter(entries, [])

    expect(entries).toEqual(copy)
  })

  it('returns the referenceCurve unchanged', () => {
    const curve: ReferenceCurvePoint[] = [
      { days: 0, retrievability: 1 },
      { days: 7, retrievability: 0.9 },
    ]

    const result = buildRetentionScatter([], curve)

    expect(result.referenceCurve).toBe(curve)
  })

  it('returns empty scatter when no entries provided', () => {
    const result = buildRetentionScatter([], [])

    expect(result.scatter).toEqual([])
    expect(result.referenceCurve).toEqual([])
  })
})
