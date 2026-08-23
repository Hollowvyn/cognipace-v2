import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { AnalyticsEvidence } from '../domain/analytics-evidence'

import {
  AnalyticsEvidenceStrip,
  AnalyticsEvidenceSummary,
} from './analytics-evidence-summary'

const evidence: AnalyticsEvidence = {
  labels: ['measured', 'in-progress'],
  sampleSize: 24,
  activeBuckets: 8,
  requestedBuckets: 10,
  effectiveBuckets: 9,
  longestGap: 1,
  gapRuns: 1,
  trendSupported: true,
}

describe('AnalyticsEvidenceSummary', () => {
  it('renders the calm page-level evidence summary once', () => {
    render(<AnalyticsEvidenceSummary evidence={evidence} />)

    const summary = screen.getByLabelText('Analytics evidence')
    expect(summary).toHaveTextContent('24 eligible observations')
    expect(summary).toHaveTextContent('8 active buckets')
    expect(summary).toHaveTextContent('measured · in-progress')
  })

  it('renders the figure strip without duplicating page-level detail', () => {
    render(<AnalyticsEvidenceStrip evidence={evidence} />)

    const strip = screen.getByLabelText('Figure evidence')
    expect(strip).toHaveTextContent('24 eligible · measured · in-progress')
    expect(strip).not.toHaveTextContent('active buckets')
  })
})
