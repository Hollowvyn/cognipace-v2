import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import type { SerializedAnalyticsSummary } from '@/features/analytics/api/analytics-contracts'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { AnalyticsScreen } from './analytics-screen'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

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
    observedRecallQuality: { value: 0.72, sampleSize: 58, lowSample: false },
    predictedRecall: { value: 0.72, sampleSize: 58, lowSample: false },
    retentionSampleSize: 58,
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
    weakProblems: [
      {
        slug: 'longest-substring-without-repeating-characters',
        title: 'Longest Substring Without Repeating',
        lapseCount: 5,
        difficulty: 0.6,
        retrievability: 0.28,
      },
    ],
    targetRetention: 0.9,
    retentionScatter: [
      {
        slug: 'two-sum',
        title: 'Two Sum',
        retrievability: 0.95,
        daysSinceReview: 3,
        difficulty: 0.3,
        stability: 10.5,
        lapseCount: 0,
        lastReviewAt: '2026-01-12T10:00:00.000Z',
      },
    ],
    retentionScatterCurve: [
      { days: 0, retrievability: 1.0 },
      { days: 14, retrievability: 0.9 },
    ],
    recallQuality: [],
    consistency: [],
    ratingsMix: [],
    topics: [],
    stability: [],
    overdueBacklog: [],
    upcomingLoad: [],
    retentionHealth: [],
    fragileKnowledge: [],
  }
}

function createAnalyticsSummary(
  overrides: Partial<SerializedAnalyticsSummary> = {},
) {
  return { ...baseAnalyticsSummary(), ...overrides }
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

    expect(screen.getByText('Loading analytics...')).toBeVisible()

    deferred.reject(new Error('network error'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load Analytics.',
    )
    const retryButton = screen.getByRole('button', { name: 'Retry' })
    expect(retryButton).toBeVisible()

    await user.click(retryButton)

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledTimes(2)
    })
    const reviewDaysTile = await screen.findByLabelText('Review Days metric')
    expect(within(reviewDaysTile).getByText('42')).toBeVisible()
  })

  it('renders metric tiles with correct values', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(createAnalyticsSummary())

    renderAnalyticsScreen()

    const reviewDaysTile = await screen.findByLabelText('Review Days metric')
    expect(within(reviewDaysTile).getByText('42')).toBeVisible()

    const totalReviewsTile = screen.getByLabelText('Total Reviews metric')
    expect(within(totalReviewsTile).getByText('381')).toBeVisible()

    const retentionTile = screen.getByLabelText('Retention metric')
    expect(within(retentionTile).getByText('72%')).toBeVisible()
  })

  it('renders memory profile totals and retrievability', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(createAnalyticsSummary())

    renderAnalyticsScreen()

    const memoryProfile = await screen.findByRole('region', {
      name: 'Memory profile',
    })

    expect(
      within(memoryProfile).getByRole('heading', { name: 'Memory Profile' }),
    ).toBeVisible()
    expect(within(memoryProfile).getByText('12')).toBeVisible()
    expect(within(memoryProfile).getByText('74%')).toBeVisible()
    expect(within(memoryProfile).getByText('3 due today')).toBeVisible()
  })

  it('shows limited-sample caveat when memory profile has a non-null low-sample average', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      createAnalyticsSummary({
        memoryProfile: {
          ...baseAnalyticsSummary().memoryProfile,
          averageRetrievability: 0.74,
          lowSample: true,
        },
      }),
    )

    renderAnalyticsScreen()

    const memoryProfile = await screen.findByRole('region', {
      name: 'Memory profile',
    })

    expect(within(memoryProfile).getByText('74%')).toBeVisible()
    expect(
      within(memoryProfile).getByText('Limited review sample'),
    ).toBeVisible()
  })

  it('renders not-enough-review-data state for memory profile average', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      createAnalyticsSummary({
        memoryProfile: {
          ...baseAnalyticsSummary().memoryProfile,
          averageRetrievability: null,
          lowSample: true,
        },
      }),
    )

    renderAnalyticsScreen()

    const memoryProfile = await screen.findByRole('region', {
      name: 'Memory profile',
    })

    expect(
      within(memoryProfile).getByText('Not enough review data'),
    ).toBeVisible()
  })

  it('renders 14 forecast bars with a Today label', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(createAnalyticsSummary())

    renderAnalyticsScreen()

    const forecastRegion = await screen.findByRole('region', {
      name: '14-day due forecast',
    })
    expect(screen.getAllByTestId('forecast-bar')).toHaveLength(14)
    expect(
      within(forecastRegion).getAllByText('Today').length,
    ).toBeGreaterThanOrEqual(1)
  })

  it('renders weak problem rows with lapse count and retention', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(createAnalyticsSummary())

    renderAnalyticsScreen()

    const weakSection = await screen.findByRole('region', {
      name: 'Weak problems',
    })
    expect(
      within(weakSection).getByText('Longest Substring Without Repeating'),
    ).toBeVisible()
    expect(within(weakSection).getByText('5 lapses')).toBeVisible()
    expect(within(weakSection).getByText('28%')).toBeVisible()
  })

  it('shows warning notice and dash retention when lowSample is true', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      createAnalyticsSummary({
        lowSample: true,
        observedRecallQuality: { value: null, sampleSize: 7, lowSample: true },
        retentionSampleSize: 7,
      }),
    )

    renderAnalyticsScreen()

    expect(await screen.findByText(/Retention needs more data/)).toBeVisible()
    const retentionTile = screen.getByLabelText('Retention metric')
    expect(within(retentionTile).getByText('—')).toBeVisible()
  })

  it('renders empty-state message when there are no weak problems', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      createAnalyticsSummary({ weakProblems: [] }),
    )

    renderAnalyticsScreen()

    await screen.findByRole('region', { name: 'Weak problems' })
    expect(
      screen.getByText('No weak problems found — keep it up!'),
    ).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('resolves forecast and weak problems sections by accessible role', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(createAnalyticsSummary())

    renderAnalyticsScreen()

    expect(
      await screen.findByRole('region', { name: '14-day due forecast' }),
    ).toBeVisible()
    expect(screen.getByRole('region', { name: 'Weak problems' })).toBeVisible()
  })

  it('renders retention health region when scatter data is present', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(createAnalyticsSummary())

    renderAnalyticsScreen()

    expect(
      await screen.findByRole('region', { name: 'Retention health' }),
    ).toBeVisible()
  })

  it('renders retention health empty state when scatter is empty', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce(
      createAnalyticsSummary({ retentionScatter: [] }),
    )

    renderAnalyticsScreen()

    await screen.findByRole('region', { name: 'Retention health' })
    expect(screen.getByText(/No reviewed problems yet/)).toBeVisible()
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
