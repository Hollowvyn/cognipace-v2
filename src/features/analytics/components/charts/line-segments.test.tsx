import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

function stringifySvgAttribute(value: unknown): string {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? String(value)
    : ''
}

vi.mock('recharts', () => ({
  Line: (props: Record<string, unknown>) => {
    const strokeDasharray = props.strokeDasharray
    const data = Array.isArray(props.data) ? props.data : []
    const dataKey = props.dataKey
    const values = data.map((point) => {
      return typeof dataKey === 'string' && point && typeof point === 'object'
        ? (point as Record<string, unknown>)[dataKey]
        : null
    })

    return (
      <path
        data-connect-nulls={stringifySvgAttribute(props.connectNulls ?? false)}
        data-has-connect-nulls={String(Object.hasOwn(props, 'connectNulls'))}
        data-key-type={typeof props.dataKey}
        data-has-tooltip-type={String(Object.hasOwn(props, 'tooltipType'))}
        data-legend-type={stringifySvgAttribute(props.legendType)}
        data-testid={stringifySvgAttribute(props['data-testid'])}
        data-tooltip-type={stringifySvgAttribute(props.tooltipType)}
        data-values={JSON.stringify(values)}
        stroke={stringifySvgAttribute(props.stroke)}
        {...(strokeDasharray === undefined
          ? {}
          : { strokeDasharray: stringifySvgAttribute(strokeDasharray) })}
      />
    )
  },
}))

import { DASHED_LINE_EVIDENCE_LABEL, LineSegments } from './line-segments'

function renderSegments(values: Array<number | null>, maximumGap = 2) {
  render(
    <svg>
      <LineSegments
        data={values.map((value, index) => ({ index, value }))}
        dataKey="value"
        maximumGap={maximumGap}
        seriesKey="observedCorrectness"
        stroke="var(--cp-analytics-observed)"
      />
    </svg>,
  )
}

describe('LineSegments', () => {
  it('renders adjacent measured values as a solid Recharts line', () => {
    renderSegments([0.8, 0.84])

    const solid = screen.getByTestId('observedCorrectness-solid-0-1')
    expect(solid).toHaveAttribute('stroke', 'var(--cp-analytics-observed)')
    expect(solid).not.toHaveAttribute('stroke-dasharray')
    expect(solid).toHaveAttribute('data-connect-nulls', 'false')
    expect(solid).toHaveAttribute('data-has-connect-nulls', 'false')
    expect(solid).toHaveAttribute('data-legend-type', 'none')
    expect(solid).toHaveAttribute('data-tooltip-type', 'none')
    expect(solid).toHaveAttribute('data-values', '[0.8,0.84]')
  })

  it('renders one permitted null gap as a dashed endpoint-to-endpoint bridge', () => {
    renderSegments([0.8, null, 0.84])

    const bridge = screen.getByTestId('observedCorrectness-bridge-0-2')
    expect(bridge).toHaveAttribute('stroke-dasharray', '5 5')
    expect(bridge).toHaveAttribute('data-connect-nulls', 'false')
    expect(bridge).toHaveAttribute('data-has-connect-nulls', 'false')
    expect(bridge).toHaveAttribute('data-legend-type', 'none')
    expect(bridge).toHaveAttribute('data-tooltip-type', 'none')
    expect(bridge).toHaveAttribute('data-values', '[0.8,null,0.84]')
  })

  it('registers one invisible semantic tooltip source for measured buckets', () => {
    renderSegments([0.8, null, 0.84])

    const semanticSource = screen.getByTestId(
      'observedCorrectness-semantic-tooltip-source',
    )

    expect(semanticSource).toHaveAttribute('data-key-type', 'string')
    expect(semanticSource).toHaveAttribute('data-values', '[0.8,null,0.84]')
    expect(semanticSource).toHaveAttribute('data-legend-type', 'none')
    expect(semanticSource).toHaveAttribute('data-has-tooltip-type', 'false')
    expect(semanticSource).toHaveAttribute('data-connect-nulls', 'false')
    expect(semanticSource).toHaveAttribute('data-has-connect-nulls', 'false')
  })

  it('does not bridge a gap longer than the configured maximum', () => {
    renderSegments([0.8, null, null, null, 0.84])

    expect(
      screen.queryByTestId('observedCorrectness-bridge-0-4'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId(/observedCorrectness-solid/),
    ).not.toBeInTheDocument()
  })

  it('does not create a marker, tooltip datum, or segment for missing-only data', () => {
    renderSegments([null, null])

    expect(
      screen.queryByTestId(/observedCorrectness-(solid|bridge)/),
    ).not.toBeInTheDocument()
    expect(document.querySelectorAll('circle')).toHaveLength(0)
  })

  it('renders nothing for an empty series', () => {
    renderSegments([])

    expect(
      screen.queryByTestId('observedCorrectness-semantic-tooltip-source'),
    ).not.toBeInTheDocument()
  })

  it('exports a shared explanation for permitted dashed bridges', () => {
    expect(DASHED_LINE_EVIDENCE_LABEL).toBe(
      'Dashed line crosses a period with no eligible evidence.',
    )
  })
})
