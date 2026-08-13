import { render, screen, waitFor } from '@testing-library/react'
import { LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { describe, expect, it } from 'vitest'

import { analyticsChartDefinitions } from './chart-definitions'
import { AnalyticsChartLegendItem } from './chart-shared'
import { LineSegments } from './line-segments'

function TooltipProbe({
  active,
  payload,
}: {
  active?: boolean
  payload?: readonly { name?: string | number; type?: string }[]
}) {
  const visibleItems = active
    ? (payload?.filter((item) => item.type !== 'none') ?? [])
    : []

  return (
    <output data-testid="line-segments-tooltip">
      {visibleItems.map((item) => item.name).join(',')}
    </output>
  )
}

describe('LineSegments in a Recharts line chart', () => {
  it('keeps physical fragments out of Recharts legend and tooltip payloads', async () => {
    render(
      <div>
        <LineChart
          data={[
            { bucket: 'Aug 01', value: 0.8 },
            { bucket: 'Aug 02', value: null },
            { bucket: 'Aug 03', value: 0.84 },
          ]}
          height={240}
          width={480}
        >
          <XAxis dataKey="bucket" />
          <YAxis domain={[0, 1]} />
          <Tooltip active content={<TooltipProbe />} defaultIndex={1} />
          <LineSegments
            data={[
              { bucket: 'Aug 01', value: 0.8 },
              { bucket: 'Aug 02', value: null },
              { bucket: 'Aug 03', value: 0.84 },
            ]}
            dataKey="value"
            maximumGap={2}
            seriesKey="observedCorrectness"
            stroke="var(--cp-analytics-observed)"
          />
        </LineChart>
        <div aria-label="Chart legend" role="list">
          <AnalyticsChartLegendItem
            item={analyticsChartDefinitions.practiceRhythm.series[1]}
          />
        </div>
      </div>,
    )

    const bridge = await screen.findByTestId('observedCorrectness-bridge-0-2')

    expect(bridge).toHaveAttribute('stroke-dasharray', '5 5')
    expect(document.querySelectorAll('circle')).toHaveLength(0)
    expect(screen.getAllByText('Observed correctness')).toHaveLength(1)

    await waitFor(() => {
      expect(screen.getByTestId('line-segments-tooltip')).toBeEmptyDOMElement()
    })
  })
})
