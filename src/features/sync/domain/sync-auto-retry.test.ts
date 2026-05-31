import { describe, expect, it } from 'vitest'

import { readAutoSyncRetryDelayMinutes } from './sync-auto-retry'

describe('sync auto retry policy', () => {
  it.each([
    [0, 1],
    [1, 5],
    [2, 15],
    [3, 30],
    [4, 30],
  ])('maps attempt %i to %i minutes', (attempt, delay) => {
    expect(readAutoSyncRetryDelayMinutes(attempt)).toBe(delay)
  })

  it('rejects negative attempts', () => {
    expect(() => readAutoSyncRetryDelayMinutes(-1)).toThrow(/attempt/i)
  })
})
