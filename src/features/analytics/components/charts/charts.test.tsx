import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  MemoryStrengthChart,
  OverdueBacklogChart,
  PracticeRhythmChart,
  RatingsMixChart,
  RecallQualityChart,
  RetentionHealthChart,
  UpcomingReviewLoadChart,
  WeakestTopicsChart,
} from './index'
import { analyticsChartDefinitions } from './chart-definitions'
import { buildOverdueBacklogChartSeries } from './overdue-backlog-chart'
import { ratingsMixStackOffset } from './ratings-mix-chart'
import type {
  OverdueBacklogPoint,
  PracticeRhythmPoint,
  RatingsMixPoint,
  RecallQualityPoint,
  RetentionHealthPoint,
  StabilityPoint,
  TopicPoint,
  UpcomingLoadPoint,
} from './types'

const recallQuality: RecallQualityPoint[] = [
  {
    bucketStart: '2026-08-01',
    bucketEnd: '2026-08-01',
    observedRecall: 0.72,
    predictedRecall: 0.81,
    targetRetention: 0.9,
    reviewCount: 12,
    eligibleSampleSize: 12,
  },
  {
    bucketStart: '2026-08-02',
    bucketEnd: '2026-08-02',
    observedRecall: null,
    predictedRecall: 0.84,
    targetRetention: 0.9,
    reviewCount: 14,
    eligibleSampleSize: 14,
  },
  {
    bucketStart: '2026-08-03',
    bucketEnd: '2026-08-03',
    observedRecall: 0.8,
    predictedRecall: 0.84,
    targetRetention: 0.9,
    reviewCount: 14,
    eligibleSampleSize: 14,
  },
]

const practiceRhythm: PracticeRhythmPoint[] = [
  {
    bucketStart: '2026-08-01',
    bucketEnd: '2026-08-01',
    reviewCount: 4,
    observedCorrectness: 0.78,
    sampleSize: 22,
    associationOnly: true,
  },
  {
    bucketStart: '2026-08-02',
    bucketEnd: '2026-08-02',
    reviewCount: 3,
    observedCorrectness: null,
    sampleSize: 0,
    associationOnly: true,
  },
  {
    bucketStart: '2026-08-03',
    bucketEnd: '2026-08-03',
    reviewCount: 5,
    observedCorrectness: 0.84,
    sampleSize: 18,
    associationOnly: true,
  },
]

const ratingsMix: RatingsMixPoint[] = [
  {
    bucketStart: '2026-08-01',
    bucketEnd: '2026-08-01',
    again: 1,
    hard: 2,
    good: 6,
    easy: 3,
    total: 12,
    hardAgainShare: 0.25,
  },
]

const hardAgain = {
  selectedShare: 0.25,
  previousShare: 0.34,
  delta: -0.09,
  direction: 'down' as const,
  sampleSize: 12,
  previousSampleSize: 20,
  lowSample: false,
  previousLowSample: false,
}

const topics: TopicPoint[] = [
  { topic: 'Graphs', recallQuality: 0.61, sampleSize: 14, lowSample: false },
  { topic: 'Trees', recallQuality: 0.74, sampleSize: 18, lowSample: false },
  { topic: 'Arrays', recallQuality: 0.79, sampleSize: 16, lowSample: false },
  { topic: 'Design', recallQuality: 0.63, sampleSize: 3, lowSample: true },
]

const stability: StabilityPoint[] = [
  {
    bucketStart: '2026-07-27',
    bucketEnd: '2026-08-02',
    medianStabilityDays: 4.2,
    sampleSize: 10,
  },
]

const overdue: OverdueBacklogPoint[] = [
  {
    bucketStart: '2026-08-01',
    bucketEnd: '2026-08-01',
    overdueCount: 3,
    historyAvailable: true,
  },
  {
    bucketStart: '2026-08-02',
    bucketEnd: '2026-08-02',
    overdueCount: 5,
    historyAvailable: true,
  },
  {
    bucketStart: '2026-08-03',
    bucketEnd: '2026-08-03',
    overdueCount: 7,
    historyAvailable: true,
  },
]

const upcoming: UpcomingLoadPoint[] = [
  { date: '2026-08-13', dueCount: 8, overdueCount: 2, today: true },
  { date: '2026-08-14', dueCount: 4, overdueCount: 0, today: false },
]

const retentionHealth: RetentionHealthPoint[] = [
  {
    slug: 'graphs-bfs',
    title: 'Breadth-first search',
    retrievability: 0.94,
    targetRetention: 0.9,
    daysSinceReview: 2,
    stabilityDays: 10,
    difficulty: 4.2,
    lapseCount: 0,
    overdueDays: 0,
  },
  {
    slug: 'graphs-dijkstra',
    title: 'Dijkstra',
    retrievability: 0.74,
    targetRetention: 0.9,
    daysSinceReview: 8,
    stabilityDays: 3,
    difficulty: 7.4,
    lapseCount: 1,
    overdueDays: 2,
  },
]

describe('analytics chart components', () => {
  it('renders every primary chart with an accessible chart surface', () => {
    render(
      <div>
        <RecallQualityChart data={recallQuality} />
        <PracticeRhythmChart data={practiceRhythm} />
        <RatingsMixChart data={ratingsMix} summary={hardAgain} />
        <WeakestTopicsChart data={topics} />
        <MemoryStrengthChart data={stability} />
        <OverdueBacklogChart
          data={overdue}
          historyAvailableFrom="2026-08-01T00:00:00.000Z"
        />
        <UpcomingReviewLoadChart data={upcoming} />
        <RetentionHealthChart data={retentionHealth} targetRetention={0.9} />
      </div>,
    )

    expect(
      screen.getByRole('img', { name: 'Recall quality chart' }),
    ).toBeVisible()
    expect(
      screen.getByRole('img', {
        name: 'Practice rhythm chart',
      }),
    ).toBeVisible()
    expect(screen.getByRole('img', { name: 'Ratings mix chart' })).toBeVisible()
    expect(
      screen.getByRole('img', { name: 'Where to focus chart' }),
    ).toBeVisible()
    expect(
      screen.getByRole('img', { name: 'Memory strength chart' }),
    ).toBeVisible()
    expect(
      screen.getByRole('img', { name: 'Recent overdue backlog chart' }),
    ).toBeVisible()
    expect(
      screen.getByRole('img', { name: 'Upcoming review load chart' }),
    ).toBeVisible()
    expect(
      screen.getByRole('img', { name: 'Retention health chart' }),
    ).toBeVisible()
    expect(document.querySelectorAll('svg')).toHaveLength(10)
  })

  it('tells the adaptive historical story with explicit, semantic chart marks', () => {
    render(
      <div>
        <RecallQualityChart data={recallQuality} />
        <PracticeRhythmChart data={practiceRhythm} />
        <RatingsMixChart data={ratingsMix} summary={hardAgain} />
        <WeakestTopicsChart data={topics} />
        <MemoryStrengthChart data={stability} />
        <OverdueBacklogChart
          data={overdue}
          historyAvailableFrom="2026-08-01T00:00:00.000Z"
        />
        <UpcomingReviewLoadChart data={upcoming} />
      </div>,
    )

    expect(
      within(
        screen.getByRole('img', { name: 'Practice rhythm chart' }),
      ).getByText('Observed correctness'),
    ).toBeInTheDocument()
    expect(screen.getAllByTestId('practice-review-bars')).not.toHaveLength(0)
    expect(
      screen
        .getAllByTestId('practice-review-bars')
        .some(
          (mark) =>
            mark.getAttribute('fill') ===
            analyticsChartDefinitions.practiceRhythm.series[0].color,
        ),
    ).toBe(true)
    expect(screen.getByTestId('practice-correctness-lines')).toHaveAttribute(
      'stroke',
      'transparent',
    )
    expect(
      screen.getByTestId('practice-correctness-lines-bridge-0-2'),
    ).toHaveAttribute('stroke-dasharray', '5 5')
    expect(screen.getByText('Association, not causation.')).toBeVisible()
    expect(screen.getByText('Again')).toHaveStyle({
      color: 'var(--cp-analytics-again)',
    })
    expect(screen.getByText('Hard')).toHaveStyle({
      color: 'var(--cp-analytics-hard)',
    })
    expect(screen.getByText('Good')).toHaveStyle({
      color: 'var(--cp-analytics-good)',
    })
    expect(screen.getByText('Easy')).toHaveStyle({
      color: 'var(--cp-analytics-easy)',
    })
    expect(ratingsMixStackOffset).toBe('expand')
    expect(
      screen.getByText(/^Showing the five weakest sufficiently sampled topics/),
    ).toBeVisible()
    expect(
      screen.getAllByText(/Dashed line crosses a period/),
    ).not.toHaveLength(0)
    expect(
      screen.getByText('Target retention', { selector: 'span' }),
    ).toBeVisible()
    expect(screen.getByText('Watch zone · 5')).toBeVisible()
    expect(
      screen
        .getAllByTestId('backlog-healthy-range')
        .some(
          (mark) =>
            mark.getAttribute('stroke') ===
            analyticsChartDefinitions.overdueBacklog.series[2].color,
        ),
    ).toBe(true)
    expect(
      screen
        .getAllByTestId('backlog-attention-range')
        .some(
          (mark) =>
            mark.getAttribute('stroke') ===
            analyticsChartDefinitions.overdueBacklog.series[3].color,
        ),
    ).toBe(true)
    expect(
      buildOverdueBacklogChartSeries(overdue).map(
        (point) => point.healthyRange,
      ),
    ).toEqual([3, 5, null])
    expect(
      buildOverdueBacklogChartSeries(overdue).map(
        (point) => point.attentionRange,
      ),
    ).toEqual([null, null, 7])
    const lineGradient = document.querySelector('#backlog-line-gradient')
    expect(lineGradient).toHaveAttribute('y1', '0')
    expect(lineGradient).toHaveAttribute('y2', '1')
    expect(lineGradient?.querySelectorAll('stop')[1]).toHaveAttribute(
      'offset',
      `${(1 - 5 / 7) * 100}%`,
    )
    expect(lineGradient?.querySelectorAll('stop')[1]).toHaveAttribute(
      'stop-color',
      analyticsChartDefinitions.overdueBacklog.series[3].color,
    )
    expect(lineGradient?.querySelectorAll('stop')[2]).toHaveAttribute(
      'stop-color',
      analyticsChartDefinitions.overdueBacklog.series[2].color,
    )
    expect(screen.getByText(/Next 14 days/)).toBeVisible()
    expect(screen.getByText(/Hard \+ Again this period:/)).toHaveTextContent(
      '25%',
    )
    expect(screen.getByText(/Hard \+ Again this period:/)).toHaveTextContent(
      'down 9 points',
    )
    expect(screen.getByText(/threshold status/i)).toBeVisible()
  })

  it('uses the catalogue as the visible semantic source for every Task 6 chart', () => {
    render(
      <div>
        <RecallQualityChart data={recallQuality} />
        <PracticeRhythmChart data={practiceRhythm} />
        <RatingsMixChart data={ratingsMix} summary={hardAgain} />
        <WeakestTopicsChart data={topics} />
        <MemoryStrengthChart data={stability} />
        <OverdueBacklogChart
          data={overdue}
          historyAvailableFrom="2026-08-01T00:00:00.000Z"
        />
        <UpcomingReviewLoadChart data={upcoming} />
      </div>,
    )

    const definitions = [
      analyticsChartDefinitions.recallQuality,
      analyticsChartDefinitions.practiceRhythm,
      analyticsChartDefinitions.ratingsMix,
      analyticsChartDefinitions.weakestTopics,
      analyticsChartDefinitions.memoryStrength,
      analyticsChartDefinitions.overdueBacklog,
      analyticsChartDefinitions.upcomingLoad,
    ]

    for (const definition of definitions) {
      expect(
        screen.getByTestId(`analytics-chart-${definition.id}`),
      ).toHaveAttribute('data-chart-definition', definition.id)
      expect(
        screen.getByRole('img', { name: `${definition.title} chart` }),
      ).toBeVisible()
    }

    expect(
      within(
        screen.getByRole('img', { name: 'Recall quality chart' }),
      ).getByText(analyticsChartDefinitions.recallQuality.series[0].label),
    ).toBeVisible()
    expect(
      within(
        screen.getByRole('img', { name: 'Practice rhythm chart' }),
      ).getByText(analyticsChartDefinitions.practiceRhythm.series[0].label),
    ).toBeVisible()
    expect(
      screen.getByText(analyticsChartDefinitions.ratingsMix.series[0].label),
    ).toBeVisible()
  })

  it('renders recall’s latest values without inventing a previous-period comparison', () => {
    render(<RecallQualityChart data={recallQuality} />)

    expect(screen.getByText('Latest observed 80%')).toBeVisible()
    expect(screen.getByText('84%', { selector: 'dd' })).toBeVisible()
    expect(screen.getByText('14 reviews', { selector: 'dd' })).toBeVisible()
    expect(
      screen.getByText(/Previous-period comparison is unavailable/),
    ).toBeVisible()
    expect(screen.getByTestId('recall-target-reference')).toBeInTheDocument()
    expect(screen.getByTestId('recall-observed-lines')).toHaveAttribute(
      'stroke',
      'transparent',
    )
    expect(screen.getByTestId('recall-predicted-lines')).toHaveAttribute(
      'stroke',
      'transparent',
    )
  })

  it('keeps unknown overdue buckets as nullable chart gaps', () => {
    const [firstOverdue, secondOverdue] = overdue

    if (firstOverdue === undefined || secondOverdue === undefined) {
      throw new Error('The overdue chart fixture requires two known buckets.')
    }

    const chartData = buildOverdueBacklogChartSeries([
      firstOverdue,
      {
        bucketStart: '2026-08-02',
        bucketEnd: '2026-08-02',
        overdueCount: null,
        historyAvailable: false,
      },
      secondOverdue,
    ])

    expect(chartData).toHaveLength(3)
    expect(chartData[1]).toMatchObject({
      overdueCount: null,
      historyAvailable: false,
    })
  })

  it('uses adaptive buckets, not weekly practice days, for practice rhythm', () => {
    render(<PracticeRhythmChart data={practiceRhythm} />)

    expect(
      screen.getByText(
        analyticsChartDefinitions.practiceRhythm.series[0].label,
        { selector: 'span' },
      ),
    ).toBeVisible()
    expect(document.querySelector('svg desc')).toHaveTextContent(
      'adaptive presentation bucket',
    )
  })

  it('explains recall samples and low-sample topic labels', () => {
    render(
      <div>
        <RecallQualityChart data={recallQuality} />
        <WeakestTopicsChart
          data={[
            {
              topic: 'Graphs',
              recallQuality: 0.61,
              sampleSize: 2,
              lowSample: true,
            },
          ]}
        />
      </div>,
    )

    expect(
      screen.getByText(/Predicted recall is an FSRS estimate/),
    ).toBeVisible()
    expect(
      screen.getByText('No sufficiently sampled topics to rank yet.'),
    ).toBeVisible()
  })

  it('uses bucket-aware copy for adaptive historical charts', () => {
    render(
      <div>
        <RecallQualityChart data={recallQuality} />
        <RatingsMixChart data={ratingsMix} summary={hardAgain} />
        <MemoryStrengthChart data={stability} />
      </div>,
    )

    expect(
      screen.getByText(/Tooltips show the eligible review sample/i),
    ).toBeVisible()
    const descriptions = Array.from(document.querySelectorAll('svg desc'))
      .map((description) => description.textContent)
      .join(' ')
    expect(descriptions).toContain('adaptive presentation bucket')
    expect(descriptions).not.toMatch(/daily|by week/i)
  })

  it('does not fabricate chart values when the source data is empty', () => {
    render(
      <div>
        <RecallQualityChart data={[]} />
        <PracticeRhythmChart data={[]} />
        <RatingsMixChart
          data={[]}
          summary={{
            selectedShare: null,
            previousShare: null,
            delta: null,
            direction: null,
            sampleSize: 0,
            previousSampleSize: 0,
            lowSample: true,
            previousLowSample: true,
          }}
        />
        <WeakestTopicsChart data={[]} />
        <MemoryStrengthChart data={[]} />
        <OverdueBacklogChart data={[]} historyAvailableFrom={null} />
        <UpcomingReviewLoadChart data={[]} />
        <RetentionHealthChart data={[]} targetRetention={0.9} />
      </div>,
    )

    expect(
      screen.getByText('Not enough review data for recall quality yet.'),
    ).toBeVisible()
    expect(
      screen.getByText(
        'Not enough review data for a practice rhythm comparison yet.',
      ),
    ).toBeVisible()
    expect(
      screen.getByText('No review ratings in this period yet.'),
    ).toBeVisible()
    expect(
      screen.getByText('No sufficiently sampled topics to rank yet.'),
    ).toBeVisible()
    expect(
      screen.getByText('No memory strength trend available yet.'),
    ).toBeVisible()
    expect(
      screen.getByText('Overdue history is not available yet.'),
    ).toBeVisible()
    expect(
      screen.getByText('No upcoming review load to show yet.'),
    ).toBeVisible()
    expect(screen.getByText('No retention health data yet.')).toBeVisible()
  })
})
