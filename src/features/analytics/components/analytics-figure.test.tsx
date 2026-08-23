import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { AnalyticsEvidence } from '../domain/analytics-evidence'
import { analyticsViewCatalogue } from './charts/chart-catalogue'

import { AnalyticsFigure } from './analytics-figure'

const evidence: AnalyticsEvidence = {
  labels: ['measured'],
  sampleSize: 10,
  activeBuckets: 4,
  requestedBuckets: 5,
  effectiveBuckets: 5,
  longestGap: 0,
  gapRuns: 0,
  trendSupported: true,
}

function renderFigure(datasetKey = 'range-14') {
  return render(
    <AnalyticsFigure
      chart={<div>chart rows: 10</div>}
      datasetKey={datasetKey}
      definition={analyticsViewCatalogue['practice-rhythm']}
      details={<p>Uses eligible review ratings.</p>}
      evidence={evidence}
      table={<div>table rows: 10</div>}
      takeaway={<p>Practice and success moved together.</p>}
    />,
  )
}

describe('AnalyticsFigure', () => {
  it('switches between chart and exact table without changing rows', async () => {
    const user = userEvent.setup()
    renderFigure()

    const chartTab = screen.getByRole('tab', { name: 'Chart' })
    const tableTab = screen.getByRole('tab', { name: 'Table' })

    expect(chartTab).toHaveAttribute('aria-selected', 'true')
    expect(chartTab).toHaveAttribute(
      'aria-controls',
      'practice-rhythm-chart-panel',
    )
    expect(screen.getByText('chart rows: 10')).toBeVisible()

    await user.click(tableTab)

    expect(tableTab).toHaveAttribute('aria-selected', 'true')
    expect(tableTab).toHaveAttribute(
      'aria-controls',
      'practice-rhythm-table-panel',
    )
    expect(screen.getByText('table rows: 10')).toBeVisible()
    expect(screen.queryByText('chart rows: 10')).not.toBeVisible()
  })

  it('persists the selected view on rerender and keeps its tab focused', async () => {
    const user = userEvent.setup()
    const view = renderFigure()

    const tableTab = screen.getByRole('tab', { name: 'Table' })
    await user.click(tableTab)
    view.rerender(
      <AnalyticsFigure
        chart={<div>chart rows: 10</div>}
        datasetKey="range-30"
        definition={analyticsViewCatalogue['practice-rhythm']}
        evidence={evidence}
        table={<div>table rows: 10</div>}
        takeaway={<p>Practice and success moved together.</p>}
      />,
    )

    expect(tableTab).toHaveAttribute('aria-selected', 'true')
    expect(tableTab).toHaveFocus()
    expect(
      screen.getByRole('region', { name: 'Practice Rhythm' }),
    ).toHaveAttribute('data-dataset-key', 'range-30')
  })

  it('follows the native ARIA tabs keyboard pattern', async () => {
    const user = userEvent.setup()
    renderFigure()

    const chartTab = screen.getByRole('tab', { name: 'Chart' })
    const tableTab = screen.getByRole('tab', { name: 'Table' })
    chartTab.focus()

    await user.keyboard('{ArrowRight}')
    expect(tableTab).toHaveFocus()
    expect(tableTab).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{Home}')
    expect(chartTab).toHaveFocus()
    expect(chartTab).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{End}')
    expect(tableTab).toHaveFocus()
    expect(tableTab).toHaveAttribute('aria-selected', 'true')
  })

  it('renders the compact figure evidence, takeaway, and optional calculation details', () => {
    renderFigure()

    expect(screen.getByLabelText('Figure evidence')).toHaveTextContent(
      '10 eligible · measured',
    )
    expect(
      screen.getByText('Practice and success moved together.'),
    ).toBeVisible()
    expect(screen.getByText('Calculation details')).toBeVisible()
  })
})
