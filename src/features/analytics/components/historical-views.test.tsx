import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { AnalyticsEvidenceClassification } from '../api/analytics-contracts'
import {
  MemoryStrengthView,
  ObservedRecallVsFsrsView,
  PracticeRhythmView,
  RatingsMixTooltip,
  RatingsMixView,
  RhythmTooltip,
  TopicPerformanceView,
} from './historical-views'

const trendEvidence: AnalyticsEvidenceClassification = {
  historyDays: 90,
  measuredBuckets: 6,
  observations: 30,
  selectedBucketCount: 13,
  tableOnly: false,
  displayMode: 'trend',
  supportsLine: true,
  supportsDirection: true,
}

function evidence(
  overrides: Partial<AnalyticsEvidenceClassification> = {},
): AnalyticsEvidenceClassification {
  return { ...trendEvidence, ...overrides }
}

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
          evidence: trendEvidence,
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
    expect(screen.getByRole('list').closest('svg')).toBeNull()
  })

  it('keeps shared time buckets aligned across multiple line series', () => {
    render(
      <ObservedRecallVsFsrsView
        view={{
          rows: [
            {
              id: '2026-08-01',
              bucketStart: '2026-08-01',
              bucketEnd: '2026-08-02',
              isPartial: false,
              recalledCount: 3,
              pairedReviews: 4,
              observedRecall: 0.75,
              fsrsEstimate: 0.8,
              difference: -0.05,
              provenance: 'reconstructed',
              evidence: 'measured',
            },
            {
              id: '2026-08-03',
              bucketStart: '2026-08-03',
              bucketEnd: '2026-08-04',
              isPartial: false,
              recalledCount: 4,
              pairedReviews: 4,
              observedRecall: 1,
              fsrsEstimate: 0.9,
              difference: 0.1,
              provenance: 'reconstructed',
              evidence: 'measured',
            },
          ],
          scale: { domain: [0.6, 1], ticks: [0.6, 0.8, 1] },
          targetRetention: 0.9,
          evidence: trendEvidence,
        }}
      />,
    )

    const xAxisLabels = Array.from(
      document.querySelectorAll(
        '.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-label text',
      ),
    ).map((node) => node.textContent)

    expect(xAxisLabels).toEqual(['08/01–08/02', '08/03–08/04'])
  })

  it('bridges exactly one empty calendar bucket and breaks across longer gaps in trend mode', () => {
    const values = [0.8, null, 0.84, null, null, 0.9]
    render(
      <ObservedRecallVsFsrsView
        view={{
          rows: values.map((value, index) => ({
            id: `2026-08-${String(index + 1).padStart(2, '0')}`,
            bucketStart: `2026-08-${String(index + 1).padStart(2, '0')}`,
            bucketEnd: `2026-08-${String(index + 1).padStart(2, '0')}`,
            isPartial: false,
            recalledCount: value === null ? 0 : 4,
            pairedReviews: value === null ? 0 : 5,
            observedRecall: value,
            fsrsEstimate: value,
            difference: value === null ? null : 0,
            provenance: 'reconstructed' as const,
            evidence:
              value === null
                ? ('not-measured' as const)
                : ('measured' as const),
          })),
          scale: { domain: [0.7, 1], ticks: [0.7, 0.85, 1] },
          targetRetention: 0.9,
          evidence: trendEvidence,
        }}
      />,
    )

    expect(screen.getByTestId('observed-recall-bridge-0-2')).toHaveAttribute(
      'stroke-dasharray',
      '5 5',
    )
    expect(
      screen.queryByTestId('observed-recall-bridge-2-5'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('observed-recall-solid-2-5'),
    ).not.toBeInTheDocument()
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
          evidence: trendEvidence,
        }}
      />,
    )

    expect(screen.getByTestId('memory-strength-iqr-band')).toBeVisible()
    expect(
      screen.getAllByTestId('memory-strength-markers').length,
    ).toBeGreaterThan(0)
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
          evidence: trendEvidence,
        }}
      />,
    )

    expect(screen.getByText('Association, not causation.')).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Table' }))
    expect(screen.getByRole('rowheader', { name: '08/01/26' })).toBeVisible()
  })

  it('keeps Ratings Mix chart and table values on the same feature-owned rows', async () => {
    const user = userEvent.setup()
    render(
      <RatingsMixView
        view={{
          rows: [
            {
              id: '2026-08-01',
              bucketStart: '2026-08-01',
              bucketEnd: '2026-08-01',
              isPartial: true,
              again: 1,
              hard: 0,
              good: 2,
              easy: 1,
              againShare: 0.25,
              hardShare: 0,
              goodShare: 0.5,
              easyShare: 0.25,
              validRatings: 4,
              challengingReviews: 1,
              evidence: 'measured',
            },
          ],
          selectedHardAgain: 250,
          selectedValidRatings: 1000,
          comparison: {
            direction: 'down',
            difference: -0.3,
            previousHardAgainShare: 0.5,
            previousValidRatings: 1000,
          },
          evidence: trendEvidence,
        }}
      />,
    )

    const ratingsChartContainer = screen.getByRole('img', {
      name: 'Ratings Mix chart',
    })
    expect(ratingsChartContainer).toHaveAttribute(
      'aria-roledescription',
      '100% stacked column chart',
    )
    const ratingsChart = screen.getByTestId('ratings-mix-keyboard-chart')
    expect(ratingsChart.closest('svg')).toHaveAttribute('tabindex', '0')
    const ratingsLegend = screen.getByRole('list', {
      name: 'Ratings Mix categories',
    })
    expect(ratingsLegend).toHaveTextContent('AgainHardGoodEasy')
    expect(ratingsChartContainer).not.toContainElement(ratingsLegend)
    expect(
      screen.getByText(
        /This period's rating mix is based on 1,000 valid ratings/,
      ),
    ).toBeVisible()
    expect(
      screen.getByText(
        'Hard + Again is down 30 pp from the equivalent prior period (50%; 1,000 valid ratings).',
      ),
    ).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Table' }))
    expect(
      screen.getByRole('rowheader', { name: '08/01/26 (in progress)' }),
    ).toBeVisible()
    expect(
      screen.getByRole('columnheader', { name: 'Challenging reviews' }),
    ).toBeVisible()
    expect(screen.getByText('2 (50%)')).toBeVisible()
  })

  it('renders Topic Performance as an unpaginated five-row-or-fewer ranking', async () => {
    const user = userEvent.setup()
    render(
      <TopicPerformanceView
        selectedPeriod="30-day selected period"
        view={{
          rows: [
            {
              id: 'graphs',
              topic: 'Graphs',
              reviewSuccess: 0.6,
              goodEasy: 750,
              validRatings: 1000,
              distinctProblems: 300,
              evidence: 'Measured',
            },
          ],
          strongerQualifyingTopics: 1000,
          lowEvidenceTopics: [
            { topic: 'Trees', validRatings: 800, distinctProblems: 200 },
          ],
          additionalLowEvidenceTopics: 0,
        }}
      />,
    )

    const topicChartContainer = screen.getByRole('img', {
      name: 'Topic Performance chart',
    })
    expect(topicChartContainer).toHaveAttribute(
      'aria-roledescription',
      'ranked horizontal bar chart',
    )
    const topicChart = screen.getByTestId('topic-performance-keyboard-chart')
    const topicChartSvg = topicChart.closest('svg')
    expect(topicChartSvg).toHaveAttribute('tabindex', '0')
    expect(
      within(topicChart).getByText(
        'Ranked Topic Review Success for the selected period. Scale: 0%–100%. 1 of 1,001 qualifying topics shown.',
      ),
    ).toBeInTheDocument()
    expect(within(topicChart).getByText('60%')).toBeVisible()
    expect(
      screen.getByText(/1,000 stronger qualifying topics omitted/),
    ).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Table' }))
    expect(screen.getByRole('rowheader', { name: 'Graphs' })).toBeVisible()
    expect(
      screen.getByRole('columnheader', { name: 'Distinct problems' }),
    ).toBeVisible()
    expect(screen.getByText('1,000')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Next' }),
    ).not.toBeInTheDocument()
  })

  it('shows only the exact paginated table when eligible history is under 30 days', () => {
    render(
      <ObservedRecallVsFsrsView
        view={{
          rows: Array.from({ length: 8 }, (_, index) => ({
            id: `2026-08-${String(index + 1).padStart(2, '0')}`,
            bucketStart: `2026-08-${String(index + 1).padStart(2, '0')}`,
            bucketEnd: `2026-08-${String(index + 1).padStart(2, '0')}`,
            isPartial: false,
            recalledCount: 1,
            pairedReviews: 1,
            observedRecall: 1,
            fsrsEstimate: 0.9,
            difference: 0.1,
            provenance: 'reconstructed' as const,
            evidence: 'measured' as const,
          })),
          scale: { domain: [0.8, 1], ticks: [0.8, 0.9, 1] },
          targetRetention: 0.9,
          evidence: evidence({
            historyDays: 8,
            measuredBuckets: 8,
            observations: 8,
            tableOnly: true,
            displayMode: 'table',
            supportsLine: false,
            supportsDirection: false,
          }),
        }}
      />,
    )

    expect(screen.queryByRole('tab', { name: 'Chart' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('table', {
        name: 'Observed Recall vs FSRS Estimate exact values',
      }),
    ).toBeVisible()
    expect(screen.getByText('Page 1 of 2')).toBeVisible()
    expect(screen.getByText(/8 eligible history days/)).toBeVisible()
    expect(screen.getByText(/Exact values are available/)).toBeVisible()
  })

  it('keeps single and middle-tier measurements visible without connecting lines', () => {
    const rows = [
      {
        id: '2026-08-01',
        bucketStart: '2026-08-01',
        bucketEnd: '2026-08-07',
        isPartial: false,
        medianStrengthDays: 6,
        q1: 4,
        q3: 8,
        eligibleReviews: 4,
        medianChangeDays: 2,
        provenance: 'reconstructed' as const,
        evidence: 'measured' as const,
      },
      {
        id: '2026-08-08',
        bucketStart: '2026-08-08',
        bucketEnd: '2026-08-14',
        isPartial: false,
        medianStrengthDays: 8,
        q1: 6,
        q3: 10,
        eligibleReviews: 4,
        medianChangeDays: 2,
        provenance: 'reconstructed' as const,
        evidence: 'measured' as const,
      },
    ]
    const { rerender } = render(
      <MemoryStrengthView
        view={{
          rows: rows.slice(0, 1),
          scale: { domain: [0, 10], ticks: [0, 5, 10] },
          evidence: evidence({
            measuredBuckets: 1,
            observations: 4,
            displayMode: 'single',
            supportsLine: false,
            supportsDirection: false,
          }),
        }}
      />,
    )

    expect(
      screen.getAllByTestId('memory-strength-markers').length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByTestId('memory-strength-iqr-band'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId(/^memory-strength-(solid|bridge|single)-/),
    ).not.toBeInTheDocument()

    rerender(
      <MemoryStrengthView
        view={{
          rows,
          scale: { domain: [0, 10], ticks: [0, 5, 10] },
          evidence: evidence({
            measuredBuckets: 2,
            observations: 8,
            displayMode: 'marks',
            supportsLine: false,
            supportsDirection: false,
          }),
        }}
      />,
    )

    expect(
      screen.getAllByTestId('memory-strength-markers').length,
    ).toBeGreaterThan(1)
    expect(
      screen.queryByTestId('memory-strength-iqr-band'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId(/^memory-strength-(solid|bridge|single)-/),
    ).not.toBeInTheDocument()
  })

  it('keeps View 3 bars and View 4 stacks visible when directional lines are unsupported', () => {
    const middleEvidence = evidence({
      measuredBuckets: 3,
      observations: 12,
      displayMode: 'marks',
      supportsLine: false,
      supportsDirection: false,
    })
    const { rerender } = render(
      <PracticeRhythmView
        view={{
          rows: [
            {
              id: '2026-08-01',
              bucketStart: '2026-08-01',
              bucketEnd: '2026-08-07',
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
          evidence: middleEvidence,
        }}
      />,
    )

    expect(screen.getByTestId('practice-rhythm-bars')).toBeVisible()
    expect(
      screen.getAllByTestId('review-success-markers').length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByTestId(/^review-success-(solid|bridge|single)-/),
    ).not.toBeInTheDocument()

    rerender(
      <RatingsMixView
        view={{
          rows: [
            {
              id: '2026-08-01',
              bucketStart: '2026-08-01',
              bucketEnd: '2026-08-07',
              isPartial: false,
              again: 1,
              hard: 0,
              good: 2,
              easy: 1,
              againShare: 0.25,
              hardShare: 0,
              goodShare: 0.5,
              easyShare: 0.25,
              validRatings: 4,
              challengingReviews: 1,
              evidence: 'measured',
            },
          ],
          selectedHardAgain: 1,
          selectedValidRatings: 4,
          comparison: {
            direction: null,
            difference: null,
            previousHardAgainShare: null,
            previousValidRatings: 0,
          },
          evidence: middleEvidence,
        }}
      />,
    )

    expect(screen.getByTestId('ratings-mix-stacks')).toBeVisible()
  })

  it('keeps exact calendar spans and resets table pagination when rows change', async () => {
    const user = userEvent.setup()
    const buildRows = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, index) => ({
        id: `${prefix}-${index}`,
        bucketStart: `2026-08-${String(index + 1).padStart(2, '0')}`,
        bucketEnd: `2026-08-${String(index + 7).padStart(2, '0')}`,
        isPartial: false,
        completedReviews: 1,
        goodEasy: 1,
        validRatings: 1,
        reviewSuccess: 1,
        evidence: 'measured' as const,
      }))
    const tableEvidence = evidence({
      historyDays: 20,
      measuredBuckets: 8,
      observations: 8,
      tableOnly: true,
      displayMode: 'table',
      supportsLine: false,
      supportsDirection: false,
    })
    const { rerender } = render(
      <PracticeRhythmView
        view={{
          rows: buildRows('ninety', 8),
          countScale: { domain: [0, 2], ticks: [0, 1, 2] },
          percentageScale: { domain: [0, 1], ticks: [0, 1] },
          evidence: tableEvidence,
        }}
      />,
    )

    expect(
      screen.getByRole('rowheader', { name: '08/01/26–08/07/26' }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Page 2 of 2')).toBeVisible()

    rerender(
      <PracticeRhythmView
        view={{
          rows: buildRows('all', 8).map((row, index) => ({
            ...row,
            id: `all-${index}`,
          })),
          countScale: { domain: [0, 2], ticks: [0, 1, 2] },
          percentageScale: { domain: [0, 1], ticks: [0, 1] },
          evidence: tableEvidence,
        }}
      />,
    )

    expect(screen.getByText('Page 1 of 2')).toBeVisible()
    expect(
      screen.getByRole('rowheader', { name: '08/01/26–08/07/26' }),
    ).toBeVisible()
  })

  it.each([
    ['90 days', 14],
    ['120 days', 18],
    ['All time', 48],
  ])(
    'retains every elapsed %s row while thinning only ticks and keeping edge labels',
    (_label, rowCount) => {
      const rows = createDenseMemoryRows(rowCount)
      const { unmount } = render(
        <MemoryStrengthView
          view={{
            rows,
            scale: { domain: [0, 20], ticks: [0, 10, 20] },
            evidence: trendEvidence,
          }}
        />,
      )

      expect(
        document.querySelectorAll(
          'circle[data-testid="memory-strength-markers"]',
        ),
      ).toHaveLength(rowCount)

      const ticks = Array.from(
        document.querySelectorAll(
          '.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-label text',
        ),
        (node) => node.textContent,
      )
      expect(ticks.length).toBeLessThan(rowCount)
      expect(ticks[0]).toBe(formatCompactDate(rows[0]!.bucketStart))
      expect(ticks.at(-1)).toBe(formatCompactDate(rows.at(-1)!.bucketStart))

      unmount()
    },
  )

  it('keeps Practice Rhythm tooltip order aligned with its table and announces the active datum', () => {
    const row = {
      id: '2026-08-01',
      bucketStart: '2026-08-01',
      bucketEnd: '2026-08-07',
      isPartial: false,
      completedReviews: 4,
      goodEasy: 3,
      validRatings: 4,
      reviewSuccess: 0.75,
      evidence: 'measured' as const,
    }
    render(<RhythmTooltip active payload={[{ payload: row }]} />)

    const tooltip = screen.getByRole('status', {
      name: '08/01/26–08/07/26 details',
    })
    expect(tooltip).toHaveAttribute('aria-live', 'polite')
    expect(tooltip).toHaveAttribute('aria-atomic', 'true')
    const copy = tooltip.textContent ?? ''
    expect(copy.indexOf('Review Success: 75%')).toBeLessThan(
      copy.indexOf('Good + Easy: 3 of 4'),
    )
  })

  it('keeps Ratings Mix tooltip fields aligned with the exact table without a partial substitute', () => {
    const row = {
      id: '2026-08-01',
      bucketStart: '2026-08-01',
      bucketEnd: '2026-08-07',
      isPartial: true,
      again: 1,
      hard: 0,
      good: 2,
      easy: 1,
      againShare: 0.25,
      hardShare: 0,
      goodShare: 0.5,
      easyShare: 0.25,
      validRatings: 4,
      challengingReviews: 1,
      evidence: 'measured' as const,
    }
    render(<RatingsMixTooltip active payload={[{ payload: row }]} />)

    const tooltip = screen.getByRole('status', {
      name: '08/01/26–08/07/26 (in progress) details',
    })
    expect(tooltip).toHaveTextContent('Challenging reviews: 1')
    expect(tooltip).toHaveTextContent('Evidence: Measured · In progress')
    expect(tooltip).not.toHaveTextContent('Partial state:')
  })
})

function createDenseMemoryRows(rowCount: number) {
  return Array.from({ length: rowCount }, (_, index) => {
    const date = new Date(Date.UTC(2025, 0, 1 + index * 7))
    const dateKey = date.toISOString().slice(0, 10)
    return {
      id: dateKey,
      bucketStart: dateKey,
      bucketEnd: dateKey,
      isPartial: false,
      medianStrengthDays: 5 + (index % 5),
      q1: 4 + (index % 5),
      q3: 6 + (index % 5),
      eligibleReviews: 4,
      medianChangeDays: 1,
      provenance: 'reconstructed' as const,
      evidence: 'measured' as const,
    }
  })
}

function formatCompactDate(dateKey: string) {
  const [, month, day] = dateKey.split('-')
  return `${month}/${day}`
}
