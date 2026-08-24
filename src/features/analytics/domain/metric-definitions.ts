export interface AnalyticsMetricDefinition {
  label: string
  question?: string
  explanation: string
  warning?: string
  unit: string
  lowSampleOrEmptyState: string
}

export const metricDefinitions = {
  analyticsCharts: {
    label: 'Analytics charts',
    question: 'What can your review history show?',
    explanation: 'Review trends for the selected period.',
    unit: 'analytics trends',
    lowSampleOrEmptyState:
      'Not enough valid review history to draw the selected analytics charts yet. Keep reviewing to build a useful trend.',
  },
  observedCorrectness: {
    label: 'Observed correctness',
    explanation:
      'The share of persisted review assessments marked correct. The current history does not identify retries or hints.',
    unit: '% correct',
    lowSampleOrEmptyState:
      'Not enough assessed reviews yet. Reviews without a persisted correctness value do not count.',
  },
  predictedRecall: {
    label: 'Predicted recall',
    explanation:
      'The FSRS model estimate of retrievability immediately before a review, not an observed result or guarantee.',
    unit: '% estimated retrievability',
    lowSampleOrEmptyState:
      'No valid review history is available to estimate retrievability.',
  },
  recallQuality: {
    label: 'Recall quality',
    question: 'How is your observed recall comparing with the FSRS prediction?',
    explanation: 'Observed correctness for the selected period.',
    unit: '% correct',
    lowSampleOrEmptyState:
      'Recall quality is hidden until enough assessments exist.',
    warning:
      'The FSRS model estimate of retrievability immediately before a review, not an observed result or guarantee.',
  },
  memoryStrength: {
    label: 'Memory strength',
    question: 'Is the time your memories remain durable getting longer?',
    explanation:
      'FSRS stability: the approximate number of days the model expects memory to remain durable.',
    unit: 'days',
    lowSampleOrEmptyState:
      'No valid post-review FSRS stability records are available.',
  },
  hardAgain: {
    label: 'Hard + Again',
    explanation:
      'The selected-period share of ratings that signal friction or failure, compared with the immediately preceding comparable period.',
    unit: '% of ratings',
    lowSampleOrEmptyState: 'No ratings were recorded in this period.',
  },
  practiceRhythm: {
    label: 'Practice rhythm',
    question: 'How did practice volume and observed correctness move together?',
    explanation:
      'Review volume per selected adaptive time bucket and observed correctness shown together for association only; this does not establish causation.',
    unit: 'reviews per adaptive bucket',
    lowSampleOrEmptyState:
      'Not enough assessed reviews across the selected adaptive time buckets exist for a useful comparison.',
    warning: 'Association, not causation.',
  },
  ratingsMix: {
    label: 'Ratings mix',
    question: 'Are Hard and Again ratings becoming less common?',
    explanation:
      'Proportions of Again, Hard, Good, and Easy ratings across selected time buckets, with the selected-period Hard + Again share summarized below.',
    unit: '% of ratings',
    lowSampleOrEmptyState: 'Rating proportions appear after the next review.',
  },
  weakestTopics: {
    label: 'Where to focus',
    question: 'Which topics have the weakest observed recall?',
    explanation:
      'Topics are ranked by observed correctness so lower-performing areas are easier to focus on first.',
    unit: '% correct',
    lowSampleOrEmptyState:
      'Topics need labeled reviews with persisted correctness observations.',
  },
  targetRetention: {
    label: 'Target retention',
    explanation:
      'Your configured FSRS scheduling target, not a grade or a guarantee.',
    unit: '% target retrievability',
    lowSampleOrEmptyState:
      'A target is shown only when the current FSRS setting is available.',
  },
} satisfies Record<string, AnalyticsMetricDefinition>

export type MetricDefinitionKey = keyof typeof metricDefinitions
