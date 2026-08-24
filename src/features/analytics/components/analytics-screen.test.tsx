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

function summaryWithTopicPerformance(
  range: 90 | 120,
): SerializedAnalyticsSummary {
  const base = summaryWithHistoricalRows(range)
  return {
    ...base,
    views: {
      ...base.views,
      topicPerformance: {
        rows: [
          {
            id: `graphs-${range}`,
            topic: `Graphs ${range}`,
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
  }
}

function createDailyRows(start: string, count: number) {
  const startDate = new Date(`${start}T00:00:00.000Z`)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(startDate)
    date.setUTCDate(date.getUTCDate() + index)
    return date.toISOString().slice(0, 10)
  })
}

function summaryWithSelectorIndependentViews(
  range: AnalyticsRange,
): SerializedAnalyticsSummary {
  const base = createSerializedAnalyticsSummary()
  const backlogDates = createDailyRows('2026-04-03', 120)
  const forecastDates = createDailyRows('2026-08-01', 14)
  return {
    ...base,
    range,
    timeFrame: {
      ...base.timeFrame,
      requestedRange: range,
      periodStart: range === 'all' ? null : base.timeFrame.periodStart,
      bucketGrain: range === 'all' ? null : base.timeFrame.bucketGrain,
      buckets: range === 'all' ? [] : base.timeFrame.buckets,
    },
    views: {
      ...base.views,
      retentionMap: {
        rows: [
          {
            rank: 1,
            slug: 'selector-stable-problem',
            title: 'Selector Stable Problem',
            retrievability: 0.7,
            targetRetention: 0.9,
            targetGap: -0.2,
            targetDurationDays: 3,
            lastReviewedAt: '2026-07-31T00:00:00.000Z',
            dueAt: '2026-08-01T00:00:00.000Z',
            difficulty: 5,
            lapseCount: 1,
            status: 'needs-attention',
            region: 'highest-attention',
          },
        ],
        totalEligible: 1,
        statusCounts: { onTarget: 0, watch: 0, needsAttention: 1 },
        recallScale: { domain: [0.6, 1], ticks: [0.6, 0.8, 1] },
        durationScale: { domain: [1, 10], ticks: [1, 10] },
        targetRetention: 0.9,
      },
      memorySignals: {
        rows: [
          {
            rank: 1,
            slug: 'selector-stable-problem',
            title: 'Selector Stable Problem',
            reasons: [{ kind: 'below-recall', label: 'Below recall 70%' }],
          },
        ],
        totalQualifying: 1,
      },
      overdueBacklog: {
        rows: backlogDates.map((date, index) => ({
          date,
          overdueCount: index === 60 ? null : index % 7,
          inProgress: index === 119,
        })),
        knownDays: 119,
        withinWatchDays: 102,
        aboveWatchDays: 17,
        selectedDays: 120,
        currentBacklog: 0,
        peak: 6,
        scale: { domain: [0, 10], ticks: [0, 5, 10] },
      },
      upcomingReviewLoad: {
        rows: forecastDates.map((date, index) => ({
          date,
          dueCount: index === 1 ? 2 : 0,
          overdueCount: index === 0 ? 1 : 0,
          today: index === 0,
        })),
        scale: { domain: [0, 4], ticks: [0, 2, 4] },
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

  it('politely announces refreshed 90-day, 120-day, and All-time scopes', async () => {
    const base = createSerializedAnalyticsSummary()
    const allTime = {
      ...base,
      range: 'all' as const,
      timeFrame: {
        ...base.timeFrame,
        requestedRange: 'all' as const,
        periodStart: null,
        bucketGrain: null,
        buckets: [],
      },
    }
    vi.mocked(sendMessage)
      .mockResolvedValueOnce(summaryWithHistoricalRows(90))
      .mockResolvedValueOnce(summaryWithHistoricalRows(120))
      .mockResolvedValueOnce(allTime)
    const harness = createQueryTestHarness()
    const { rerender } = render(<AnalyticsScreen range={90} />, {
      wrapper: harness.wrapper,
    })

    let scope = await screen.findByRole('status', {
      name: 'Analytics range and time scope',
    })
    expect(scope).toHaveAttribute('aria-live', 'polite')
    expect(scope).toHaveAttribute('aria-atomic', 'true')
    expect(scope).toHaveTextContent('Range: 90 days')

    rerender(<AnalyticsScreen range={120} />)
    await waitFor(() => {
      expect(
        screen.getByRole('status', {
          name: 'Analytics range and time scope',
        }),
      ).toHaveTextContent('Range: 120 days')
    })

    rerender(<AnalyticsScreen range="all" />)
    await waitFor(() => {
      expect(
        screen.getByRole('status', {
          name: 'Analytics range and time scope',
        }),
      ).toHaveTextContent('Range: All time')
    })
    scope = screen.getByRole('status', {
      name: 'Analytics range and time scope',
    })
    expect(scope).not.toHaveTextContent('Invalid Date')
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
      expect(screen.getByText('Page 1 of 2')).toBeVisible()
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

  it('keeps the Topic Performance Table tab selected across a range remount', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage)
      .mockResolvedValueOnce(summaryWithTopicPerformance(90))
      .mockResolvedValueOnce(summaryWithTopicPerformance(120))
    const harness = createQueryTestHarness()
    const firstRender = render(<AnalyticsScreen range={90} />, {
      wrapper: harness.wrapper,
    })
    let panel = await screen.findByRole('region', {
      name: 'Topic Performance',
    })

    await user.click(within(panel).getByRole('tab', { name: 'Table' }))
    expect(within(panel).getByRole('tab', { name: 'Table' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    firstRender.unmount()

    render(<AnalyticsScreen range={120} />, { wrapper: harness.wrapper })
    panel = await screen.findByRole('region', { name: 'Topic Performance' })
    await waitFor(() => {
      expect(
        within(panel).getByRole('rowheader', { name: 'Graphs 120' }),
      ).toBeVisible()
    })
    expect(within(panel).getByRole('tab', { name: 'Table' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
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

  it('keeps current cohorts and fixed workload windows across every historical selector', async () => {
    vi.mocked(sendMessage)
      .mockResolvedValueOnce(summaryWithSelectorIndependentViews(90))
      .mockResolvedValueOnce(summaryWithSelectorIndependentViews(120))
      .mockResolvedValueOnce(summaryWithSelectorIndependentViews('all'))
    const harness = createQueryTestHarness()
    const { rerender } = render(<AnalyticsScreen range={90} />, {
      wrapper: harness.wrapper,
    })

    await expectSelectorIndependentViews('90 days')

    rerender(<AnalyticsScreen range={120} />)
    await expectSelectorIndependentViews('120 days')

    rerender(<AnalyticsScreen range="all" />)
    await expectSelectorIndependentViews('All time')

    expect(sendMessage).toHaveBeenCalledTimes(3)
  })
})

async function expectSelectorIndependentViews(rangeLabel: string) {
  await waitFor(() => {
    expect(
      screen.getByRole('status', { name: 'Analytics range and time scope' }),
    ).toHaveTextContent(`Range: ${rangeLabel}`)
  })

  const retentionMap = screen.getByRole('region', { name: 'Retention Map' })
  expect(
    within(retentionMap).getByRole('button', {
      name: /Selector Stable Problem.*Needs attention/i,
    }),
  ).toBeVisible()
  const memorySignals = screen.getByRole('region', {
    name: 'Memory Signals by Problem',
  })
  expect(
    within(memorySignals).getByRole('link', {
      name: 'Selector Stable Problem',
    }),
  ).toBeVisible()

  const backlog = screen.getByRole('region', {
    name: 'Recent Overdue Backlog',
  })
  expect(within(backlog).getByText(/119 known days of 120/)).toBeVisible()
  await userEvent.click(within(backlog).getByRole('tab', { name: 'Table' }))
  expect(within(backlog).getByRole('status')).toHaveTextContent(
    'Showing 1–7 of 120',
  )
  const backlogTable = within(backlog).getByRole('table', {
    name: 'Recent Overdue Backlog data table',
  })
  expect(within(backlogTable).getByText('04/03/26')).toBeVisible()
  expect(within(backlogTable).getByText('04/09/26')).toBeVisible()

  const upcoming = screen.getByRole('region', {
    name: 'Upcoming Review Load',
  })
  await userEvent.click(within(upcoming).getByRole('tab', { name: 'Table' }))
  expect(within(upcoming).getByRole('status')).toHaveTextContent(
    'Showing 1–7 of 14',
  )
  expect(
    within(upcoming)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent),
  ).toEqual(['Date', 'Due', 'Overdue'])
  const upcomingTable = within(upcoming).getByRole('table', {
    name: 'Upcoming Review Load data table',
  })
  expect(within(upcomingTable).getByText('Today · 08/01/26')).toBeVisible()
  await userEvent.click(
    within(upcoming).getByRole('button', { name: 'Next page' }),
  )
  expect(within(upcoming).getByRole('status')).toHaveTextContent(
    'Showing 8–14 of 14',
  )
  expect(within(upcomingTable).getByText('08/14/26')).toBeVisible()
}

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
