import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { AnalyticsReadiness } from '../api/analytics-contracts'

import { AnalyticsReadinessState } from './analytics-readiness-state'

function createReadiness(
  overrides: Partial<AnalyticsReadiness> = {},
): AnalyticsReadiness {
  return {
    ready: false,
    requestedDays: 90,
    bucketDays: 7,
    requestedBuckets: 13,
    effectiveBuckets: 6,
    effectiveStart: '2026-01-19',
    assessments: 32,
    minimumAssessments: 45,
    activeBuckets: 4,
    minimumActiveBuckets: 5,
    longestGap: 3,
    maximumGap: 2,
    gapRuns: 3,
    maximumGapRuns: 2,
    failingReasons: [
      'insufficient-span',
      'insufficient-assessments',
      'insufficient-active-buckets',
      'gap-too-long',
      'too-many-gaps',
    ],
    ...overrides,
  }
}

describe('AnalyticsReadinessState', () => {
  it('explains structured evidence deficits and links to a ready shorter range', () => {
    render(
      <AnalyticsReadinessState
        readiness={createReadiness()}
        recommendedRange={30}
      />,
    )

    const status = screen.getByRole('status', {
      name: '90-day analytics readiness',
    })

    expect(status).toHaveTextContent('1 more active buckets needed.')
    expect(status).toHaveTextContent('13 more assessments needed.')
    expect(status).toHaveTextContent(
      'A practice gap is longer than this trend can bridge.',
    )
    expect(status).toHaveTextContent(
      'Practice is too fragmented for a reliable trend.',
    )
    expect(
      screen.getByRole('link', { name: 'Use ready 30-day view' }),
    ).toHaveAttribute('href', expect.stringContaining('range=30'))
  })

  it('describes the usable effective window without changing the selected range', () => {
    render(
      <AnalyticsReadinessState
        readiness={createReadiness({
          ready: true,
          effectiveBuckets: 8,
          failingReasons: [],
        })}
        recommendedRange={null}
      />,
    )

    expect(
      screen.getByText(
        'Showing 8 weeks of usable history from your selected 90-day range.',
      ),
    ).toBeVisible()
  })
})
