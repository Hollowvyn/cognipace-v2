import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { metricDefinitions } from '../domain/metric-definitions'

import { FragileKnowledgeTable } from './fragile-knowledge-table'

const rows = [
  {
    slug: 'graph-traversal',
    title: 'Graph Traversal',
    retrievability: 0.63,
    stabilityDays: 3.5,
    difficulty: 8.1,
    lapseCount: 2,
    overdueDays: 4,
    topics: ['Graphs', 'BFS'],
  },
]

describe('FragileKnowledgeTable', () => {
  it('explains and displays the signals for each fragile problem', () => {
    render(<FragileKnowledgeTable rows={rows} />)

    const region = screen.getByRole('region', { name: 'Fragile knowledge' })
    const table = within(region).getByRole('table')

    expect(
      within(region).getByRole('heading', {
        name: metricDefinitions.fragileKnowledge.label,
      }),
    ).toBeVisible()
    expect(
      within(region).getByText(metricDefinitions.fragileKnowledge.question),
    ).toBeVisible()
    expect(
      within(region).getByText(metricDefinitions.fragileKnowledge.explanation),
    ).toBeVisible()
    expect(
      within(region).getByText(metricDefinitions.fragileKnowledge.warning),
    ).toBeVisible()
    expect(
      within(table).getByRole('row', { name: /Graph Traversal/ }),
    ).toBeVisible()
    expect(within(table).getByText('Graphs')).toBeVisible()
    expect(within(table).getByText('63%')).toBeVisible()
    expect(within(table).getByText('3.5d')).toBeVisible()
    expect(within(table).getByText('8.1')).toBeVisible()
    expect(within(table).getByText('4d')).toBeVisible()
  })

  it('keeps the table usable on narrow layouts and handles uncategorized rows', () => {
    render(
      <FragileKnowledgeTable
        rows={[{ ...rows[0]!, topics: [], overdueDays: 0 }]}
      />,
    )

    const region = screen.getByRole('region', { name: 'Fragile knowledge' })
    expect(within(region).getByText('Uncategorized')).toBeVisible()
    expect(within(region).getByRole('table').parentElement).toHaveClass(
      'overflow-x-auto',
    )
  })

  it('renders an honest empty state without a table', () => {
    render(<FragileKnowledgeTable rows={[]} />)

    const region = screen.getByRole('region', { name: 'Fragile knowledge' })
    expect(
      within(region).getByText(/No fragile knowledge detected/),
    ).toBeVisible()
    expect(within(region).queryByRole('table')).not.toBeInTheDocument()
  })

  it('paginates five fragile rows at a time and links each problem safely', async () => {
    const user = userEvent.setup()
    const manyRows = Array.from({ length: 12 }, (_, index) => ({
      ...rows[0]!,
      slug: `graph-${index}`,
      title: `Graph ${index}`,
    }))

    render(<FragileKnowledgeTable rows={manyRows} />)

    const region = screen.getByRole('region', { name: 'Fragile knowledge' })
    expect(within(region).getAllByRole('row')).toHaveLength(6)
    expect(within(region).getByText('Showing 1–5 of 12')).toBeVisible()
    expect(
      within(region).getByRole('link', { name: 'Graph 0' }),
    ).toHaveAttribute('href', 'https://leetcode.com/problems/graph-0/')
    expect(
      within(region).getByRole('link', { name: 'Graph 0' }),
    ).toHaveAttribute('target', '_blank')
    expect(
      within(region).getByRole('link', { name: 'Graph 0' }),
    ).toHaveAttribute('rel', 'noopener noreferrer')
    expect(
      within(region).getByRole('button', { name: 'Previous page' }),
    ).toBeDisabled()

    await user.click(within(region).getByRole('button', { name: 'Next page' }))
    expect(within(region).getByText('Showing 6–10 of 12')).toBeVisible()
    expect(within(region).queryByText('Graph 0')).not.toBeInTheDocument()

    await user.click(within(region).getByRole('button', { name: 'Next page' }))
    expect(within(region).getByText('Showing 11–12 of 12')).toBeVisible()
    expect(
      within(region).getByRole('button', { name: 'Next page' }),
    ).toBeDisabled()

    await user.click(
      within(region).getByRole('button', { name: 'Previous page' }),
    )
    expect(within(region).getByText('Showing 6–10 of 12')).toBeVisible()
  })

  it('resets the page when changed rows remove the current page', async () => {
    const user = userEvent.setup()
    const manyRows = Array.from({ length: 12 }, (_, index) => ({
      ...rows[0]!,
      slug: `graph-${index}`,
      title: `Graph ${index}`,
    }))
    const { rerender } = render(<FragileKnowledgeTable rows={manyRows} />)
    const region = screen.getByRole('region', { name: 'Fragile knowledge' })

    await user.click(within(region).getByRole('button', { name: 'Next page' }))
    await user.click(within(region).getByRole('button', { name: 'Next page' }))
    expect(within(region).getByText('Showing 11–12 of 12')).toBeVisible()

    rerender(<FragileKnowledgeTable rows={manyRows.slice(0, 6)} />)
    expect(within(region).getByText('Showing 1–5 of 6')).toBeVisible()
  })
})
