import { describe, expect, it } from 'vitest'

import { buildRetentionProxy } from './summary'

const now = new Date('2026-01-15T12:00:00.000Z')
const recentDate = new Date('2026-01-14T12:00:00.000Z')
const oldDate = new Date('2025-12-14T12:00:00.000Z') // > 30 days before now

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
