export interface AnalyticsMetricDefinition {
  label: string
  explanation: string
  unit: string
  lowSampleOrEmptyState: string
}

export const metricDefinitions = {
  firstPassRecall: {
    label: 'First-pass recall',
    explanation:
      'The share of submitted assessments marked correct; persisted retries are excluded.',
    unit: '% correct',
    lowSampleOrEmptyState:
      'Not enough assessed reviews yet. Unassessed reviews do not count.',
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
    explanation: 'Observed first-pass recall for the selected period.',
    unit: '% correct',
    lowSampleOrEmptyState:
      'Recall quality is hidden until enough assessments exist.',
  },
  memoryStrength: {
    label: 'Memory strength',
    explanation:
      'FSRS stability: the approximate number of days the model expects memory to remain durable.',
    unit: 'days',
    lowSampleOrEmptyState:
      'No valid post-review FSRS stability records are available.',
  },
  hardAgain: {
    label: 'Hard + Again',
    explanation: 'The share of ratings that signal friction or failure.',
    unit: '% of ratings',
    lowSampleOrEmptyState: 'No ratings were recorded in this period.',
  },
  consistency: {
    label: 'Consistency',
    explanation:
      'Practice days and first-pass recall shown together for association only; this does not establish causation.',
    unit: 'practice days / week',
    lowSampleOrEmptyState:
      'Not enough weekly assessed reviews exist for a useful comparison.',
  },
  targetRetention: {
    label: 'Target retention',
    explanation:
      'Your configured FSRS scheduling target, not a grade or a guarantee.',
    unit: '% target retrievability',
    lowSampleOrEmptyState:
      'A target is shown only when the current FSRS setting is available.',
  },
  overdueBacklog: {
    label: 'Overdue backlog',
    explanation: 'Cards that were due before the point in time being shown.',
    unit: 'cards',
    lowSampleOrEmptyState:
      'Historical overdue counts are not available for this period yet.',
  },
  upcomingLoad: {
    label: 'Upcoming load',
    explanation:
      'Cards due today or over the next 13 days, with overdue cards separated.',
    unit: 'cards due',
    lowSampleOrEmptyState: 'No current card schedule is available.',
  },
  fragileKnowledge: {
    label: 'Fragile knowledge',
    explanation:
      'Current cards whose predicted retrievability or stability suggests they may need attention.',
    unit: 'problems',
    lowSampleOrEmptyState:
      'No current cards meet the fragile-knowledge signals.',
  },
} satisfies Record<string, AnalyticsMetricDefinition>

export type MetricDefinitionKey = keyof typeof metricDefinitions
