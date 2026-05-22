import { describe, expect, it } from 'vitest'

import { readQueryKeysForInvalidation } from './cache-invalidation'

describe('cache invalidation query-key mapping', () => {
  it('maps feature tags to every mounted query family they can affect', () => {
    expect(readQueryKeysForInvalidation(['app-shell'])).toEqual([
      ['app-shell-data'],
    ])
    expect(readQueryKeysForInvalidation(['practice'])).toEqual([
      ['practice-details'],
    ])
    expect(readQueryKeysForInvalidation(['queue'])).toEqual([['today-queue']])
    expect(readQueryKeysForInvalidation(['settings'])).toEqual([
      ['settings'],
      ['app-shell-data'],
      ['practice-details'],
      ['today-queue'],
      ['tracks'],
    ])
    expect(readQueryKeysForInvalidation(['tracks'])).toEqual([
      ['tracks'],
      ['app-shell-data'],
    ])
    expect(readQueryKeysForInvalidation(['problems'])).toEqual([
      ['problems'],
      ['app-shell-data'],
      ['practice-details'],
      ['today-queue'],
      ['tracks'],
    ])
  })

  it('deduplicates query families when multiple tags overlap', () => {
    expect(
      readQueryKeysForInvalidation(['settings', 'practice', 'queue']),
    ).toEqual([
      ['settings'],
      ['app-shell-data'],
      ['practice-details'],
      ['today-queue'],
      ['tracks'],
    ])
  })
})
