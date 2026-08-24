import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { AnalyticsViews } from '../api/analytics-contracts'
import {
  BacklogTooltip,
  buildThresholdStepSegments,
  RecentOverdueBacklogView,
  UpcomingTooltip,
  UpcomingReviewLoadView,
} from './workload-views'

const overdueBacklog: AnalyticsViews['overdueBacklog'] = {
  rows: Array.from({ length: 8 }, (_, index) => ({
    date: `2026-08-${String(index + 9).padStart(2, '0')}`,
    overdueCount: index === 2 ? null : index,
    inProgress: index === 7,
  })),
  knownDays: 7,
  withinWatchDays: 5,
  aboveWatchDays: 2,
  selectedDays: 8,
  currentBacklog: 7,
  peak: 7,
  scale: { domain: [0, 10], ticks: [0, 5, 10] },
}

const upcomingReviewLoad: AnalyticsViews['upcomingReviewLoad'] = {
  rows: Array.from({ length: 14 }, (_, index) => ({
    date:
      index < 10
        ? `2026-08-${String(index + 22).padStart(2, '0')}`
        : `2026-09-${String(index - 9).padStart(2, '0')}`,
    dueCount: index === 0 ? 2 : 0,
    overdueCount: index === 0 ? 1 : 0,
    today: index === 0,
  })),
  scale: { domain: [0, 4], ticks: [0, 2, 4] },
}

describe('workload analytics views', () => {
  it('splits step segments at the 5-problem threshold in chart coordinates', () => {
    expect(
      buildThresholdStepSegments(
        [
          { x: 0, y: 10 },
          { x: 10, y: 0 },
        ],
        [4, 6],
      ),
    ).toEqual([
      { d: 'M0,10L10,10', status: 'within-watch' },
      { d: 'M10,10L10,5', status: 'within-watch' },
      { d: 'M10,5L10,0', status: 'above-watch' },
    ])
  })

  it('does not introduce green segments when every backlog value is above the threshold', () => {
    expect(
      buildThresholdStepSegments(
        [
          { x: 0, y: 2 },
          { x: 10, y: 4 },
          { x: 20, y: 6 },
        ],
        [8, 7, 6],
      ).map((segment) => segment.status),
    ).toEqual(['above-watch', 'above-watch', 'above-watch', 'above-watch'])
  })

  it('does not add a permanent marker for a single measured backlog day', () => {
    expect(buildThresholdStepSegments([{ x: 10, y: 10 }], [4])).toEqual([])
  })

  it('breaks the backlog line across unknown days instead of connecting them', () => {
    expect(
      buildThresholdStepSegments(
        [
          { x: 0, y: 10 },
          { x: 10, y: null },
          { x: 20, y: 5 },
          { x: 30, y: 0 },
        ],
        [4, null, 5, 6],
      ),
    ).toEqual([
      { d: 'M20,5L30,5', status: 'within-watch' },
      { d: 'M30,5L30,0', status: 'above-watch' },
    ])
  })

  it('keeps the backlog tooltip to date and overdue count only', () => {
    render(
      <BacklogTooltip
        active
        payload={[
          {
            payload: {
              date: '2026-08-16',
              overdueCount: 7,
              inProgress: true,
            },
          },
        ]}
      />,
    )

    expect(screen.getByText('Date: 08/16/26')).toBeVisible()
    expect(screen.getByText('Overdue problems: 7')).toBeVisible()
    expect(screen.queryByText(/status/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/daily change/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/in progress/i)).not.toBeInTheDocument()
  })

  it('renders unknown backlog days as a broken-line measure with Chart/Table parity and keyboard inspection', async () => {
    const user = userEvent.setup()
    render(<RecentOverdueBacklogView view={overdueBacklog} />)

    expect(screen.getByText(/7 known days of 8;/)).toBeVisible()
    expect(
      screen.getByText(/5 known days within the 5-problem watch zone/),
    ).toBeVisible()
    const chart = screen.getByRole('region', {
      name: 'Recent Overdue Backlog chart',
    })
    expect(chart).toHaveAttribute('aria-describedby')
    expect(chart.querySelectorAll('[tabindex="0"]')).toHaveLength(0)
    expect(screen.getByText('Within watch zone')).toBeVisible()
    expect(screen.getByText('Above watch zone')).toBeVisible()
    fireEvent.keyDown(chart, { key: 'ArrowRight' })
    expect(screen.getByRole('status')).toHaveTextContent(
      '08/10/26. 1 overdue problems',
    )

    await user.click(screen.getByRole('tab', { name: 'Table' }))
    const table = screen.getByRole('table', {
      name: 'Recent Overdue Backlog data table',
    })
    expect(within(table).getByText('Not measured')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1–7 of 8')
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(within(table).getByText('08/16/26 · In progress')).toBeVisible()
  })

  it('renders the fixed upcoming schedule with due and overdue labels, plus the exact zero state', () => {
    render(<UpcomingReviewLoadView view={upcomingReviewLoad} />)

    expect(
      screen.getByRole('region', { name: 'Upcoming Review Load chart' }),
    ).toBeVisible()
    expect(
      screen.getByRole('list', { name: 'Upcoming Review Load legend' }),
    ).toHaveTextContent('Due — solid greenOverdue — diagonally hatched pink')
    expect(
      screen.getByText(/Fixed 14-day active schedule snapshot/),
    ).toBeInTheDocument()

    const zeroView = {
      ...upcomingReviewLoad,
      rows: upcomingReviewLoad.rows.map((row) => ({
        ...row,
        dueCount: 0,
        overdueCount: 0,
      })),
    }
    const { rerender } = render(<UpcomingReviewLoadView view={zeroView} />)
    expect(
      screen.getAllByText(
        'No reviews are currently scheduled in the next 14 days.',
      ),
    ).toHaveLength(1)
    rerender(<UpcomingReviewLoadView view={upcomingReviewLoad} />)
  })

  it('keeps the upcoming tooltip and paginated table on Date, Due, and Overdue values', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <UpcomingTooltip
        active
        payload={[{ payload: upcomingReviewLoad.rows[0]! }]}
      />,
    )

    expect(screen.getByText('Date: Today, 08/22/26')).toBeVisible()
    expect(screen.getByText('Due: 2')).toBeVisible()
    expect(screen.getByText('Overdue: 1')).toBeVisible()
    unmount()

    render(<UpcomingReviewLoadView view={upcomingReviewLoad} />)
    await user.click(screen.getByRole('tab', { name: 'Table' }))
    const table = screen.getByRole('table', {
      name: 'Upcoming Review Load data table',
    })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Date', 'Due', 'Overdue'])
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1–7 of 14')
    expect(within(table).getByText('Today · 08/22/26')).toBeVisible()
    expect(within(table).getByText('2')).toBeVisible()
    expect(within(table).getByText('1')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByRole('status')).toHaveTextContent('Showing 8–14 of 14')
    expect(within(table).getByText('09/04/26')).toBeVisible()
  })
})
