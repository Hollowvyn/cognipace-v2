import { render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import type {
  ReadinessFailure,
  SerializedAnalyticsSummary,
} from '@/features/analytics/api/analytics-contracts'
import { createQueryTestHarness } from '@/testing/query-test-harness'
import { metricDefinitions } from '../domain/metric-definitions'

import { AnalyticsScreen } from './analytics-screen'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => (
    <a href="#/analytics?range=30">{children}</a>
  ),
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

function createReadyHistoricalReadiness() {
  const historicalReadiness = createUnreadyHistoricalReadiness()
  const ready = {
    ...historicalReadiness.requested,
    ready: true,
    effectiveBuckets: 10,
    effectiveStart: '2026-01-01',
    assessments: 58,
    activeBuckets: 10,
    minimumActiveBuckets: 8,
    failingReasons: [] as ReadinessFailure[],
  }

  return {
    ...historicalReadiness,
    requested: ready,
    recallQuality: { ...ready },
    practiceRhythm: { ...ready },
    ratingsMix: { ...ready },
    topics: { ...ready },
    stability: { ...ready },
    overdueBacklog: { ...ready },
    recommendedRange: null,
  }
}

function baseAnalyticsSummary(): SerializedAnalyticsSummary {
  return {
    range: 30,
    generatedAt: '2026-01-15T12:00:00.000Z',
    timeFrame: {
      asOf: '2026-01-15T12:00:00.000Z',
      timeZone: 'UTC',
      timeZoneFallback: false,
      requestedDays: 30,
      periodStart: '2025-12-17T00:00:00.000Z',
      periodEnd: '2026-01-16T00:00:00.000Z',
      buckets: [
        {
          key: '2025-12-17',
          start: '2025-12-17T00:00:00.000Z',
          end: '2025-12-20T00:00:00.000Z',
          startKey: '2025-12-17',
          endKey: '2025-12-19',
          isPartial: false,
        },
      ],
    },
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
    historicalReadiness: createReadyHistoricalReadiness(),
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

  it('keeps the selected-period summary content above the chart story', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(createAnalyticsSummary())

    renderAnalyticsScreen()

    const reviewDaysTile = await screen.findByLabelText('Review Days metric')
    expect(within(reviewDaysTile).getByText('42')).toBeVisible()
    expect(
      within(reviewDaysTile).getByText(
        'Days with at least one review in the selected 30-day period',
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
      await screen.findByText(/Observed correctness needs more data/),
    ).toBeVisible()
    expect(
      within(
        screen.getByLabelText(
          `${metricDefinitions.observedCorrectness.label} metric`,
        ),
      ).getByText('—'),
    ).toBeVisible()
  })

  it('keeps measured views visible while the selected range needs more evidence', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(createAnalyticsSummary())

    renderAnalyticsScreen()

    expect(
      await screen.findByRole('region', { name: 'Recall quality' }),
    ).toBeVisible()
    expect(
      screen.getByLabelText('30-day analytics readiness'),
    ).toBeVisible()
  })

  it('keeps the selected unready range while offering a ready shorter view and current-state panels', async () => {
    const readiness = {
      ...createUnreadyHistoricalReadiness().requested,
      requestedDays: 90,
      bucketDays: 7,
      requestedBuckets: 13,
      effectiveBuckets: 6,
      effectiveStart: '2026-01-19',
      assessments: 32,
      minimumAssessments: 45,
      activeBuckets: 4,
      minimumActiveBuckets: 5,
      failingReasons: [
        'insufficient-span',
        'insufficient-assessments',
        'insufficient-active-buckets',
      ] as ReadinessFailure[],
    }

    vi.mocked(sendMessage).mockResolvedValueOnce(
      readyAnalyticsSummary({
        range: 90,
        historicalReadiness: {
          requested: readiness,
          recallQuality: readiness,
          practiceRhythm: readiness,
          ratingsMix: readiness,
          topics: readiness,
          stability: readiness,
          overdueBacklog: readiness,
          recommendedRange: 30,
        },
      }),
    )

    renderAnalyticsScreen(90)

    expect(
      await screen.findByRole('status', {
        name: '90-day analytics readiness',
      }),
    ).toHaveTextContent('13 more assessments needed.')
    expect(
      screen.getByRole('link', { name: 'Use ready 30-day view' }),
    ).toHaveAttribute('href', expect.stringContaining('range=30'))
    expect(
      await screen.findByRole('region', { name: 'Recall quality' }),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Practice rhythm' }),
    ).toBeVisible()
    expect(
      within(
        screen.getByRole('status', { name: '90-day analytics readiness' }),
      ).getByText('13 more assessments needed.'),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Upcoming review load' }),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Retention health' }),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Fragile knowledge' }),
    ).toBeVisible()
  })

  it('shows an effective historical window when a ready range trims leading empty buckets', async () => {
    const readiness = {
      ...createReadyHistoricalReadiness().requested,
      requestedDays: 90,
      bucketDays: 7,
      requestedBuckets: 13,
      effectiveBuckets: 8,
      effectiveStart: '2025-12-01',
    }

    vi.mocked(sendMessage).mockResolvedValueOnce(
      readyAnalyticsSummary({
        range: 90,
        historicalReadiness: {
          requested: readiness,
          recallQuality: readiness,
          practiceRhythm: readiness,
          ratingsMix: readiness,
          topics: readiness,
          stability: readiness,
          overdueBacklog: readiness,
          recommendedRange: null,
        },
      }),
    )

    renderAnalyticsScreen(90)

    expect(
      await screen.findByText(
        'Showing 8 weeks of usable history from your selected 90-day range.',
      ),
    ).toBeVisible()
  })

  it('renders a metric-specific readiness state without hiding ready historical charts', async () => {
    const historicalReadiness = createReadyHistoricalReadiness()
    const practiceRhythm = {
      ...historicalReadiness.practiceRhythm,
      ready: false,
      assessments: 12,
      minimumAssessments: 24,
      failingReasons: ['insufficient-assessments'] as ReadinessFailure[],
    }

    vi.mocked(sendMessage).mockResolvedValueOnce(
      readyAnalyticsSummary({
        historicalReadiness: {
          ...historicalReadiness,
          practiceRhythm,
        },
      }),
    )

    renderAnalyticsScreen()

    expect(
      await screen.findByRole('status', { name: 'Practice rhythm readiness' }),
    ).toHaveTextContent('12 more assessments needed.')
    expect(
      screen.getByRole('heading', { level: 2, name: 'Practice rhythm' }),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Practice rhythm' }),
    ).toBeVisible()
    expect(screen.getByRole('region', { name: 'Ratings mix' })).toBeVisible()
  })

  it('renders the approved chart hierarchy with explanations and fragile knowledge', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(readyAnalyticsSummary())

    renderAnalyticsScreen()

    expect(
      await screen.findByRole('region', { name: 'Recall quality' }),
    ).toBeVisible()
    expect(
      within(screen.getByRole('region', { name: 'Recall quality' })).getByText(
        /The FSRS model estimate of retrievability immediately before a review/,
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Fragile knowledge' }),
    ).toBeVisible()
    expect(screen.getByText('Graph Traversal')).toBeVisible()

    const chartRegionNames = [
      'Recall quality',
      'Practice rhythm',
      'Ratings mix',
      'Where to focus',
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
      name: 'Practice rhythm',
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

function renderAnalyticsScreen(range?: 14 | 30 | 90) {
  const harness = createQueryTestHarness()
  render(<AnalyticsScreen range={range} />, { wrapper: harness.wrapper })
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
