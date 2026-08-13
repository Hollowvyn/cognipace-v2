import { describe, expect, it } from 'vitest'

import {
  analyticsChartDefinitions,
  analyticsChartIds,
} from './chart-definitions'

describe('analytics chart definitions', () => {
  it('documents every panel in the approved analytics story with stable IDs', () => {
    expect(analyticsChartIds).toEqual([
      'recall-quality',
      'practice-rhythm',
      'ratings-mix',
      'weakest-topics',
      'memory-strength',
      'overdue-backlog',
      'upcoming-review-load',
      'retention-health',
      'fragile-knowledge',
    ])

    expect(Object.keys(analyticsChartDefinitions)).toEqual([
      'recallQuality',
      'practiceRhythm',
      'ratingsMix',
      'weakestTopics',
      'memoryStrength',
      'overdueBacklog',
      'upcomingLoad',
      'retentionHealth',
      'fragileKnowledge',
    ])
    expect('consistency' in analyticsChartDefinitions).toBe(false)
  })

  it('keeps serialized keys, marks, semantic labels, and historical readiness aligned', () => {
    expect(analyticsChartDefinitions.recallQuality).toMatchObject({
      readiness: 'historical',
      series: [
        {
          key: 'observedRecall',
          label: 'Observed correctness',
          mark: 'line',
          color: 'var(--cp-analytics-observed)',
        },
        {
          key: 'predictedRecall',
          label: 'Predicted recall',
          mark: 'line',
          color: 'var(--cp-analytics-predicted)',
        },
        {
          key: 'targetRetention',
          label: 'Target retention',
          mark: 'reference-line',
          color: 'var(--cp-analytics-target)',
        },
      ],
    })

    expect(analyticsChartDefinitions.practiceRhythm).toMatchObject({
      id: 'practice-rhythm',
      readiness: 'historical',
      series: [
        {
          key: 'reviewCount',
          label: 'Review volume',
          mark: 'bar',
          color: 'var(--cp-analytics-practice-volume)',
        },
        {
          key: 'observedCorrectness',
          label: 'Observed correctness',
          mark: 'line',
          color: 'var(--cp-analytics-observed)',
        },
      ],
      interpretationWarning: 'Association, not causation.',
    })

    expect(analyticsChartDefinitions.ratingsMix.series).toEqual([
      expect.objectContaining({
        key: 'again',
        label: 'Again',
        mark: 'stacked-bar',
        color: 'var(--cp-analytics-again)',
      }),
      expect.objectContaining({
        key: 'hard',
        label: 'Hard',
        mark: 'stacked-bar',
        color: 'var(--cp-analytics-hard)',
      }),
      expect.objectContaining({
        key: 'good',
        label: 'Good',
        mark: 'stacked-bar',
        color: 'var(--cp-analytics-good)',
      }),
      expect.objectContaining({
        key: 'easy',
        label: 'Easy',
        mark: 'stacked-bar',
        color: 'var(--cp-analytics-easy)',
      }),
    ])
  })

  it('keeps definitions inspectable enough to trace their data and empty-state behavior', () => {
    for (const definition of Object.values(analyticsChartDefinitions)) {
      expect(definition.title).not.toHaveLength(0)
      expect(definition.question).not.toHaveLength(0)
      expect(definition.metricMeaning).not.toHaveLength(0)
      expect(definition.dataSource).not.toHaveLength(0)
      expect(definition.eligibility).not.toHaveLength(0)
      expect(definition.aggregation).not.toHaveLength(0)
      expect(definition.xAxis).not.toHaveLength(0)
      expect(definition.yAxis).not.toHaveLength(0)
      expect(definition.tooltipFields.length).toBeGreaterThan(0)
      expect(definition.emptyState).not.toHaveLength(0)
      expect(definition.series.length).toBeGreaterThan(0)
    }
  })
})
