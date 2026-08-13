import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  ConsistencyChart,
  MemoryStrengthChart,
  OverdueBacklogChart,
  RatingsMixChart,
  RecallQualityChart,
  RetentionHealthChart,
  UpcomingReviewLoadChart,
  WeakestTopicsChart,
} from './index'
import type {
  ConsistencyPoint,
  OverdueBacklogPoint,
  RatingsMixPoint,
  RecallQualityPoint,
  RetentionHealthPoint,
  StabilityPoint,
  TopicPoint,
  UpcomingLoadPoint,
} from './types'

const recallQuality: RecallQualityPoint[] = [
  {
    date: '2026-08-01',
    observedRecall: 0.72,
    predictedRecall: 0.81,
    targetRetention: 0.9,
    reviewCount: 12,
    eligibleSampleSize: 12,
  },
  {
    date: '2026-08-02',
    observedRecall: 0.8,
    predictedRecall: 0.84,
    targetRetention: 0.9,
    reviewCount: 14,
    eligibleSampleSize: 14,
  },
]

const consistency: ConsistencyPoint[] = [
  {
    week: '2026-07-27',
    reviewDays: 4,
    observedCorrectness: 0.78,
    sampleSize: 22,
    associationOnly: true,
  },
]

const ratingsMix: RatingsMixPoint[] = [
  {
    date: '2026-08-01',
    again: 1,
    hard: 2,
    good: 6,
    easy: 3,
    total: 12,
    hardAgainShare: 0.25,
  },
]

const topics: TopicPoint[] = [
  { topic: 'Graphs', recallQuality: 0.61, sampleSize: 14, lowSample: false },
  { topic: 'Trees', recallQuality: 0.74, sampleSize: 18, lowSample: false },
]

const stability: StabilityPoint[] = [
  { week: '2026-07-27', medianStabilityDays: 4.2, sampleSize: 10 },
]

const overdue: OverdueBacklogPoint[] = [
  { date: '2026-08-01', overdueCount: 3, historyAvailable: true },
  { date: '2026-08-02', overdueCount: 4, historyAvailable: true },
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
        <ConsistencyChart data={consistency} />
        <RatingsMixChart data={ratingsMix} />
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
        name: 'Consistency versus observed correctness chart',
      }),
    ).toBeVisible()
    expect(screen.getByRole('img', { name: 'Ratings mix chart' })).toBeVisible()
    expect(
      screen.getByRole('img', { name: 'Weakest topics chart' }),
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
    expect(document.querySelectorAll('svg')).toHaveLength(8)
  })

  it('surfaces the Hard + Again share and overdue watch zone in plain language', () => {
    render(
      <div>
        <RatingsMixChart data={ratingsMix} />
        <OverdueBacklogChart
          data={overdue}
          historyAvailableFrom="2026-08-01T00:00:00.000Z"
        />
      </div>,
    )

    expect(screen.getByText(/Hard \+ Again share:/)).toHaveTextContent('25%')
    expect(screen.getByText(/5-problem watch zone/)).toBeVisible()
  })

  it('does not fabricate chart values when the source data is empty', () => {
    render(
      <div>
        <RecallQualityChart data={[]} />
        <ConsistencyChart data={[]} />
        <RatingsMixChart data={[]} />
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
        'Not enough observed correctness data for a practice rhythm comparison yet.',
      ),
    ).toBeVisible()
    expect(
      screen.getByText('No review ratings in this period yet.'),
    ).toBeVisible()
    expect(screen.getByText('No topic-level recall data yet.')).toBeVisible()
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
