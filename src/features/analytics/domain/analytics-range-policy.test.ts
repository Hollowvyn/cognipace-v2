import { describe, expect, it } from 'vitest'

import {
  buildAnalyticsBucketsFromTimeFrame,
  selectAnalyticsLongRangePolicy,
} from './analytics-range-policy'
import { buildSelectedAnalyticsTimeFrame } from './analytics-time'

describe('analytics range policy', () => {
  it('uses Monday-start weekly buckets for the 90-day selected range', () => {
    expect(
      selectAnalyticsLongRangePolicy({
        requestedRange: 90,
        allTimeStart: null,
        asOf: new Date('2026-08-24T12:00:00.000Z'),
        timeZone: 'UTC',
      }),
    ).toEqual({ bucketGrain: 'week', calendarAnchor: 'monday' })
  })

  it('uses Monday-start weekly buckets for the 120-day selected range', () => {
    expect(
      selectAnalyticsLongRangePolicy({
        requestedRange: 120,
        allTimeStart: null,
        asOf: new Date('2026-08-24T12:00:00.000Z'),
        timeZone: 'UTC',
      }),
    ).toEqual({ bucketGrain: 'week', calendarAnchor: 'monday' })
  })

  it('uses weekly all-time buckets when the calendar span has 48 buckets', () => {
    expect(
      selectAnalyticsLongRangePolicy({
        requestedRange: 'all',
        allTimeStart: new Date('2025-09-29T12:00:00.000Z'),
        asOf: new Date('2026-08-24T12:00:00.000Z'),
        timeZone: 'UTC',
      }),
    ).toEqual({ bucketGrain: 'week', calendarAnchor: 'monday' })
  })

  it('uses Monday-anchored two-week buckets when weekly all-time span has 49 buckets', () => {
    expect(
      selectAnalyticsLongRangePolicy({
        requestedRange: 'all',
        allTimeStart: new Date('2025-09-22T12:00:00.000Z'),
        asOf: new Date('2026-08-24T12:00:00.000Z'),
        timeZone: 'UTC',
      }),
    ).toEqual({ bucketGrain: 'two-weeks', calendarAnchor: 'monday' })
  })

  it('anchors two-week buckets to Monday 1970-01-05', () => {
    expect(
      selectAnalyticsLongRangePolicy({
        requestedRange: 'all',
        allTimeStart: new Date('2024-10-28T12:00:00.000Z'),
        asOf: new Date('2026-08-24T12:00:00.000Z'),
        timeZone: 'UTC',
      }),
    ).toEqual({ bucketGrain: 'two-weeks', calendarAnchor: 'monday' })
  })

  it.each([
    ['month', '2024-10-07T12:00:00.000Z'],
    ['two-months', '2022-07-01T12:00:00.000Z'],
    ['quarter', '2018-07-01T12:00:00.000Z'],
    ['half-year', '2014-07-01T12:00:00.000Z'],
    ['year', '2002-07-01T12:00:00.000Z'],
  ] as const)(
    'falls back to %s buckets for %s all-time history',
    (bucketGrain, allTimeStart) => {
      expect(
        selectAnalyticsLongRangePolicy({
          requestedRange: 'all',
          allTimeStart: new Date(allTimeStart),
          asOf: new Date('2026-08-24T12:00:00.000Z'),
          timeZone: 'UTC',
        }),
      ).toEqual({ bucketGrain, calendarAnchor: null })
    },
  )

  it('returns no grain for all-time without a history start', () => {
    expect(
      selectAnalyticsLongRangePolicy({
        requestedRange: 'all',
        allTimeStart: null,
        asOf: new Date('2026-08-24T12:00:00.000Z'),
        timeZone: 'UTC',
      }),
    ).toEqual({ bucketGrain: null, calendarAnchor: null })
  })

  it('returns no grain when all-time history exceeds the 48-year cap', () => {
    expect(
      selectAnalyticsLongRangePolicy({
        requestedRange: 'all',
        allTimeStart: new Date('1970-01-05T12:00:00.000Z'),
        asOf: new Date('2026-08-24T12:00:00.000Z'),
        timeZone: 'UTC',
      }),
    ).toEqual({ bucketGrain: null, calendarAnchor: null })
  })

  it('converts a selected requested-zone time frame without shifting dates', () => {
    const timeFrame = buildSelectedAnalyticsTimeFrame({
      asOf: new Date('2026-03-08T05:30:00.000Z'),
      requestedRange: 90,
      allTimeStart: null,
      timeZone: 'America/New_York',
    })

    const buckets = buildAnalyticsBucketsFromTimeFrame(timeFrame)

    expect(buckets.at(-1)).toMatchObject({
      key: '2026-03-02',
      start: new Date('2026-03-02T05:00:00.000Z'),
      end: new Date('2026-03-08T05:30:00.000Z'),
      label: '2026-03-02 – 2026-03-08',
    })
    expect(buckets.at(-2)?.start.toISOString()).toBe('2026-02-23T05:00:00.000Z')
  })
})
