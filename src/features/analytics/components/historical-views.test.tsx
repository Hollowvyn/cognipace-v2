import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import {
  MemoryStrengthView,
  ObservedRecallVsFsrsView,
  PracticeRhythmView,
} from './historical-views'

describe('Phase 2 historical analytics views', () => {
  it('renders View 1 measured markers, a non-color line distinction, and a semantic legend', () => {
    render(
      <ObservedRecallVsFsrsView
        view={{
          rows: [
            {
              id: '2026-08-01',
              bucketStart: '2026-08-01',
              bucketEnd: '2026-08-01',
              isPartial: false,
              recalledCount: 3,
              pairedReviews: 4,
              observedRecall: 0.75,
              fsrsEstimate: 0.8,
              difference: -0.05,
              provenance: 'reconstructed',
              evidence: 'measured',
            },
          ],
          scale: { domain: [0.6, 1], ticks: [0.6, 0.8, 1] },
          targetRetention: 0.9,
        }}
      />,
    )

    expect(screen.getByTestId('observed-recall-markers')).toBeVisible()
    expect(screen.getByTestId('fsrs-estimate-markers')).toHaveAttribute(
      'stroke-dasharray',
      '6 3',
    )
    expect(screen.getByRole('list')).toHaveTextContent('Observed recall')
    expect(screen.getByRole('list')).toHaveTextContent('FSRS estimate')
  })

  it('renders the supported Memory Strength IQR as a restrained chart band', () => {
    render(
      <MemoryStrengthView
        view={{
          rows: [
            {
              id: '2026-08-01',
              bucketStart: '2026-08-01',
              bucketEnd: '2026-08-01',
              isPartial: false,
              medianStrengthDays: 6,
              q1: 4,
              q3: 8,
              eligibleReviews: 4,
              medianChangeDays: 2,
              provenance: 'reconstructed',
              evidence: 'measured',
            },
          ],
          scale: { domain: [0, 10], ticks: [0, 5, 10] },
        }}
      />,
    )

    expect(screen.getByTestId('memory-strength-iqr-band')).toBeVisible()
  })

  it('keeps the association warning visible and formats table buckets as MM/DD/YY', async () => {
    const user = userEvent.setup()
    render(
      <PracticeRhythmView
        view={{
          rows: [
            {
              id: '2026-08-01',
              bucketStart: '2026-08-01',
              bucketEnd: '2026-08-01',
              isPartial: false,
              completedReviews: 4,
              goodEasy: 3,
              validRatings: 4,
              reviewSuccess: 0.75,
              evidence: 'measured',
            },
          ],
          countScale: { domain: [0, 5], ticks: [0, 5] },
          percentageScale: { domain: [0.6, 1], ticks: [0.6, 1] },
        }}
      />,
    )

    expect(screen.getByText('Association, not causation.')).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Table' }))
    expect(screen.getByRole('rowheader', { name: '08/01/26' })).toBeVisible()
  })
})
