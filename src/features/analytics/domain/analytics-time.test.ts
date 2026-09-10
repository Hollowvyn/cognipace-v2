import { describe, expect, it } from 'vitest'

import {
  buildForecastBounds,
  buildAnalyticsTimeFrame,
  resolveAnalyticsTimeZone,
  shiftAnalyticsCalendarDays,
} from './analytics-time'

describe('analytics time', () => {
  it('clips Monday-start weeks at the 90-day range boundaries', () => {
    const result = buildAnalyticsTimeFrame({
      asOf: new Date('2026-08-20T16:40:00.000Z'),
      requestedRange: 90,
      allTimeStart: null,
      timeZone: 'America/New_York',
    })

    expect(result.buckets[0]).toMatchObject({
      key: '2026-05-23',
      startKey: '2026-05-23',
      endKey: '2026-05-24',
    })
    expect(result.buckets.at(-1)).toMatchObject({
      key: '2026-08-17',
      startKey: '2026-08-17',
      endKey: '2026-08-20',
      isPartial: true,
    })
  })

  it('builds 90 local dates through spring-forward as clipped Monday weeks', () => {
    const result = buildAnalyticsTimeFrame({
      asOf: new Date('2026-03-10T16:40:00.000Z'),
      requestedRange: 90,
      allTimeStart: null,
      timeZone: 'America/New_York',
    })

    expect(result).toMatchObject({
      requestedRange: 90,
      bucketGrain: 'week',
      periodStart: '2025-12-11T05:00:00.000Z',
      periodEnd: '2026-03-11T04:00:00.000Z',
    })
    expect(result.buckets).toHaveLength(14)
    expect(result.buckets[0]).toMatchObject({
      startKey: '2025-12-11',
      endKey: '2025-12-14',
      start: '2025-12-11T05:00:00.000Z',
      end: '2025-12-15T05:00:00.000Z',
      isPartial: false,
    })
    expect(result.buckets.at(-1)).toMatchObject({
      startKey: '2026-03-09',
      endKey: '2026-03-10',
      start: '2026-03-09T04:00:00.000Z',
      end: '2026-03-11T04:00:00.000Z',
      isPartial: true,
    })
  })

  it('builds 120 local dates through fall-back as clipped Monday weeks', () => {
    const result = buildAnalyticsTimeFrame({
      asOf: new Date('2026-11-01T16:40:00.000Z'),
      requestedRange: 120,
      allTimeStart: null,
      timeZone: 'America/New_York',
    })

    expect(result).toMatchObject({
      requestedRange: 120,
      bucketGrain: 'week',
      periodStart: '2026-07-05T04:00:00.000Z',
      periodEnd: '2026-11-02T05:00:00.000Z',
    })
    expect(result.buckets).toHaveLength(18)
    expect(result.buckets[0]).toMatchObject({
      startKey: '2026-07-05',
      endKey: '2026-07-05',
      isPartial: false,
    })
    expect(result.buckets.at(-1)).toMatchObject({
      startKey: '2026-10-26',
      endKey: '2026-11-01',
      start: '2026-10-26T04:00:00.000Z',
      end: '2026-11-02T05:00:00.000Z',
      isPartial: true,
    })
  })

  it('uses the explicit earliest valid rating local date for All time', () => {
    const result = buildAnalyticsTimeFrame({
      asOf: new Date('2026-03-10T16:40:00.000Z'),
      requestedRange: 'all',
      allTimeStart: new Date('2026-03-08T04:30:00.000Z'),
      timeZone: 'America/New_York',
    })

    expect(result).toMatchObject({
      requestedRange: 'all',
      bucketGrain: 'week',
      periodStart: '2026-03-07T05:00:00.000Z',
      periodEnd: '2026-03-11T04:00:00.000Z',
    })
    expect(result.buckets).toEqual([
      expect.objectContaining({
        startKey: '2026-03-07',
        endKey: '2026-03-08',
        isPartial: false,
      }),
      expect.objectContaining({
        startKey: '2026-03-09',
        endKey: '2026-03-10',
        isPartial: true,
      }),
    ])
  })

  it('does not invent a period for empty All time', () => {
    expect(
      buildAnalyticsTimeFrame({
        asOf: new Date('2026-03-10T16:40:00.000Z'),
        requestedRange: 'all',
        allTimeStart: null,
        timeZone: 'America/New_York',
      }),
    ).toMatchObject({
      requestedRange: 'all',
      bucketGrain: 'week',
      periodStart: null,
      periodEnd: '2026-03-11T04:00:00.000Z',
      buckets: [],
    })
  })

  it('marks unrepresentable All-time history unsupported instead of falling back to weeks', () => {
    expect(
      buildAnalyticsTimeFrame({
        asOf: new Date('2026-08-24T12:00:00.000Z'),
        requestedRange: 'all',
        allTimeStart: new Date('1970-01-05T12:00:00.000Z'),
        timeZone: 'UTC',
        bucketGrain: null,
      }),
    ).toMatchObject({
      bucketGrain: null,
      allTimeUnsupported: true,
      periodStart: null,
      buckets: [],
    })
  })

  it('uses calendar boundaries through the spring-forward transition', () => {
    const result = buildAnalyticsTimeFrame({
      asOf: new Date('2026-03-10T16:40:00.000Z'),
      requestedRange: 90,
      allTimeStart: null,
      timeZone: 'America/New_York',
    })

    const springForward = result.buckets.find(
      (bucket) => bucket.endKey === '2026-03-08',
    )
    const followingDay = result.buckets.find(
      (bucket) => bucket.key === '2026-03-09',
    )

    expect(springForward?.end).toBe('2026-03-09T04:00:00.000Z')
    expect(followingDay?.start).toBe('2026-03-09T04:00:00.000Z')
  })

  it('uses UTC visibly when an IANA zone is invalid', () => {
    expect(resolveAnalyticsTimeZone('Not/A_Zone')).toEqual({
      timeZone: 'UTC',
      fallback: true,
    })

    expect(
      buildAnalyticsTimeFrame({
        asOf: new Date('2026-08-22T16:40:00.000Z'),
        requestedRange: 90,
        allTimeStart: null,
        timeZone: 'Not/A_Zone',
      }),
    ).toMatchObject({
      timeZone: 'UTC',
      timeZoneFallback: true,
      periodStart: '2026-05-25T00:00:00.000Z',
    })
  })

  it('builds the 14-day forecast as a half-open local calendar interval', () => {
    expect(
      buildForecastBounds({
        asOf: new Date('2026-11-01T16:40:00.000Z'),
        timeZone: 'America/New_York',
      }),
    ).toEqual({
      todayKey: '2026-11-01',
      start: '2026-11-01T04:00:00.000Z',
      end: '2026-11-15T05:00:00.000Z',
    })
  })

  it('shifts a wall-clock timestamp by local calendar days across DST', () => {
    expect(
      shiftAnalyticsCalendarDays(
        new Date('2026-03-08T05:30:00.000Z'),
        -14,
        'America/New_York',
      ),
    ).toEqual(new Date('2026-02-22T05:30:00.000Z'))
  })

  it('preserves milliseconds when shifting a wall-clock timestamp', () => {
    expect(
      shiftAnalyticsCalendarDays(
        new Date('2026-03-08T05:30:00.123Z'),
        -14,
        'America/New_York',
      ),
    ).toEqual(new Date('2026-02-22T05:30:00.123Z'))
  })
})
