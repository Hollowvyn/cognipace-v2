import type { AnalyticsOverdueSnapshot, UpcomingLoadPoint } from './chart-data'
import { buildMagnitudeScale, type AnalyticsScale } from './analytics-scales'
import {
  addAnalyticsCalendarDays,
  getAnalyticsDateKey,
  type AnalyticsTimeFrame,
  type SelectedAnalyticsTimeFrame,
} from './analytics-time'

export interface WorkloadAnalyticsViews {
  overdueBacklog: {
    rows: OverdueBacklogRow[]
    knownDays: number
    withinWatchDays: number
    aboveWatchDays: number
    selectedDays: number
    currentBacklog: number | null
    peak: number | null
    scale: AnalyticsScale
  }
  upcomingReviewLoad: {
    rows: UpcomingReviewLoadRow[]
    scale: AnalyticsScale
  }
}

export interface OverdueBacklogRow {
  date: string
  overdueCount: number | null
  inProgress: boolean
}

export interface UpcomingReviewLoadRow {
  date: string
  dueCount: number
  overdueCount: number
  today: boolean
}

export function buildWorkloadAnalyticsViews({
  overdueSnapshots,
  timeFrame,
  upcomingLoad,
}: {
  overdueSnapshots: readonly AnalyticsOverdueSnapshot[]
  timeFrame: AnalyticsTimeFrame | SelectedAnalyticsTimeFrame
  upcomingLoad: readonly UpcomingLoadPoint[]
}): WorkloadAnalyticsViews {
  const overdueRows = buildOverdueBacklogRows(overdueSnapshots, timeFrame)
  const knownCounts = overdueRows.flatMap((row) =>
    row.overdueCount === null ? [] : [row.overdueCount],
  )
  const currentRow = overdueRows.at(-1)
  const upcomingRows = upcomingLoad.map((row) => ({ ...row }))

  return {
    overdueBacklog: {
      rows: overdueRows,
      knownDays: knownCounts.length,
      withinWatchDays: knownCounts.filter((count) => count <= 5).length,
      aboveWatchDays: knownCounts.filter((count) => count > 5).length,
      selectedDays: overdueRows.length,
      currentBacklog: currentRow?.overdueCount ?? null,
      peak: knownCounts.length === 0 ? null : Math.max(...knownCounts),
      scale: buildMagnitudeScale(knownCounts, 5),
    },
    upcomingReviewLoad: {
      rows: upcomingRows,
      scale: buildMagnitudeScale(
        upcomingRows.map((row) => row.dueCount + row.overdueCount),
      ),
    },
  }
}

function buildOverdueBacklogRows(
  snapshots: readonly AnalyticsOverdueSnapshot[],
  timeFrame: AnalyticsTimeFrame | SelectedAnalyticsTimeFrame,
): OverdueBacklogRow[] {
  const lastKey = getAnalyticsDateKey(
    new Date(timeFrame.asOf),
    timeFrame.timeZone,
  )
  const firstKey = addAnalyticsCalendarDays(lastKey, -119)

  const snapshotsByDate = new Map(
    snapshots.map((snapshot) => [
      getAnalyticsDateKey(snapshot.date, timeFrame.timeZone),
      snapshot.overdueCount,
    ]),
  )
  const rows: OverdueBacklogRow[] = []
  for (
    let date = firstKey;
    date <= lastKey;
    date = addAnalyticsCalendarDays(date, 1)
  ) {
    rows.push({
      date,
      overdueCount: snapshotsByDate.get(date) ?? null,
      inProgress: date === lastKey,
    })
  }
  return rows
}
