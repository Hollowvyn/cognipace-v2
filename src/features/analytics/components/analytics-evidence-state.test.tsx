import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { AnalyticsEvidenceClassification } from '../api/analytics-contracts'
import { AnalyticsEvidenceState } from './analytics-evidence-state'

function evidence(
  overrides: Partial<AnalyticsEvidenceClassification> = {},
): AnalyticsEvidenceClassification {
  return {
    historyDays: 90,
    measuredBuckets: 6,
    observations: 30,
    selectedBucketCount: 13,
    tableOnly: false,
    displayMode: 'trend',
    supportsLine: true,
    supportsDirection: true,
    ...overrides,
  }
}

describe('AnalyticsEvidenceState', () => {
  it('uses evidence vocabulary and reports the exact H/M/S sample', () => {
    render(
      <AnalyticsEvidenceState
        evidence={evidence({
          historyDays: 42,
          measuredBuckets: 4,
          observations: 18,
          displayMode: 'marks',
          supportsLine: false,
          supportsDirection: false,
        })}
        title="Memory Strength"
      />,
    )

    const status = screen.getByRole('status', {
      name: 'Memory Strength evidence',
    })
    expect(status).toHaveTextContent(
      '42 eligible history days · 4 measured buckets · 18 observations',
    )
    expect(status).toHaveTextContent(
      'Measurements are shown without a trend line.',
    )
    expect(status).not.toHaveTextContent(/readiness|practice gap|shorter/i)
  })

  it('explains table-only evidence without recommending another range', () => {
    render(
      <AnalyticsEvidenceState
        evidence={evidence({
          historyDays: 12,
          measuredBuckets: 2,
          observations: 6,
          tableOnly: true,
          displayMode: 'table',
          supportsLine: false,
          supportsDirection: false,
        })}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Exact values are available; fewer than 30 eligible history days do not support a trend chart.',
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders one calm page-level explanation without warning tone', () => {
    render(<AnalyticsEvidenceState summary />)

    const status = screen.getByRole('status', {
      name: 'Historical analytics evidence',
    })
    expect(status).toHaveTextContent(
      'Historical views qualify trends using eligible history, measured buckets, and observations.',
    )
    expect(status).toHaveTextContent(
      'Exact values remain available in each Table.',
    )
  })
})
