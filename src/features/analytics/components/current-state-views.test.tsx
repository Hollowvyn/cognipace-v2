import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { AnalyticsViews } from '../api/analytics-contracts'
import { MemorySignalsView, RetentionMapView } from './current-state-views'

const retentionMap: AnalyticsViews['retentionMap'] = {
  rows: [
    {
      rank: 1,
      slug: 'graph-traversal',
      title: 'Graph Traversal',
      retrievability: 0.7,
      targetRetention: 0.9,
      targetGap: -0.2,
      targetDurationDays: 3,
      lastReviewedAt: '2026-08-20T02:00:00.000Z',
      dueAt: '2026-08-21T02:00:00.000Z',
      difficulty: 5,
      lapseCount: 2,
      status: 'needs-attention' as const,
      region: 'highest-attention' as const,
    },
  ],
  totalEligible: 31,
  statusCounts: { onTarget: 12, watch: 8, needsAttention: 11 },
  recallScale: {
    domain: [0.6, 1] as [number, number],
    ticks: [0.6, 0.7, 0.8, 0.9, 1],
  },
  durationScale: { domain: [1, 10] as [number, number], ticks: [1, 10] },
  targetRetention: 0.9,
}

describe('current-state analytics views', () => {
  it('keeps Retention Map chart interactions and exact table rows in parity', async () => {
    const user = userEvent.setup()
    render(
      <RetentionMapView timeZone="America/Los_Angeles" view={retentionMap} />,
    )

    expect(
      screen.getByText(
        'Showing the 1 highest-priority problems of 31 eligible.',
      ),
    ).toBeVisible()
    expect(
      screen.getByText(
        '12 on target, 8 watch, and 11 need attention across the full eligible cohort.',
      ),
    ).toBeVisible()
    expect(
      screen.getByText(
        'Adaptive Y-scale: current recall spans 60%–100% for this eligible cohort.',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Retention Map chart' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('img', { name: 'Retention Map chart' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('list', { name: 'Retention Map regions' }),
    ).toHaveTextContent(
      /Strongest position.*On target now.*Near target, more durable.*Watch closely.*Needs attention.*Highest attention/,
    )
    const point = screen.getByRole('button', {
      name: /Graph Traversal.*Needs attention/i,
    })
    await user.hover(point)
    const preview = await screen.findByRole('status')
    expect(preview).toHaveTextContent('Current recall')
    expect(
      within(preview).getByRole('link', {
        name: 'Graph Traversal',
      }),
    ).toHaveAttribute('href', 'https://leetcode.com/problems/graph-traversal/')
    await user.click(
      screen.getByRole('button', { name: /Graph Traversal.*Needs attention/i }),
    )
    await waitFor(() =>
      expect(
        screen.getByRole('dialog', { name: 'Graph Traversal memory details' }),
      ).toBeVisible(),
    )
    await user.click(
      screen.getByRole('button', {
        name: /Close Graph Traversal memory details/,
      }),
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: /Graph Traversal.*Needs attention/i,
        }),
      ).toHaveFocus(),
    )
    fireEvent.keyDown(
      screen.getByRole('button', {
        name: /Graph Traversal.*Needs attention/i,
      }),
      { key: 'Enter' },
    )
    await waitFor(() =>
      expect(
        screen.getByRole('dialog', {
          name: 'Graph Traversal memory details',
        }),
      ).toBeVisible(),
    )
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', {
          name: 'Graph Traversal memory details',
        }),
      ).not.toBeInTheDocument(),
    )
    await user.click(screen.getByRole('tab', { name: 'Table' }))
    expect(
      screen.getByRole('rowheader', { name: 'Graph Traversal' }),
    ).toBeVisible()
    expect(
      screen.getByRole('columnheader', { name: 'Time above target' }),
    ).toBeVisible()
    expect(screen.getByText('Retention Map data table')).toBeInTheDocument()
    const retentionTable = screen.getByRole('table', {
      name: /Retention Map rows/i,
    })
    expect(within(retentionTable).getByText('08/19/26')).toBeVisible()
    expect(within(retentionTable).getByText('08/20/26')).toBeVisible()
  })

  it('renders Memory Signals as only the required three-column diagnostic table', async () => {
    const user = userEvent.setup()
    render(
      <MemorySignalsView
        view={{
          totalQualifying: 1,
          rows: [
            {
              rank: 1,
              slug: 'graph-traversal',
              title: 'Graph Traversal',
              reasons: [
                { kind: 'below-recall', label: 'Below recall 70%' },
                { kind: 'overdue', label: '1d overdue' },
                { kind: 'low-durability', label: 'Low durability 3d' },
              ],
            },
          ],
        }}
      />,
    )

    const table = screen.getByRole('table', { name: /Memory Signals rows/i })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Rank', 'Problem', "Why it's here"])
    expect(
      within(table).getByRole('link', { name: 'Graph Traversal' }),
    ).toHaveAttribute('target', '_blank')
    expect(screen.queryByRole('tab', { name: 'Chart' })).not.toBeInTheDocument()
    expect(screen.getByText('Below recall 70%')).toBeVisible()
    expect(screen.getByText('Low durability 3d')).toBeVisible()
    expect(
      screen.getByText('Memory Signals by Problem data table'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1–1 of 1')
  })

  it('returns to page one when retained rows refresh', async () => {
    const user = userEvent.setup()
    const rows = Array.from({ length: 8 }, (_, index) => ({
      ...retentionMap.rows[0]!,
      rank: index + 1,
      slug: `problem-${index + 1}`,
      title: `Problem ${index + 1}`,
    }))
    const { rerender } = render(
      <RetentionMapView
        view={{
          ...retentionMap,
          rows,
          totalEligible: 8,
          statusCounts: { onTarget: 0, watch: 0, needsAttention: 8 },
        }}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'Table' }))
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByRole('status')).toHaveTextContent('Showing 8–8 of 8')

    rerender(
      <RetentionMapView
        view={{
          ...retentionMap,
          rows: rows.map((row) => ({ ...row, title: `Refreshed ${row.rank}` })),
          totalEligible: 8,
          statusCounts: { onTarget: 0, watch: 0, needsAttention: 8 },
        }}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Showing 1–7 of 8')
    expect(screen.getByRole('rowheader', { name: 'Refreshed 1' })).toBeVisible()
  })

  it('keeps scatter keyboard order aligned with retained rank across statuses', () => {
    render(
      <RetentionMapView
        view={{
          ...retentionMap,
          rows: [
            { ...retentionMap.rows[0]!, rank: 1, title: 'Risk' },
            {
              ...retentionMap.rows[0]!,
              rank: 2,
              slug: 'watch',
              title: 'Watch',
              status: 'watch',
              region: 'watch-closely',
            },
            {
              ...retentionMap.rows[0]!,
              rank: 3,
              slug: 'on-target',
              title: 'On target',
              status: 'on-target',
              region: 'on-target-now',
            },
          ],
          totalEligible: 3,
          statusCounts: { onTarget: 1, watch: 1, needsAttention: 1 },
        }}
      />,
    )

    expect(
      screen
        .getAllByRole('button')
        .filter((button) => button.hasAttribute('data-retention-map-point'))
        .map((button) => button.getAttribute('data-retention-map-point')),
    ).toEqual(['graph-traversal', 'watch', 'on-target'])
  })
})
