import { describe, expect, it } from 'vitest'

import { analyticsViewCatalogue } from './chart-catalogue'

describe('analytics view catalogue', () => {
  it('defines exactly the nine approved stable IDs in dashboard order', () => {
    expect(Object.keys(analyticsViewCatalogue)).toEqual([
      'observed-recall-vs-fsrs',
      'memory-strength',
      'practice-rhythm',
      'ratings-mix',
      'topic-performance',
      'retention-map',
      'memory-signals',
      'overdue-backlog',
      'upcoming-review-load',
    ])
  })

  it('keeps each view explicit about meaning, exact values, and empty behavior', () => {
    for (const definition of Object.values(analyticsViewCatalogue)) {
      expect(definition.title).not.toHaveLength(0)
      expect(definition.question).not.toHaveLength(0)
      expect(definition.metricMeaning).not.toHaveLength(0)
      expect(definition.units.length).toBeGreaterThan(0)
      expect(definition.tooltipFields.length).toBeGreaterThan(0)
      expect(definition.tableColumns.length).toBeGreaterThan(0)
      expect(definition.emptyState).not.toHaveLength(0)
    }
  })

  it('preserves the locked retention-map and workload exact-value paths', () => {
    expect(analyticsViewCatalogue['retention-map']).toMatchObject({
      title: 'Retention Map',
      scope: 'current-state',
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
    })
    expect(
      analyticsViewCatalogue['upcoming-review-load'].tooltipFields,
    ).toEqual(['Date', 'Due', 'Overdue'])
  })
})
