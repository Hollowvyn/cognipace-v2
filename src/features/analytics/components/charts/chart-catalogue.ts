import type { AnalyticsViewId } from '../../api/analytics-presentation-contracts'

export interface AnalyticsViewDefinition {
  id: AnalyticsViewId
  title: string
  question: string
  metricMeaning: string
  scope: 'historical' | 'selected-period' | 'current-state' | 'fixed-forecast'
  units: readonly string[]
  tooltipFields: readonly string[]
  tableColumns: readonly string[]
  emptyState: string
  interpretationWarning?: string
}

export const analyticsViewCatalogue = {
  'observed-recall-vs-fsrs': {
    id: 'observed-recall-vs-fsrs',
    title: 'Observed Recall vs FSRS Estimate',
    question:
      'How did recalled review outcomes compare with the FSRS estimate?',
    metricMeaning:
      'Compares rating-derived recalled outcomes with FSRS retrievability immediately before those same reviews.',
    scope: 'historical',
    units: ['percentage', 'reviews'],
    tooltipFields: [
      'Bucket',
      'Recalled',
      'Paired reviews',
      'Observed recall',
      'FSRS estimate',
      'Difference',
      'Provenance',
      'Evidence',
      'Partial state',
    ],
    tableColumns: [
      'Bucket',
      'Recalled',
      'Paired reviews',
      'Observed recall',
      'FSRS estimate',
      'Difference',
      'Provenance',
      'Evidence',
    ],
    emptyState:
      'No reviews in this period have both a valid rating and an FSRS estimate.',
  },
  'memory-strength': {
    id: 'memory-strength',
    title: 'Memory Strength',
    question: 'Are your reviewed memories staying strong for longer?',
    metricMeaning:
      'Shows the typical number of days FSRS expects reviewed memories to remain retrievable after review.',
    scope: 'historical',
    units: ['days', 'reviews'],
    tooltipFields: [
      'Bucket',
      'Median strength',
      'Middle 50%',
      'Eligible reviews',
      'Median change',
      'Provenance',
      'Partial state',
    ],
    tableColumns: [
      'Bucket',
      'Median strength',
      'Middle 50%',
      'Eligible reviews',
      'Median change',
      'Provenance',
      'Evidence',
    ],
    emptyState:
      'No valid post-review FSRS stability is available in this period.',
  },
  'practice-rhythm': {
    id: 'practice-rhythm',
    title: 'Practice Rhythm',
    question: 'When you practiced more or less, how did Review Success move?',
    metricMeaning:
      'Shows whether heavier or lighter practice coincided with more comfortable review outcomes.',
    scope: 'historical',
    units: ['reviews', 'percentage'],
    tooltipFields: [
      'Bucket',
      'Completed reviews',
      'Review Success',
      'Good + Easy',
      'Evidence',
      'Partial state',
    ],
    tableColumns: [
      'Bucket',
      'Completed reviews',
      'Good + Easy',
      'Review Success',
      'Evidence',
    ],
    emptyState: 'No valid review ratings are available in this period.',
    interpretationWarning: 'Association, not causation.',
  },
  'ratings-mix': {
    id: 'ratings-mix',
    title: 'Ratings Mix',
    question: 'How is the balance of your review ratings changing?',
    metricMeaning:
      'Shows the changing share of Again, Hard, Good, and Easy ratings over the selected period.',
    scope: 'historical',
    units: ['percentage', 'ratings'],
    tooltipFields: [
      'Bucket',
      'Again',
      'Hard',
      'Good',
      'Easy',
      'Valid ratings',
      'Partial state',
    ],
    tableColumns: [
      'Bucket',
      'Again',
      'Hard',
      'Good',
      'Easy',
      'Valid ratings',
      'Challenging reviews',
      'Evidence',
    ],
    emptyState: 'No valid review ratings are available in this period.',
  },
  'topic-performance': {
    id: 'topic-performance',
    title: 'Topic Performance',
    question: 'Which sufficiently practiced topics had lower Review Success?',
    metricMeaning:
      'Ranks sufficiently sampled topics by rating-derived Review Success in the selected period.',
    scope: 'selected-period',
    units: ['percentage', 'ratings', 'problems'],
    tooltipFields: [
      'Topic',
      'Review Success',
      'Good + Easy',
      'Valid ratings',
      'Distinct reviewed problems',
      'Selected period',
      'Evidence',
    ],
    tableColumns: [
      'Topic',
      'Review Success',
      'Good + Easy',
      'Valid ratings',
      'Distinct problems',
      'Evidence',
    ],
    emptyState:
      'No topic has at least 10 valid ratings across 3 reviewed problems in this period.',
  },
  'retention-map': {
    id: 'retention-map',
    title: 'Retention Map',
    question:
      'Which active memories are below target, and how durable are they?',
    metricMeaning:
      'Maps current FSRS recall against the total time each active memory is expected to remain above the configured target.',
    scope: 'current-state',
    units: ['percentage', 'days'],
    tooltipFields: [
      'Problem',
      'Current status',
      'Current recall',
      'Time above target',
      'Target gap',
      'Last reviewed',
    ],
    tableColumns: [
      'Rank',
      'Problem',
      'Current recall',
      'Target',
      'Target gap',
      'Time above target',
      'Last reviewed',
      'Due',
      'Difficulty',
      'Lapses',
      'Status',
    ],
    emptyState:
      'No active reviewed problems have enough current FSRS data for the Retention Map.',
  },
  'memory-signals': {
    id: 'memory-signals',
    title: 'Memory Signals by Problem',
    question:
      'Which current problems need attention, and exactly why were they flagged?',
    metricMeaning:
      'Lists current problems below target, overdue, or supported by less than one week of FSRS durability.',
    scope: 'current-state',
    units: ['percentage', 'days'],
    tooltipFields: ['Problem', "Why it's here"],
    tableColumns: ['Rank', 'Problem', "Why it's here"],
    emptyState: 'No current problems meet these attention signals.',
  },
  'overdue-backlog': {
    id: 'overdue-backlog',
    title: 'Recent Overdue Backlog',
    question:
      'Is my overdue backlog staying at an acceptable level instead of accumulating?',
    metricMeaning:
      'Shows the daily number of active problems overdue at each observation, compared with the five-problem watch zone.',
    scope: 'historical',
    units: ['problems'],
    tooltipFields: ['Date', 'Overdue problems', 'In progress'],
    tableColumns: ['Date', 'Overdue problems'],
    emptyState:
      'Historical overdue backlog could not be reconstructed for this period.',
  },
  'upcoming-review-load': {
    id: 'upcoming-review-load',
    title: 'Upcoming Review Load',
    question: 'What review work is currently scheduled for the next 14 days?',
    metricMeaning:
      'Shows the current number of due and already overdue active reviews for today and the next 13 days.',
    scope: 'fixed-forecast',
    units: ['reviews'],
    tooltipFields: ['Date', 'Due', 'Overdue'],
    tableColumns: ['Date', 'Due', 'Overdue'],
    emptyState: 'No reviews are currently scheduled in the next 14 days.',
  },
} as const satisfies Record<AnalyticsViewId, AnalyticsViewDefinition>
