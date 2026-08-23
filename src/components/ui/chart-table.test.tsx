import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ChartTable } from './chart-table'

describe('ChartTable', () => {
  it('offers a visible semantic table alternative and moves focus to the selected tab', async () => {
    const user = userEvent.setup()

    render(
      <ChartTable
        chart={<div aria-label="Review trend plot" role="img" />}
        chartLabel="Chart"
        table={
          <table>
            <caption>Review trend exact values</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Reviews</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">08/22/26</th>
                <td>3</td>
              </tr>
            </tbody>
          </table>
        }
        tableLabel="Table"
      />,
    )

    const tableTab = screen.getByRole('tab', { name: 'Table' })
    expect(screen.getByRole('tablist')).toHaveAccessibleName('Chart display')
    expect(screen.getByRole('img', { name: 'Review trend plot' })).toBeVisible()

    await user.click(tableTab)

    expect(tableTab).toHaveAttribute('aria-selected', 'true')
    expect(tableTab).toHaveFocus()
    expect(screen.getByRole('table')).toBeVisible()
  })

  it('moves between tabs with symmetric wrapping arrow-key navigation', async () => {
    const user = userEvent.setup()

    render(
      <ChartTable
        chart={<div aria-label="Review trend plot" role="img" />}
        table={<table aria-label="Review trend exact values" />}
      />,
    )

    const chartTab = screen.getByRole('tab', { name: 'Chart' })
    const tableTab = screen.getByRole('tab', { name: 'Table' })

    chartTab.focus()
    await user.keyboard('{ArrowLeft}')

    expect(tableTab).toHaveAttribute('aria-selected', 'true')
    expect(tableTab).toHaveFocus()

    await user.keyboard('{ArrowRight}')

    expect(chartTab).toHaveAttribute('aria-selected', 'true')
    expect(chartTab).toHaveFocus()

    await user.keyboard('{ArrowRight}')

    expect(tableTab).toHaveAttribute('aria-selected', 'true')
    expect(tableTab).toHaveFocus()

    await user.keyboard('{ArrowLeft}')

    expect(chartTab).toHaveAttribute('aria-selected', 'true')
    expect(chartTab).toHaveFocus()
  })
})
