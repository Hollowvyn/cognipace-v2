import { describe, expect, it } from 'vitest'

import { buildRetentionProxy, buildDueForecast } from './summary'

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
      ...Array.from({ length: 7 }, () => ({ rating: 'good', reviewedAt: recentDate })),
      ...Array.from({ length: 3 }, () => ({ rating: 'again', reviewedAt: recentDate })),
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
      ...Array.from({ length: 6 }, () => ({ rating: 'good', reviewedAt: recentDate })),
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
