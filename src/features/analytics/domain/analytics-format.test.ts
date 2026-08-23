import { describe, expect, it } from 'vitest'

import {
  formatAnalyticsBucket,
  formatAnalyticsCount,
  formatAnalyticsDateKey,
  formatAnalyticsDays,
  formatAnalyticsPercentagePoints,
  formatAnalyticsPercent,
} from './analytics-format'

describe('analytics formatting', () => {
  it('formats null values as not measured and percentages as whole values', () => {
    expect(formatAnalyticsPercent(null)).toBe('Not measured')
    expect(formatAnalyticsPercent(0.754)).toBe('75%')
  })

  it('formats signed percentage-point differences', () => {
    expect(formatAnalyticsPercentagePoints(0.234)).toBe('+23 pp')
    expect(formatAnalyticsPercentagePoints(-0.234)).toBe('−23 pp')
    expect(formatAnalyticsPercentagePoints(null)).toBe('Not measured')
  })

  it('formats durations with the locked day precision', () => {
    expect(formatAnalyticsDays(null)).toBe('Not measured')
    expect(formatAnalyticsDays(0.04)).toBe('<0.1d')
    expect(formatAnalyticsDays(2.34)).toBe('2.3d')
    expect(formatAnalyticsDays(12.4)).toBe('12d')
  })

  it('formats count and local date-key display values deterministically', () => {
    expect(formatAnalyticsCount(12_345)).toBe('12,345')
    expect(formatAnalyticsDateKey('2026-08-22')).toBe('08/22/26')
    expect(formatAnalyticsBucket('2026-08-20', '2026-08-22')).toBe(
      '08/20/26–08/22/26',
    )
  })

  it('rejects invalid date keys', () => {
    expect(() => formatAnalyticsDateKey('2026-02-30')).toThrow(RangeError)
  })
})
