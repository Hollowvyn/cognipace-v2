import { describe, expect, it } from 'vitest'

import {
  buildAnalyticsBuckets,
  getAnalyticsRangePolicy,
} from './analytics-range-policy'

describe('analytics range policy', () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid requested day count %s',
    (requestedDays) => {
      expect(() => getAnalyticsRangePolicy(requestedDays)).toThrow(RangeError)
    },
  )

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
    expect(buckets[0]?.start.toISOString()).toBe('2026-07-31T00:00:00.000Z')
    expect(buckets.at(-1)?.end.toISOString()).toBe('2026-08-13T23:59:59.999Z')
  })

  it('keeps partial calendar-week boundaries in the selected 90-day period', () => {
    const buckets = buildAnalyticsBuckets({
      requestedDays: 90,
      periodEnd: new Date('2026-08-13T12:00:00.000Z'),
    })

    expect(buckets[0]!.start >= new Date('2026-05-16T00:00:00.000Z')).toBe(true)
    expect(buckets.at(-1)?.end.toISOString()).toBe('2026-08-13T23:59:59.999Z')
    expect(buckets.every((bucket) => bucket.start <= bucket.end)).toBe(true)
  })

  it('rejects an invalid period end', () => {
    expect(() =>
      buildAnalyticsBuckets({
        requestedDays: 14,
        periodEnd: new Date(Number.NaN),
      }),
    ).toThrow(RangeError)
  })

  it('progresses through a spring-forward boundary using local calendar days', () => {
    const previousTimezone = process.env.TZ
    process.env.TZ = 'America/New_York'

    try {
      const buckets = buildAnalyticsBuckets({
        requestedDays: 7,
        periodEnd: new Date('2026-03-10T12:00:00'),
      })

      expect(buckets.map((bucket) => [bucket.key, bucket.label])).toEqual([
        ['2026-03-04', '2026-03-04'],
        ['2026-03-05', '2026-03-05'],
        ['2026-03-06', '2026-03-06'],
        ['2026-03-07', '2026-03-07'],
        ['2026-03-08', '2026-03-08'],
        ['2026-03-09', '2026-03-09'],
        ['2026-03-10', '2026-03-10'],
      ])
      expect(buckets[5]!.start.getTime() - buckets[4]!.start.getTime()).toBe(
        23 * 60 * 60 * 1000,
      )
      expect(
        buckets.every(
          (bucket, index) =>
            index === 0 ||
            bucket.start.getDate() === buckets[index - 1]!.start.getDate() + 1,
        ),
      ).toBe(true)
    } finally {
      if (previousTimezone === undefined) {
        delete process.env.TZ
      } else {
        process.env.TZ = previousTimezone
      }
    }
  })
})
