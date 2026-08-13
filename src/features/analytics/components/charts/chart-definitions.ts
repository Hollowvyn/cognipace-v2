import type {
  AnalyticsChartSemanticColor,
  AnalyticsTooltipField,
} from './types'

export type AnalyticsChartId =
  | 'recall-quality'
  | 'practice-rhythm'
  | 'ratings-mix'
  | 'weakest-topics'
  | 'memory-strength'
  | 'overdue-backlog'
  | 'upcoming-review-load'
  | 'retention-health'
  | 'fragile-knowledge'

export type ChartSeriesMark =
  | 'area'
  | 'bar'
  | 'line'
  | 'reference-line'
  | 'scatter'
  | 'stacked-bar'
  | 'table'

export interface ChartSeriesDefinition {
  key: string
  label: string
  mark: ChartSeriesMark
  color: AnalyticsChartSemanticColor
}

export interface AnalyticsChartDefinition {
  id: AnalyticsChartId
  title: string
  question: string
  metricMeaning: string
  dataSource: string
  eligibility: string
  aggregation: string
  readiness: 'historical' | 'current-state' | 'forecast'
  xAxis: string
  yAxis: string
  series: readonly ChartSeriesDefinition[]
  tooltipFields: readonly AnalyticsTooltipField[]
  emptyState: string
  continuity?: 'solid' | 'solid-with-permitted-gap-bridge'
  interpretationWarning?: string
}

const observed = 'var(--cp-analytics-observed)' as const
const predicted = 'var(--cp-analytics-predicted)' as const
const target = 'var(--cp-analytics-target)' as const
const practiceVolume = 'var(--cp-analytics-practice-volume)' as const
const again = 'var(--cp-analytics-again)' as const
const hard = 'var(--cp-analytics-hard)' as const
const good = 'var(--cp-analytics-good)' as const
const easy = 'var(--cp-analytics-easy)' as const
const healthy = 'var(--cp-analytics-healthy)' as const
const attention = 'var(--cp-analytics-attention)' as const
const risk = 'var(--cp-analytics-risk)' as const

export const analyticsChartDefinitions = {
  recallQuality: {
    id: 'recall-quality',
    title: 'Recall quality',
    question: 'How is observed recall comparing with the FSRS prediction?',
    metricMeaning:
      'Observed correctness is the share of eligible reviews recorded as correct; predicted recall is FSRS retrievability immediately before review.',
    dataSource: 'Selected-range persisted review attempts and FSRS replay.',
    eligibility:
      'Observed recall needs a valid rating with persisted correctness. Predicted recall needs a valid FSRS replay.',
    aggregation:
      'Ratios are recomputed from eligible review totals in each adaptive presentation bucket.',
    readiness: 'historical',
    xAxis: 'Adaptive presentation bucket',
    yAxis: 'Recall percentage',
    series: [
      {
        key: 'observedRecall',
        label: 'Observed correctness',
        mark: 'line',
        color: observed,
      },
      {
        key: 'predictedRecall',
        label: 'Predicted recall',
        mark: 'line',
        color: predicted,
      },
      {
        key: 'targetRetention',
        label: 'Target retention',
        mark: 'reference-line',
        color: target,
      },
    ],
    tooltipFields: [
      { key: 'observedRecall', label: 'Observed correctness' },
      { key: 'predictedRecall', label: 'Predicted recall (FSRS estimate)' },
      { key: 'eligibleSampleSize', label: 'Eligible reviews' },
      { key: 'reviewCount', label: 'All reviews' },
    ],
    emptyState: 'Not enough eligible review data for recall quality yet.',
    continuity: 'solid-with-permitted-gap-bridge',
  },
  practiceRhythm: {
    id: 'practice-rhythm',
    title: 'Practice rhythm',
    question: 'How did practice volume and observed correctness move together?',
    metricMeaning:
      'Review volume and observed correctness are shown together by adaptive presentation bucket.',
    dataSource: 'Selected-range persisted review attempts.',
    eligibility:
      'Review volume needs a valid review rating. Observed correctness also needs a persisted correctness value.',
    aggregation:
      'Review count is summed and observed correctness is recomputed from eligible review totals in each bucket.',
    readiness: 'historical',
    xAxis: 'Adaptive presentation bucket',
    yAxis: 'Reviews and observed correctness',
    series: [
      {
        key: 'reviewCount',
        label: 'Review volume',
        mark: 'bar',
        color: practiceVolume,
      },
      {
        key: 'observedCorrectness',
        label: 'Observed correctness',
        mark: 'line',
        color: observed,
      },
    ],
    tooltipFields: [
      { key: 'reviewCount', label: 'Reviews' },
      { key: 'observedCorrectness', label: 'Observed correctness' },
      { key: 'sampleSize', label: 'Eligible reviews' },
    ],
    emptyState:
      'Not enough assessed reviews for a practice rhythm comparison yet.',
    continuity: 'solid-with-permitted-gap-bridge',
    interpretationWarning: 'Association, not causation.',
  },
  ratingsMix: {
    id: 'ratings-mix',
    title: 'Ratings mix',
    question: 'Are Hard and Again ratings becoming less common?',
    metricMeaning:
      'The share of Again, Hard, Good, and Easy ratings in each adaptive presentation bucket.',
    dataSource: 'Selected-range persisted review attempts with valid ratings.',
    eligibility: 'A persisted review attempt must have a valid review rating.',
    aggregation:
      'Each rating count is summed per bucket and displayed as a share of that bucket’s valid ratings.',
    readiness: 'historical',
    xAxis: 'Adaptive presentation bucket',
    yAxis: 'Share of ratings',
    series: [
      { key: 'again', label: 'Again', mark: 'stacked-bar', color: again },
      { key: 'hard', label: 'Hard', mark: 'stacked-bar', color: hard },
      { key: 'good', label: 'Good', mark: 'stacked-bar', color: good },
      { key: 'easy', label: 'Easy', mark: 'stacked-bar', color: easy },
    ],
    tooltipFields: [
      { key: 'again', label: 'Again ratings' },
      { key: 'hard', label: 'Hard ratings' },
      { key: 'good', label: 'Good ratings' },
      { key: 'easy', label: 'Easy ratings' },
      { key: 'hardAgainShare', label: 'Hard + Again share' },
    ],
    emptyState: 'No valid ratings were recorded in this period.',
  },
  weakestTopics: {
    id: 'weakest-topics',
    title: 'Where to focus',
    question: 'Which topics have the weakest observed recall?',
    metricMeaning:
      'Topics are ranked by observed correctness so lower-performing areas are easier to focus on first.',
    dataSource:
      'Selected-range problem topics joined to persisted review attempts.',
    eligibility:
      'A review needs a valid rating, persisted correctness, and at least one topic label.',
    aggregation:
      'Observed correctness is recomputed from eligible review totals per topic, then ranked from lowest to highest.',
    readiness: 'historical',
    xAxis: 'Observed correctness',
    yAxis: 'Topic',
    series: [
      {
        key: 'recallQuality',
        label: 'Recall quality',
        mark: 'bar',
        color: attention,
      },
    ],
    tooltipFields: [
      { key: 'topic', label: 'Topic' },
      { key: 'recallQuality', label: 'Observed correctness' },
      { key: 'sampleSize', label: 'Eligible reviews' },
    ],
    emptyState:
      'Topics need labeled reviews with persisted correctness observations.',
  },
  memoryStrength: {
    id: 'memory-strength',
    title: 'Memory strength',
    question: 'Is the time your memories remain durable getting longer?',
    metricMeaning:
      'FSRS stability is the approximate number of days the model expects memory to remain durable.',
    dataSource: 'Selected-range valid FSRS review-log replay.',
    eligibility:
      'A review needs a valid rating and a parseable post-review FSRS stability value.',
    aggregation:
      'The median valid stability value is calculated for each adaptive presentation bucket.',
    readiness: 'historical',
    xAxis: 'Adaptive presentation bucket',
    yAxis: 'Median stability in days',
    series: [
      {
        key: 'medianStabilityDays',
        label: 'Median stability',
        mark: 'line',
        color: healthy,
      },
    ],
    tooltipFields: [
      { key: 'medianStabilityDays', label: 'Median stability' },
      { key: 'sampleSize', label: 'Valid FSRS samples' },
    ],
    emptyState: 'No valid post-review FSRS stability records are available.',
    continuity: 'solid-with-permitted-gap-bridge',
  },
  overdueBacklog: {
    id: 'overdue-backlog',
    title: 'Recent overdue backlog',
    question: 'Is your overdue backlog staying below the watch zone?',
    metricMeaning: 'Cards that were due before the point in time being shown.',
    dataSource:
      'Reconstructed historical FSRS due dates and current card state.',
    eligibility:
      'Only buckets with reconstructable schedule history have an overdue backlog value.',
    aggregation:
      'The latest reconstructed overdue count in each adaptive presentation bucket is shown.',
    readiness: 'historical',
    xAxis: 'Adaptive presentation bucket',
    yAxis: 'Overdue problems',
    series: [
      {
        key: 'overdueCount',
        label: 'Overdue problems',
        mark: 'area',
        color: attention,
      },
      {
        key: 'watchZone',
        label: 'Watch zone',
        mark: 'reference-line',
        color: target,
      },
      {
        key: 'healthyRange',
        label: 'Within watch zone',
        mark: 'line',
        color: healthy,
      },
      {
        key: 'attentionRange',
        label: 'Above watch zone',
        mark: 'line',
        color: attention,
      },
    ],
    tooltipFields: [
      { key: 'overdueCount', label: 'Overdue problems' },
      { key: 'historyAvailable', label: 'History available' },
    ],
    emptyState: 'Overdue history is not available yet.',
    continuity: 'solid-with-permitted-gap-bridge',
  },
  upcomingLoad: {
    id: 'upcoming-review-load',
    title: 'Upcoming review load',
    question: 'What review work is scheduled for the next 14 days?',
    metricMeaning:
      'Cards due today or over the next 13 days, with overdue cards shown separately.',
    dataSource: 'Current card schedule.',
    eligibility: 'Cards must have an active scheduled due date.',
    aggregation:
      'Due and overdue card counts are summed for each of the next 14 calendar days.',
    readiness: 'forecast',
    xAxis: 'Next 14 calendar days',
    yAxis: 'Reviews due',
    series: [
      {
        key: 'overdueCount',
        label: 'Overdue reviews',
        mark: 'stacked-bar',
        color: risk,
      },
      {
        key: 'dueCount',
        label: 'Upcoming reviews',
        mark: 'stacked-bar',
        color: healthy,
      },
    ],
    tooltipFields: [
      { key: 'overdueCount', label: 'Overdue reviews' },
      { key: 'dueCount', label: 'Upcoming reviews' },
    ],
    emptyState: 'No upcoming review load to show yet.',
  },
  retentionHealth: {
    id: 'retention-health',
    title: 'Retention health',
    question: 'Which active problems are above, approaching, or below target?',
    metricMeaning:
      'Each reviewed problem’s current FSRS retrievability compared with the configured target.',
    dataSource: 'Current active-card FSRS state.',
    eligibility:
      'A problem must have been reviewed and have current FSRS state.',
    aggregation:
      'Each eligible active problem is plotted individually; no historical averaging is applied.',
    readiness: 'current-state',
    xAxis: 'Days since review',
    yAxis: 'Predicted retrievability',
    series: [
      {
        key: 'healthy',
        label: 'Above target',
        mark: 'scatter',
        color: healthy,
      },
      {
        key: 'approaching',
        label: 'Approaching target',
        mark: 'scatter',
        color: attention,
      },
      { key: 'risk', label: 'Below target', mark: 'scatter', color: risk },
      {
        key: 'targetRetention',
        label: 'Target retention',
        mark: 'reference-line',
        color: target,
      },
    ],
    tooltipFields: [
      { key: 'title', label: 'Problem' },
      { key: 'retrievability', label: 'Predicted retrievability' },
      { key: 'daysSinceReview', label: 'Days since review' },
      { key: 'stabilityDays', label: 'Stability' },
    ],
    emptyState: 'No retention health data yet.',
  },
  fragileKnowledge: {
    id: 'fragile-knowledge',
    title: 'Fragile knowledge',
    question:
      'Which active problems need attention before they become harder to recover?',
    metricMeaning:
      'Current cards whose retrievability, stability, lateness, lapses, or difficulty suggests they need attention.',
    dataSource: 'Current active-card FSRS state and problem metadata.',
    eligibility:
      'A current active problem must meet at least one fragile-knowledge signal.',
    aggregation:
      'Eligible problems are ranked by combined risk signals and presented five at a time.',
    readiness: 'current-state',
    xAxis: 'Problem',
    yAxis: 'Current predicted retrievability',
    series: [
      {
        key: 'retrievability',
        label: 'Predicted retrievability',
        mark: 'table',
        color: risk,
      },
    ],
    tooltipFields: [
      { key: 'title', label: 'Problem' },
      { key: 'topics', label: 'Topics' },
      { key: 'retrievability', label: 'Predicted retrievability' },
      { key: 'lapseCount', label: 'Lapses' },
    ],
    emptyState: 'No current cards meet the fragile-knowledge signals.',
  },
} as const satisfies Record<string, AnalyticsChartDefinition>

export const analyticsChartIds = Object.values(analyticsChartDefinitions).map(
  (definition) => definition.id,
) as AnalyticsChartId[]
