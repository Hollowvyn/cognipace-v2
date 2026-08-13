import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

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
      within(region).getByText(
        /predicted retrievability, stability, overdue gap/,
      ),
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

  it('shows a compact initial list with an accessible expansion control', async () => {
    const user = userEvent.setup()
    const manyRows = Array.from({ length: 11 }, (_, index) => ({
      ...rows[0]!,
      slug: `graph-${index}`,
      title: `Graph ${index}`,
    }))

    render(<FragileKnowledgeTable rows={manyRows} />)

    const region = screen.getByRole('region', { name: 'Fragile knowledge' })
    expect(
      within(region).getByText('Showing 10 of 11 fragile problems.'),
    ).toBeVisible()
    expect(within(region).queryByText('Graph 10')).not.toBeInTheDocument()

    const button = within(region).getByRole('button', { name: 'Show 1 more' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await user.click(button)
    expect(within(region).getByText('Graph 10')).toBeVisible()
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })
})
