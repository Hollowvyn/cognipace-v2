import { describe, expect, it } from 'vitest'

import {
  buildAnalyticsBucketsFromTimeFrame,
  getAnalyticsRangePolicy,
} from './analytics-range-policy'
import { buildAnalyticsTimeFrame } from './analytics-time'

describe('analytics range policy', () => {
  it.each([0, -1, 1.5, 7, 120, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects unsupported requested day count %s',
    (requestedDays) => {
      expect(() => getAnalyticsRangePolicy(requestedDays)).toThrow(RangeError)
    },
  )

  it.each([
    [14, 1],
    [30, 3],
    [90, 7],
  ])('uses readable buckets for %s days', (requestedDays, bucketDays) => {
    expect(getAnalyticsRangePolicy(requestedDays).bucketDays).toBe(bucketDays)
  })

  it('converts one requested-zone time frame into legacy buckets without shifting dates', () => {
    const timeFrame = buildAnalyticsTimeFrame({
      asOf: new Date('2026-03-08T05:30:00.000Z'),
      requestedDays: 14,
      timeZone: 'America/New_York',
    })

    const buckets = buildAnalyticsBucketsFromTimeFrame(timeFrame)

    expect(buckets.at(-1)).toMatchObject({
      key: '2026-03-08',
      start: new Date('2026-03-08T05:00:00.000Z'),
      end: new Date('2026-03-08T05:30:00.000Z'),
      label: '2026-03-08',
    })
    expect(buckets.at(-2)?.start.toISOString()).toBe('2026-03-07T05:00:00.000Z')
  })
})
