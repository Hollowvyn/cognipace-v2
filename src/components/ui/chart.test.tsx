import { Bar, BarChart } from 'recharts'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from './chart'

const chartConfig = {
  reviews: {
    label: 'Reviews',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

describe('Chart primitive', () => {
  it('provides stable identity, configured labels, and an accessible description', () => {
    render(
      <>
        <p id="review-chart-description">
          Daily review outcomes for the selected period.
        </p>
        <ChartContainer
          aria-describedby="review-chart-description"
          config={chartConfig}
          id="analytics-review-quality"
          initialDimension={{ height: 180, width: 320 }}
        >
          <BarChart
            accessibilityLayer
            data={[{ day: 'Monday', reviews: 3 }]}
            responsive
          >
            <Bar dataKey="reviews" fill="var(--color-reviews)" />
            <ChartLegend
              content={
                <ChartLegendContent
                  payload={[
                    {
                      color: 'var(--chart-1)',
                      dataKey: 'reviews',
                      type: 'square',
                      value: 'reviews',
                    },
                  ]}
                />
              }
            />
          </BarChart>
        </ChartContainer>
      </>,
    )

    const chart = document.querySelector(
      '[data-chart="chart-analytics-review-quality"]',
    )

    expect(chart).toBeInTheDocument()
    expect(chart).toHaveAttribute(
      'aria-describedby',
      'review-chart-description',
    )
    expect(screen.getByText('Reviews')).toBeInTheDocument()
  })
})
