import { Bar, BarChart, type TooltipPayloadEntry } from 'recharts'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltipContent,
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
    const chart = (
      <>
        <p id="review-chart-description">
          Daily review outcomes for the selected period.
        </p>
        <ChartContainer
          aria-describedby="review-chart-description"
          accessibleDescription="Daily review outcomes for the selected period."
          accessibleName="Review quality"
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
      </>
    )

    const { rerender } = render(chart)

    const chartContainer = document.querySelector(
      '[data-chart="chart-analytics-review-quality"]',
    )

    expect(chartContainer).toBeInTheDocument()
    expect(chartContainer).toHaveAttribute(
      'aria-describedby',
      'review-chart-description',
    )
    expect(screen.getByText('Reviews')).toBeInTheDocument()
    const chartSurface = screen.getByRole('application')
    expect(chartSurface).toHaveAttribute('tabindex', '0')
    expect(chartSurface.querySelector('title')).toHaveTextContent(
      'Review quality',
    )
    expect(chartSurface.querySelector('desc')).toHaveTextContent(
      'Daily review outcomes for the selected period.',
    )

    rerender(chart)

    expect(
      document.querySelector('[data-chart="chart-analytics-review-quality"]'),
    ).toBe(chartContainer)
  })

  it('normalizes formatter tuples and omits rows when formatting returns null', () => {
    const payload: ReadonlyArray<TooltipPayloadEntry> = [
      {
        dataKey: 'reviews',
        graphicalItemId: 'reviews',
        name: 'reviews',
        value: 3,
      },
      {
        dataKey: 'skipped',
        graphicalItemId: 'skipped',
        name: 'skipped',
        value: 1,
      },
    ]

    render(
      <ChartContainer
        config={chartConfig}
        initialDimension={{ height: 180, width: 320 }}
      >
        <ChartTooltipContent
          active
          formatter={(value, name) =>
            name === 'reviews'
              ? [`${String(value)} formatted`, 'Formatted reviews']
              : null
          }
          payload={payload}
        />
      </ChartContainer>,
    )

    expect(screen.getByText('Formatted reviews')).toBeInTheDocument()
    expect(screen.getByText('3 formatted')).toBeInTheDocument()
    expect(screen.queryByText('skipped')).not.toBeInTheDocument()
  })

  it('marks the generic chart surface as non-animated when reduced motion is preferred', () => {
    const matchMedia = vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches: true,
      removeEventListener: vi.fn(),
    })
    vi.stubGlobal('matchMedia', matchMedia)

    render(
      <ChartContainer config={chartConfig} id="reduced-motion-chart">
        <BarChart data={[{ day: 'Monday', reviews: 3 }]} responsive>
          <Bar dataKey="reviews" fill="var(--color-reviews)" />
        </BarChart>
      </ChartContainer>,
    )

    expect(
      document.querySelector('[data-chart="chart-reduced-motion-chart"]'),
    ).toHaveAttribute('data-chart-animation', 'disabled')
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
  })

  it('uses deterministic initial dimensions when no size is supplied', () => {
    render(
      <ChartContainer config={chartConfig} id="default-dimensions-chart">
        <BarChart data={[{ day: 'Monday', reviews: 3 }]} responsive>
          <Bar dataKey="reviews" fill="var(--color-reviews)" />
        </BarChart>
      </ChartContainer>,
    )

    expect(
      document.querySelector(
        '[data-chart="chart-default-dimensions-chart"] svg',
      ),
    ).toHaveAttribute('width', '320')
    expect(
      document.querySelector(
        '[data-chart="chart-default-dimensions-chart"] svg',
      ),
    ).toHaveAttribute('height', '192')
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})
