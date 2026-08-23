import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { MemorySignalsView, RetentionMapView } from './current-state-views'

const retentionMap = {
  rows: [
    {
      rank: 1,
      slug: 'graph-traversal',
      title: 'Graph Traversal',
      retrievability: 0.7,
      targetRetention: 0.9,
      targetGap: -0.2,
      targetDurationDays: 3,
      lastReviewedAt: '2026-08-20T12:00:00.000Z',
      dueAt: '2026-08-21T12:00:00.000Z',
      difficulty: 5,
      lapseCount: 2,
      status: 'needs-attention' as const,
      region: 'highest-attention' as const,
    },
  ],
  totalEligible: 31,
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
    render(<RetentionMapView view={retentionMap} />)

    expect(
      screen.getByText(
        'Showing the 1 highest-priority problems of 31 eligible.',
      ),
    ).toBeVisible()
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
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1–1 of 1')
  })
})
