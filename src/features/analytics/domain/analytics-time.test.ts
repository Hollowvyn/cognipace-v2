import { describe, expect, it } from 'vitest'

import {
  buildAnalyticsTimeFrame,
  buildForecastBounds,
  resolveAnalyticsTimeZone,
  shiftAnalyticsCalendarDays,
} from './analytics-time'

describe('analytics time', () => {
  it('builds the 14-day range as daily local buckets with a partial current day', () => {
    const result = buildAnalyticsTimeFrame({
      asOf: new Date('2026-08-22T16:40:00.000Z'),
      requestedDays: 14,
      timeZone: 'America/New_York',
    })

    expect(result).toMatchObject({
      asOf: '2026-08-22T16:40:00.000Z',
      timeZone: 'America/New_York',
      timeZoneFallback: false,
      periodStart: '2026-08-09T04:00:00.000Z',
      periodEnd: '2026-08-23T04:00:00.000Z',
    })
    expect(result.buckets).toHaveLength(14)
    expect(result.buckets[0]).toMatchObject({
      key: '2026-08-09',
      startKey: '2026-08-09',
      endKey: '2026-08-09',
      isPartial: false,
    })
    expect(result.buckets.at(-1)).toMatchObject({
      key: '2026-08-22',
      startKey: '2026-08-22',
      endKey: '2026-08-22',
      isPartial: true,
    })
  })

  it('builds the 30-day range as ten anchored three-day local buckets', () => {
    const result = buildAnalyticsTimeFrame({
      asOf: new Date('2026-08-22T16:40:00.000Z'),
      requestedDays: 30,
      timeZone: 'America/New_York',
    })

    expect(result.timeZone).toBe('America/New_York')
    expect(result.timeZoneFallback).toBe(false)
    expect(result.buckets).toHaveLength(10)
    expect(result.buckets[0]).toMatchObject({
      key: '2026-07-24',
      startKey: '2026-07-24',
      endKey: '2026-07-26',
      isPartial: false,
    })
    expect(result.buckets.at(-1)).toMatchObject({
      key: '2026-08-20',
      startKey: '2026-08-20',
      endKey: '2026-08-22',
      isPartial: true,
    })
  })

  it('clips Monday-start weeks at the 90-day range boundaries', () => {
    const result = buildAnalyticsTimeFrame({
      asOf: new Date('2026-08-20T16:40:00.000Z'),
      requestedDays: 90,
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

  it('uses calendar boundaries through the spring-forward transition', () => {
    const result = buildAnalyticsTimeFrame({
      asOf: new Date('2026-03-10T16:40:00.000Z'),
      requestedDays: 14,
      timeZone: 'America/New_York',
    })

    const springForward = result.buckets.find(
      (bucket) => bucket.key === '2026-03-08',
    )
    const followingDay = result.buckets.find(
      (bucket) => bucket.key === '2026-03-09',
    )

    expect(springForward?.start).toBe('2026-03-08T05:00:00.000Z')
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
        requestedDays: 14,
        timeZone: 'Not/A_Zone',
      }),
    ).toMatchObject({
      timeZone: 'UTC',
      timeZoneFallback: true,
      periodStart: '2026-08-09T00:00:00.000Z',
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
