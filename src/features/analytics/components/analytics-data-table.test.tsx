import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import {
  AnalyticsDataTable,
  type AnalyticsTableColumn,
} from './analytics-data-table'

interface Row {
  id: string
  name: string
  score: number
}

const columns: readonly AnalyticsTableColumn<Row>[] = [
  {
    id: 'name',
    header: 'Problem',
    render: (row) => row.name,
    rowHeader: true,
  },
  {
    id: 'score',
    header: 'Score',
    numeric: true,
    render: (row) => row.score,
  },
]

function createRows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `row-${index + 1}`,
    name: `Problem ${index + 1}`,
    score: index + 1,
  }))
}

function renderTable({ datasetKey = 'range-14', rows = createRows(10) } = {}) {
  return render(
    <AnalyticsDataTable
      caption="Exact problem scores"
      columns={columns}
      datasetKey={datasetKey}
      getRowKey={(row) => row.id}
      rows={rows}
    />,
  )
}

describe('AnalyticsDataTable', () => {
  it('renders the exact caption, headers, semantic row headers, and seven rows by default', () => {
    renderTable()

    const table = screen.getByRole('table', { name: 'Exact problem scores' })
    expect(within(table).getByRole('caption')).toHaveTextContent(
      'Exact problem scores',
    )
    expect(
      within(table).getByRole('columnheader', { name: 'Problem' }),
    ).toBeVisible()
    expect(
      within(table).getByRole('columnheader', { name: 'Score' }),
    ).toBeVisible()
    expect(
      within(table).getByRole('rowheader', { name: 'Problem 1' }),
    ).toBeVisible()
    expect(within(table).getByRole('cell', { name: '1' })).toHaveClass(
      'text-right',
    )
    expect(within(table).getByText('Problem 7')).toBeVisible()
    expect(within(table).queryByText('Problem 8')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1–7 of 10')
  })

  it('uses native Previous and Next buttons and resets to page one for a new dataset', async () => {
    const user = userEvent.setup()
    const view = renderTable()

    const previous = screen.getByRole('button', { name: 'Previous page' })
    const next = screen.getByRole('button', { name: 'Next page' })

    expect(previous).toBeDisabled()
    await user.click(next)
    expect(screen.getByRole('status')).toHaveTextContent('Showing 8–10 of 10')
    expect(screen.getByText('Problem 8')).toBeVisible()
    expect(next).toBeDisabled()

    view.rerender(
      <AnalyticsDataTable
        caption="Exact problem scores"
        columns={columns}
        datasetKey="range-30"
        getRowKey={(row) => row.id}
        rows={createRows(10)}
      />,
    )

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Showing 1–7 of 10',
    )
    expect(screen.getByText('Problem 1')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  })

  it('keeps empty datasets as a valid table with a calm live range announcement', () => {
    renderTable({ rows: [] })

    expect(
      screen.getByRole('table', { name: 'Exact problem scores' }),
    ).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Showing 0–0 of 0')
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })
})
