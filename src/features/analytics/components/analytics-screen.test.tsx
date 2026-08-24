import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import type {
  AnalyticsEvidenceClassification,
  AnalyticsRange,
  SerializedAnalyticsSummary,
} from '@/features/analytics/api/analytics-contracts'
import { createSerializedAnalyticsSummary } from '@/testing/analytics-fixtures'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { AnalyticsScreen } from './analytics-screen'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

const trendEvidence: AnalyticsEvidenceClassification = {
  historyDays: 90,
  measuredBuckets: 8,
  observations: 40,
  selectedBucketCount: 13,
  tableOnly: false,
  displayMode: 'trend',
  supportsLine: true,
  supportsDirection: true,
}

function createObservedRows(prefix: string, count = 8) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    bucketStart: `2026-05-${String(index + 1).padStart(2, '0')}`,
    bucketEnd: `2026-05-${String(index + 1).padStart(2, '0')}`,
    isPartial: false,
    recalledCount: 1,
    pairedReviews: 1,
    observedRecall: 1,
    fsrsEstimate: 0.9,
    difference: 0.1,
    provenance: 'reconstructed' as const,
    evidence: 'measured' as const,
  }))
}

function summaryWithHistoricalRows(
  range: 90 | 120,
): SerializedAnalyticsSummary {
  const base = createSerializedAnalyticsSummary()
  return {
    ...base,
    range,
    timeFrame: {
      ...base.timeFrame,
      requestedRange: range,
      periodStart:
        range === 90 ? '2026-03-02T00:00:00.000Z' : '2026-02-01T00:00:00.000Z',
    },
    views: {
      ...base.views,
      observedRecallVsFsrs: {
        ...base.views.observedRecallVsFsrs,
        rows: createObservedRows(String(range)),
        evidence: trendEvidence,
      },
    },
  }
}

describe('AnalyticsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state and defaults analytics requests to 90 days', () => {
    vi.mocked(sendMessage).mockReturnValueOnce(new Promise(() => {}))

    renderAnalyticsScreen()

    expect(screen.getByText('Loading analytics...')).toBeVisible()
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    expect(sendMessage).toHaveBeenCalledWith('analytics.getSummary', {
      surface: 'dashboard',
      range: 90,
      timeZone,
    })
  })

  it('renders error state then succeeds after retry', async () => {
    const user = userEvent.setup()
    const deferred = createDeferred<never>()
    vi.mocked(sendMessage)
      .mockReturnValueOnce(deferred.promise)
      .mockResolvedValueOnce(createSerializedAnalyticsSummary())

    renderAnalyticsScreen()
    deferred.reject(new Error('network error'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load Analytics.',
    )
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByLabelText('Review Days metric')).toBeVisible()
  })

  it('uses long-range metadata and one calm evidence summary without readiness warnings', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(summaryWithHistoricalRows(90))

    renderAnalyticsScreen(90)

    const metadata = await screen.findByText(
      (_, element) =>
        element?.tagName === 'P' &&
        element.textContent?.includes('Range: 90 days') === true,
    )
    expect(metadata).toHaveTextContent('Time zone: UTC')
    expect(
      screen.getByRole('status', { name: 'Historical analytics evidence' }),
    ).toBeVisible()
    expect(screen.queryByText(/ready shorter range/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/practice gap/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/analytics readiness/i)).not.toBeInTheDocument()
  })

  it('formats an empty All-time scope without Invalid Date', async () => {
    const base = createSerializedAnalyticsSummary()
    vi.mocked(sendMessage).mockResolvedValueOnce({
      ...base,
      range: 'all',
      timeFrame: {
        ...base.timeFrame,
        requestedRange: 'all',
        periodStart: null,
        bucketGrain: null,
        buckets: [],
      },
    })

    renderAnalyticsScreen('all')

    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName === 'P' &&
          element.textContent?.includes('Range: All time') === true,
      ),
    ).toBeVisible()
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
  })

  it('keeps the selected Table tab and resets its pagination after a range change', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage)
      .mockResolvedValueOnce(summaryWithHistoricalRows(90))
      .mockResolvedValueOnce(summaryWithHistoricalRows(120))
    const harness = createQueryTestHarness()
    const { rerender } = render(<AnalyticsScreen range={90} />, {
      wrapper: harness.wrapper,
    })
    const panel = await screen.findByRole('region', {
      name: 'Observed Recall vs FSRS Estimate',
    })

    await user.click(within(panel).getByRole('tab', { name: 'Table' }))
    await user.click(within(panel).getByRole('button', { name: 'Next' }))
    expect(within(panel).getByText('Page 2 of 2')).toBeVisible()

    rerender(<AnalyticsScreen range={120} />)
    await waitFor(() => {
      expect(sendMessage).toHaveBeenLastCalledWith(
        'analytics.getSummary',
        expect.objectContaining({ range: 120 }),
      )
    })
    const refreshedPanel = await screen.findByRole('region', {
      name: 'Observed Recall vs FSRS Estimate',
    })
    expect(
      within(refreshedPanel).getByRole('tab', { name: 'Table' }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(within(refreshedPanel).getByText('Page 1 of 2')).toBeVisible()
    expect(
      within(refreshedPanel).getByRole('rowheader', { name: '05/01/26' }),
    ).toBeVisible()
  })

  it('retains the locked historical view order and independent Topic Performance gate', async () => {
    const base = createSerializedAnalyticsSummary()
    vi.mocked(sendMessage).mockResolvedValueOnce({
      ...base,
      views: {
        ...base.views,
        topicPerformance: {
          rows: [
            {
              id: 'graphs',
              topic: 'Graphs',
              reviewSuccess: 0.6,
              goodEasy: 6,
              validRatings: 10,
              distinctProblems: 3,
              evidence: 'Measured',
            },
          ],
          strongerQualifyingTopics: 0,
          lowEvidenceTopics: [],
          additionalLowEvidenceTopics: 0,
        },
      },
    })

    renderAnalyticsScreen()

    expect(
      await screen.findByText(
        '1 qualifying topic meets the 10 valid-rating and 3 reviewed-problem gates.',
      ),
    ).toBeVisible()
    const historicalNames = [
      'Observed Recall vs FSRS Estimate',
      'Memory Strength',
      'Practice Rhythm',
      'Ratings Mix',
      'Topic Performance',
    ]
    const renderedNames = screen
      .getAllByRole('region')
      .map((region) => {
        const labelledBy = region.getAttribute('aria-labelledby')
        return labelledBy
          ? document.getElementById(labelledBy)?.textContent
          : null
      })
      .filter((name): name is string => historicalNames.includes(name ?? ''))
    expect(renderedNames).toEqual(historicalNames)
  })
})

function renderAnalyticsScreen(range?: AnalyticsRange) {
  const harness = createQueryTestHarness()
  return render(<AnalyticsScreen range={range} />, { wrapper: harness.wrapper })
}

function createDeferred<T>() {
  let reject!: (reason?: unknown) => void
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, reject, resolve }
}
