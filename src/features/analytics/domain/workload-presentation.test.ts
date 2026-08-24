import { describe, expect, it } from 'vitest'

import { buildSelectedAnalyticsTimeFrame } from './analytics-time'
import { buildWorkloadAnalyticsViews } from './workload-presentation'

const timeFrame = {
  asOf: '2026-08-22T12:00:00.000Z',
  timeZone: 'America/New_York',
  timeZoneFallback: false,
  requestedDays: 14 as const,
  periodStart: '2026-08-09T04:00:00.000Z',
  periodEnd: '2026-08-23T04:00:00.000Z',
  buckets: [
    {
      key: '2026-08-09',
      start: '2026-08-09T04:00:00.000Z',
      end: '2026-08-23T04:00:00.000Z',
      startKey: '2026-08-09',
      endKey: '2026-08-22',
      isPartial: true,
    },
  ],
}

describe('workload analytics presentation', () => {
  it('keeps every selected local day, preserves unknown reconstruction gaps, and reports known backlog summaries', () => {
    const views = buildWorkloadAnalyticsViews({
      overdueSnapshots: [
        { date: new Date('2026-08-10T03:59:59.999Z'), overdueCount: 0 },
        { date: new Date('2026-08-11T03:59:59.999Z'), overdueCount: 6 },
        { date: new Date('2026-08-22T12:00:00.000Z'), overdueCount: 2 },
      ],
      timeFrame,
      upcomingLoad: upcomingRows(),
    })

    expect(views.overdueBacklog.rows).toHaveLength(120)
    expect(views.overdueBacklog.rows[106]).toMatchObject({
      date: '2026-08-09',
      overdueCount: 0,
      inProgress: false,
    })
    expect(views.overdueBacklog.rows[108]).toMatchObject({
      date: '2026-08-11',
      overdueCount: null,
    })
    expect(views.overdueBacklog.rows.at(-1)).toMatchObject({
      date: '2026-08-22',
      overdueCount: 2,
      inProgress: true,
    })
    expect(views.overdueBacklog).toMatchObject({
      knownDays: 3,
      withinWatchDays: 2,
      aboveWatchDays: 1,
      currentBacklog: 2,
      peak: 6,
      selectedDays: 120,
    })
    expect(views.overdueBacklog.scale.domain[0]).toBe(0)
    expect(views.overdueBacklog.scale.domain[1]).toBeGreaterThanOrEqual(6)
  })

  it('keeps fixed forecast rows and zeroes regardless of the selected historical range', () => {
    const views = buildWorkloadAnalyticsViews({
      overdueSnapshots: [],
      timeFrame,
      upcomingLoad: upcomingRows(),
    })

    expect(
      views.overdueBacklog.rows.every((row) => row.overdueCount === null),
    ).toBe(true)
    expect(views.overdueBacklog.rows).toHaveLength(120)
    expect(views.upcomingReviewLoad.rows).toHaveLength(14)
    expect(views.upcomingReviewLoad.rows[0]).toMatchObject({
      date: '2026-08-22',
      today: true,
      overdueCount: 1,
      dueCount: 2,
    })
    expect(views.upcomingReviewLoad.rows.at(-1)?.date).toBe('2026-09-04')
  })

  it('uses the same fixed 120-day local backlog and 14-day forecast across selected frames', () => {
    const asOf = new Date('2026-03-08T05:30:00.000Z')
    const timeZone = 'America/New_York'
    const timeFrames = [90, 120, 'all'] as const
    const views = timeFrames.map((requestedRange) =>
      buildWorkloadAnalyticsViews({
        overdueSnapshots: [
          { date: new Date('2025-11-10T04:59:59.999Z'), overdueCount: 0 },
          { date: new Date('2026-03-08T05:30:00.000Z'), overdueCount: 2 },
        ],
        timeFrame: buildSelectedAnalyticsTimeFrame({
          asOf,
          requestedRange,
          allTimeStart:
            requestedRange === 'all'
              ? new Date('2024-01-01T12:00:00.000Z')
              : null,
          timeZone,
          bucketGrain: requestedRange === 'all' ? 'month' : 'week',
        }),
        upcomingLoad: upcomingRowsFrom('2026-03-08'),
      }),
    )

    expect(views[0]).toEqual(views[1])
    expect(views[1]).toEqual(views[2])
    expect(views[0]?.overdueBacklog.rows).toHaveLength(120)
    expect(views[0]?.overdueBacklog.rows[0]).toMatchObject({
      date: '2025-11-09',
      overdueCount: 0,
      inProgress: false,
    })
    expect(views[0]?.overdueBacklog.rows[1]).toMatchObject({
      date: '2025-11-10',
      overdueCount: null,
    })
    expect(views[0]?.overdueBacklog.rows.at(-1)).toMatchObject({
      date: '2026-03-08',
      overdueCount: 2,
      inProgress: true,
    })
    expect(views[0]?.upcomingReviewLoad.rows).toHaveLength(14)
    expect(views[0]?.upcomingReviewLoad.rows.map((row) => row.date)).toEqual(
      [
        '2026-03-08',
        '2026-03-09',
        '2026-03-10',
        '2026-03-11',
        '2026-03-12',
        '2026-03-13',
        '2026-03-14',
        '2026-03-15',
        '2026-03-16',
        '2026-03-17',
        '2026-03-18',
        '2026-03-19',
        '2026-03-20',
        '2026-03-21',
      ],
    )
  })
})

function upcomingRows() {
  return Array.from({ length: 14 }, (_, index) => ({
    date: `2026-${index < 10 ? '08' : '09'}-${String(index < 10 ? 22 + index : index - 9).padStart(2, '0')}`,
    dueCount: index === 0 ? 2 : 0,
    overdueCount: index === 0 ? 1 : 0,
    today: index === 0,
  }))
}

function upcomingRowsFrom(firstDate: string) {
  const firstDateAtMidnight = new Date(`${firstDate}T00:00:00.000Z`)

  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(firstDateAtMidnight)
    date.setUTCDate(date.getUTCDate() + index)
    return {
      date: date.toISOString().slice(0, 10),
      dueCount: index === 0 ? 2 : 0,
      overdueCount: index === 0 ? 1 : 0,
      today: index === 0,
    }
  })
}
