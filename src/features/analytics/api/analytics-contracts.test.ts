import { describe, expect, it } from 'vitest'

import { analyticsSummaryRequestSchema } from './analytics-contracts'

describe('analyticsSummaryRequestSchema', () => {
  it('requires the dashboard surface', () => {
    expect(() => analyticsSummaryRequestSchema.parse({})).toThrow()
    expect(
      analyticsSummaryRequestSchema.parse({ surface: 'dashboard' }),
    ).toEqual({ surface: 'dashboard' })
  })

  it('accepts optional ISO at', () => {
    expect(
      analyticsSummaryRequestSchema.parse({
        surface: 'dashboard',
        at: '2026-01-15T12:00:00.000Z',
      }),
    ).toEqual({
      surface: 'dashboard',
      at: '2026-01-15T12:00:00.000Z',
    })
  })
})
