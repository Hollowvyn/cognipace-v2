import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import type {
  ReadinessFailure,
  SerializedAnalyticsSummary,
} from '@/features/analytics/api/analytics-contracts'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { AnalyticsScreen } from './analytics-screen'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

function createUnreadyHistoricalReadiness() {
  const readiness = {
    ready: false,
    requestedDays: 30,
    bucketDays: 3,
    requestedBuckets: 10,
    effectiveBuckets: 0,
    effectiveStart: null,
    assessments: 0,
    minimumAssessments: 24,
    activeBuckets: 0,
    minimumActiveBuckets: 0,
    longestGap: 0,
    maximumGap: 2,
    gapRuns: 0,
    maximumGapRuns: 1,
    failingReasons: [
      'no-evidence',
      'insufficient-span',
      'insufficient-assessments',
      'insufficient-active-buckets',
    ] as ReadinessFailure[],
  }

  return {
    requested: readiness,
    recallQuality: readiness,
    practiceRhythm: readiness,
    ratingsMix: readiness,
    topics: readiness,
    stability: readiness,
    overdueBacklog: readiness,
    recommendedRange: null,
  }
}

function baseAnalyticsSummary(): SerializedAnalyticsSummary {
  return {
    chartDataStatus: 'unavailable',
    range: 30,
    periodStart: '2025-12-16T00:00:00.000Z',
    periodEnd: '2026-01-15T12:00:00.000Z',
    generatedAt: '2026-01-15T12:00:00.000Z',
    reviewDays: 42,
    totalReviews: 381,
    currentStreak: 7,
    observedRatingQuality: { value: 0.72, sampleSize: 58, lowSample: false },
    predictedRecall: { value: null, sampleSize: 0, lowSample: true },
    observedRatingSampleSize: 58,
    lowSample: false,
    memoryProfile: {
      totalTracked: 12,
      dueToday: 3,
      overdue: 1,
      learning: 2,
      review: 8,
      mastered: 1,
      suspended: 1,
      averageRetrievability: 0.74,
      lowSample: false,
    },
    dueForecast14Days: Array.from({ length: 14 }, (_, i) => ({
      date: `2026-01-${String(15 + i).padStart(2, '0')}`,
      dueCount: i === 0 ? 6 : (i + 1) * 3,
    })),
    weakProblems: [],
    targetRetention: 0.9,
    retentionScatter: [],
    retentionScatterCurve: [],
    historicalReadiness: createUnreadyHistoricalReadiness(),
    recallQuality: [],
    practiceRhythm: [],
    ratingsMix: [],
    hardAgain: {
      selectedShare: null,
      previousShare: null,
      delta: null,
      direction: null,
      sampleSize: 0,
      previousSampleSize: 0,
      lowSample: true,
      previousLowSample: true,
    },
    topics: [],
    stability: [],
    overdueBacklog: [],
    overdueHistoryAvailableFrom: null,
    upcomingLoad: Array.from({ length: 14 }, (_, index) => ({
      date: `2026-01-${String(15 + index).padStart(2, '0')}`,
      dueCount: 0,
      overdueCount: 0,
      today: index === 0,
    })),
    retentionHealth: [],
    fragileKnowledge: [],
  }
}

function createAnalyticsSummary(
  overrides: Partial<SerializedAnalyticsSummary> = {},
) {
  return { ...baseAnalyticsSummary(), ...overrides }
}

function readyAnalyticsSummary(
  overrides: Partial<SerializedAnalyticsSummary> = {},
): SerializedAnalyticsSummary {
  return createAnalyticsSummary({
    chartDataStatus: 'ready',
    recallQuality: [
      {
        bucketStart: '2026-01-14',
        bucketEnd: '2026-01-14',
        observedRecall: 0.78,
        predictedRecall: 0.84,
        targetRetention: 0.9,
        reviewCount: 12,
        eligibleSampleSize: 12,
      },
    ],
    practiceRhythm: [
      {
        bucketStart: '2026-01-12',
        bucketEnd: '2026-01-14',
        reviewCount: 4,
        observedCorrectness: 0.78,
        sampleSize: 12,
        associationOnly: true,
      },
    ],
    ratingsMix: [
      {
        bucketStart: '2026-01-14',
        bucketEnd: '2026-01-14',
        again: 1,
        hard: 2,
        good: 6,
        easy: 3,
        total: 12,
        hardAgainShare: 0.25,
      },
    ],
    topics: [
      {
        topic: 'Graphs',
        recallQuality: 0.61,
        sampleSize: 12,
        lowSample: false,
      },
    ],
    stability: [
      {
        bucketStart: '2026-01-12',
        bucketEnd: '2026-01-14',
        medianStabilityDays: 8.2,
        sampleSize: 12,
      },
    ],
    overdueBacklog: [
      {
        bucketStart: '2026-01-14',
        bucketEnd: '2026-01-14',
        overdueCount: 3,
        historyAvailable: true,
      },
    ],
    overdueHistoryAvailableFrom: '2026-01-14T00:00:00.000Z',
    upcomingLoad: Array.from({ length: 14 }, (_, index) => ({
      date: `2026-01-${String(15 + index).padStart(2, '0')}`,
      dueCount: index === 0 ? 5 : 0,
      overdueCount: index === 0 ? 1 : 0,
      today: index === 0,
    })),
    retentionHealth: [
      {
        slug: 'graph-traversal',
        title: 'Graph Traversal',
        retrievability: 0.86,
        targetRetention: 0.9,
        daysSinceReview: 3,
        stabilityDays: 4,
        difficulty: 7.8,
        lapseCount: 2,
        overdueDays: 1,
      },
    ],
    fragileKnowledge: [
      {
        slug: 'graph-traversal',
        title: 'Graph Traversal',
        retrievability: 0.86,
        stabilityDays: 4,
        difficulty: 7.8,
        lapseCount: 2,
        overdueDays: 1,
        topics: ['Graphs'],
      },
    ],
    ...overrides,
  })
}

describe('AnalyticsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state while analytics data is pending', () => {
    vi.mocked(sendMessage).mockReturnValueOnce(new Promise(() => {}))

    renderAnalyticsScreen()

    expect(screen.getByText('Loading analytics...')).toBeVisible()
  })

  it('renders error state then succeeds after retry', async () => {
    const user = userEvent.setup()
    const deferred = createDeferred<never>()
    vi.mocked(sendMessage)
      .mockReturnValueOnce(deferred.promise)
      .mockResolvedValueOnce(createAnalyticsSummary())

    renderAnalyticsScreen()

    deferred.reject(new Error('network error'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load Analytics.',
    )
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByLabelText('Review Days metric')).toBeVisible()
  })

  it('keeps summary and profile content that supports the chart story', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(createAnalyticsSummary())

    renderAnalyticsScreen()

    const reviewDaysTile = await screen.findByLabelText('Review Days metric')
    expect(within(reviewDaysTile).getByText('42')).toBeVisible()
    expect(
      within(screen.getByRole('region', { name: 'Memory profile' })).getByText(
        '3 due today',
      ),
    ).toBeVisible()
  })

  it('shows the observed-correctness low-sample warning', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      createAnalyticsSummary({
        lowSample: true,
        observedRatingQuality: { value: null, sampleSize: 7, lowSample: true },
        observedRatingSampleSize: 7,
      }),
    )

    renderAnalyticsScreen()

    expect(
      await screen.findByText(/Observed rating quality needs more data/),
    ).toBeVisible()
    expect(
      within(screen.getByLabelText('Observed rating quality metric')).getByText(
        '—',
      ),
    ).toBeVisible()
  })

  it('shows one unavailable chart state instead of partial or fabricated charts', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(createAnalyticsSummary())

    renderAnalyticsScreen()

    const emptyPanel = await screen.findByRole('region', {
      name: 'Analytics charts',
    })
    expect(
      within(emptyPanel).getByText(/Not enough valid review history/),
    ).toBeVisible()
    expect(
      screen.queryByRole('region', { name: 'Recall quality' }),
    ).not.toBeInTheDocument()
  })

  it('renders the approved chart hierarchy with explanations and fragile knowledge', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(readyAnalyticsSummary())

    renderAnalyticsScreen()

    expect(
      await screen.findByRole('region', { name: 'Recall quality' }),
    ).toBeVisible()
    expect(
      within(screen.getByRole('region', { name: 'Recall quality' })).getByText(
        /FSRS model estimate of retrievability immediately before a review/,
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Fragile knowledge' }),
    ).toBeVisible()
    expect(screen.getByText('Graph Traversal')).toBeVisible()

    const chartRegionNames = [
      'Recall quality',
      'Practice rhythm vs observed correctness',
      'Ratings mix',
      'Weakest topics',
      'Memory strength',
      'Recent overdue backlog',
      'Upcoming review load',
      'Retention health',
      'Fragile knowledge',
    ]
    const regionOrder = screen.getAllByRole('region').map((region) => {
      const labelledBy = region.getAttribute('aria-labelledby')
      return labelledBy
        ? document.getElementById(labelledBy)?.textContent
        : region.getAttribute('aria-label')
    })
    const chartOrder = regionOrder.filter((name) =>
      chartRegionNames.includes(name ?? ''),
    )

    expect(chartOrder).toEqual(chartRegionNames)
    const practiceRhythm = screen.getByRole('region', {
      name: 'Practice rhythm vs observed correctness',
    })
    expect(
      within(practiceRhythm).getByText(
        /Review volume per selected adaptive time bucket/,
      ),
    ).toBeVisible()
    expect(screen.queryByText(/practice days \/ week/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/weekly assessed reviews/i),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: '14-day due forecast' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Weak problems' }),
    ).not.toBeInTheDocument()
  })

  it('renders chart-level empty states when the service is ready but a series is empty', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      readyAnalyticsSummary({
        recallQuality: [],
        fragileKnowledge: [],
      }),
    )

    renderAnalyticsScreen()

    const recallPanel = await screen.findByRole('region', {
      name: 'Recall quality',
    })
    expect(
      within(recallPanel).getByText(
        'Not enough review data for recall quality yet.',
      ),
    ).toBeVisible()
    expect(
      within(
        screen.getByRole('region', { name: 'Fragile knowledge' }),
      ).getByText(/No fragile knowledge detected/),
    ).toBeVisible()
  })
})

function renderAnalyticsScreen() {
  const harness = createQueryTestHarness()
  render(<AnalyticsScreen />, { wrapper: harness.wrapper })
  return harness
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
