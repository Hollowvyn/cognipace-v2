import { describe, expect, it } from 'vitest'

import type { ObservedRatingQualityResult } from './summary'
import { buildSelectedAnalyticsTimeFrame } from './analytics-time'
import { buildObservedRatingQuality, buildAnalyticsSummary } from './summary'

const now = new Date(2026, 0, 15, 12, 0, 0)
const recentDate = new Date(2026, 0, 14, 12, 0, 0)
const oldDate = new Date(2025, 9, 14, 12, 0, 0) // > 90 days before now

describe('buildObservedRatingQuality', () => {
  it('returns lowSample when fewer than 10 ratings in the 90-day window', () => {
    const attempts = Array.from({ length: 9 }, () => ({
      rating: 'good',
      reviewedAt: recentDate,
    }))

    const result = buildObservedRatingQuality(attempts, now, 90)

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

    const result = buildObservedRatingQuality(attempts, now, 90)

    expect(result.lowSample).toBe(false)
    expect(result.value).toBeCloseTo(0.7)
    expect(result.label).toBe('70%')
    expect(result.sampleSize).toBe(10)
  })

  it('excludes invalid persisted ratings from the observed rating sample', () => {
    const attempts = [
      ...Array.from({ length: 10 }, () => ({
        rating: 'good',
        reviewedAt: recentDate,
      })),
      ...Array.from({ length: 10 }, () => ({
        rating: 'unexpected-rating',
        reviewedAt: recentDate,
      })),
    ]

    const result = buildObservedRatingQuality(attempts, now, 90)

    expect(result).toMatchObject({
      value: 1,
      sampleSize: 10,
      lowSample: false,
    })
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

    const result = buildObservedRatingQuality(attempts, now, 90)

    expect(result.value).toBeCloseTo(0.8)
    expect(result.label).toBe('80%')
  })

  it('excludes ratings older than 90 days', () => {
    const attempts = Array.from({ length: 10 }, () => ({
      rating: 'good',
      reviewedAt: oldDate,
    }))

    const result = buildObservedRatingQuality(attempts, now, 90)

    expect(result.lowSample).toBe(true)
    expect(result.sampleSize).toBe(0)
  })

  it('boundary: exactly 10 ratings in window is not lowSample', () => {
    const attempts = Array.from({ length: 10 }, () => ({
      rating: 'good',
      reviewedAt: recentDate,
    }))

    const result = buildObservedRatingQuality(attempts, now, 90)

    expect(result.lowSample).toBe(false)
  })

  it('includes a rating at the period end and excludes one just after it', () => {
    const atEnd = Array.from({ length: 10 }, () => ({
      rating: 'good',
      reviewedAt: now,
    }))
    const justAfterEnd = {
      rating: 'again',
      reviewedAt: new Date(now.getTime() + 1),
    }

    const result = buildObservedRatingQuality([...atEnd, justAfterEnd], now, 90)

    expect(result.sampleSize).toBe(10)
    expect(result.value).toBe(1)
    expect(result.lowSample).toBe(false)
  })

  it.each([90, 120] as const)('uses the selected %s-day boundary', (range) => {
    const inside = new Date(now.getTime() - range * 24 * 60 * 60 * 1000)
    const outside = new Date(now.getTime() - (range + 1) * 24 * 60 * 60 * 1000)
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
  })

  it('uses canonical local frame bounds across a DST midnight', () => {
    const asOf = new Date('2026-03-08T05:30:00.000Z')
    const frame = buildSelectedAnalyticsTimeFrame({
      asOf,
      requestedRange: 90,
      allTimeStart: null,
      timeZone: 'America/New_York',
    })
    const result = buildObservedRatingQuality(
      Array.from({ length: 10 }, () => ({
        rating: 'good',
        reviewedAt: new Date('2025-12-09T04:59:59.999Z'),
      })),
      asOf,
      90,
      {
        periodStart: new Date(frame.periodStart!),
        periodEnd: new Date(frame.periodEnd),
      },
    )

    expect(result.sampleSize).toBe(0)
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
    const result = buildAnalyticsSummary({
      generatedAt,
      timeFrame: buildSelectedAnalyticsTimeFrame({
        asOf: generatedAt,
        requestedRange: 90,
        allTimeStart: null,
        timeZone: 'UTC',
      }),
      reviewDays: 10,
      totalReviews: 42,
      currentStreak: 3,
      observedRatingQuality: retention,
      range: 90,
      targetRetention: 0.9,
    })

    expect(result.generatedAt).toBe(generatedAt.toISOString())
    expect(result.reviewDays).toBe(10)
    expect(result.totalReviews).toBe(42)
    expect(result.currentStreak).toBe(3)
    expect(result.observedRatingQuality).toBe(0.75)
    expect(result.observedRatingQualityLabel).toBe('75%')
    expect(result.observedRatingSampleSize).toBe(20)
    expect(result.lowSample).toBe(false)
    expect(result.targetRetention).toBe(0.9)
    expect(result.range).toBe(90)
    expect(result.timeFrame.requestedRange).toBe(90)
    expect(result.views.observedRecallVsFsrs.evidence).toEqual({
      historyDays: 0,
      measuredBuckets: 0,
      observations: 0,
      selectedBucketCount: 0,
      tableOnly: true,
      displayMode: 'table',
      supportsLine: false,
      supportsDirection: false,
    })
    expect(result).not.toHaveProperty('historicalReadiness')
  })

  it('keeps all-time range and evidence views explicit in the summary', () => {
    const result = buildAnalyticsSummary({
      generatedAt: now,
      timeFrame: buildSelectedAnalyticsTimeFrame({
        asOf: now,
        requestedRange: 'all',
        allTimeStart: null,
        timeZone: 'UTC',
      }),
      reviewDays: 0,
      totalReviews: 0,
      currentStreak: 0,
      observedRatingQuality: {
        value: null,
        label: '—',
        sampleSize: 0,
        lowSample: true,
      },
      range: 'all',
      targetRetention: 0.9,
    })

    expect(result.range).toBe('all')
    expect(result.timeFrame).toMatchObject({
      requestedRange: 'all',
      periodStart: null,
      buckets: [],
    })
    expect(result.views.ratingsMix.evidence.selectedBucketCount).toBe(0)
  })
})
