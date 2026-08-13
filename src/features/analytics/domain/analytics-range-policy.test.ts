import { describe, expect, it } from 'vitest'

import {
  buildAnalyticsBuckets,
  getAnalyticsRangePolicy,
} from './analytics-range-policy'

describe('analytics range policy', () => {
  it.each([
    [7, 1],
    [14, 1],
    [30, 3],
    [90, 7],
    [120, 14],
  ])('uses readable buckets for %s days', (requestedDays, bucketDays) => {
    expect(getAnalyticsRangePolicy(requestedDays).bucketDays).toBe(bucketDays)
  })

  it('builds inclusive 14-day daily boundaries without an extra point', () => {
    const buckets = buildAnalyticsBuckets({
      requestedDays: 14,
      periodEnd: new Date('2026-08-13T12:00:00.000Z'),
    })

    expect(buckets).toHaveLength(14)
    expect(buckets[0]?.start.toISOString()).toBe(
      '2026-07-31T00:00:00.000Z',
    )
    expect(buckets.at(-1)?.end.toISOString()).toBe(
      '2026-08-13T23:59:59.999Z',
    )
  })

  it('keeps partial calendar-week boundaries in the selected 90-day period', () => {
    const buckets = buildAnalyticsBuckets({
      requestedDays: 90,
      periodEnd: new Date('2026-08-13T12:00:00.000Z'),
    })

    expect(buckets[0]!.start >= new Date('2026-05-16T00:00:00.000Z')).toBe(
      true,
    )
    expect(buckets.at(-1)?.end.toISOString()).toBe(
      '2026-08-13T23:59:59.999Z',
    )
    expect(buckets.every((bucket) => bucket.start <= bucket.end)).toBe(true)
  })
})
