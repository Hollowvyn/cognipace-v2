export interface AnalyticsMetricDefinition {
  label: string
  question?: string
  explanation: string
  warning?: string
  unit: string
  lowSampleOrEmptyState: string
}

export const metricDefinitions = {
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
  overdueBacklog: {
    label: 'Recent overdue backlog',
    question: 'Is your overdue backlog staying below the watch zone?',
    explanation: 'Cards that were due before the point in time being shown.',
    unit: 'cards',
    lowSampleOrEmptyState:
      'Only dates that can be reconstructed from persisted FSRS due dates are shown; unknown dates stay blank.',
  },
  upcomingLoad: {
    label: 'Upcoming review load',
    question: 'What review work is scheduled for the next 14 days?',
    explanation:
      'Cards due today or over the next 13 days, with overdue cards separated.',
    unit: 'cards due',
    lowSampleOrEmptyState: 'No current card schedule is available.',
  },
  fragileKnowledge: {
    label: 'Fragile knowledge',
    question:
      'Which active problems need attention before they become harder to recover?',
    explanation:
      'Current cards whose predicted retrievability, stability, overdue gap, lapses, or configured high-difficulty threshold suggests they may need attention.',
    unit: 'problems',
    lowSampleOrEmptyState:
      'No current cards meet the fragile-knowledge signals.',
  },
  retentionHealth: {
    label: 'Retention health',
    question: 'Which active problems are above, approaching, or below target?',
    explanation:
      "Each reviewed problem's current FSRS retrievability compared with your configured target.",
    unit: '% estimated retrievability',
    lowSampleOrEmptyState:
      'Reviewed cards will appear after their first review.',
  },
} satisfies Record<string, AnalyticsMetricDefinition>

export type MetricDefinitionKey = keyof typeof metricDefinitions
