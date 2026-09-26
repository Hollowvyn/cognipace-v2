import { describe, expect, it } from 'vitest'
import {
  buildTopicLookup,
  createTopicId,
  normalizeTopicLookupKey,
  normalizeTopicSearchKey,
} from './topic-taxonomy'

describe('topic taxonomy keys', () => {
  it('preserves separators and normalizes Unicode labels', () => {
    expect(normalizeTopicLookupKey(' Tree / Graph ')).toBe('tree / graph')
    expect(normalizeTopicLookupKey('  动态规划  ')).toBe('动态规划')
    expect(normalizeTopicLookupKey('Union–Find')).toBe('union-find')
    expect(normalizeTopicLookupKey('Cafe\u0301')).toBe('café')
  })

  it('keeps permissive search keys separate from validated lookup keys', () => {
    expect(normalizeTopicSearchKey(' / ')).toBe('/')
    expect(normalizeTopicSearchKey('')).toBe('')
    expect(() => normalizeTopicLookupKey('/ &')).toThrow('letter or number')
  })
})

describe('buildTopicLookup', () => {
  it('rejects aliases that collide with another topic label', () => {
    expect(() =>
      buildTopicLookup(
        [
          { id: 'tree', label: 'Tree' },
          { id: 'custom', label: 'DFS' },
        ],
        [{ aliasKey: 'dfs', label: 'DFS', topicId: 'tree' }],
      ),
    ).toThrow('dfs')
  })

  it('allows an alias to repeat its own canonical topic identity', () => {
    const lookup = buildTopicLookup(
      [{ id: 'tree', label: 'Tree' }],
      [{ aliasKey: 'tree', label: 'Tree', topicId: 'tree' }],
    )

    expect(lookup.get('tree')).toEqual({ id: 'tree', label: 'Tree' })
  })
})

describe('createTopicId', () => {
  it('allocates a unique ID from the complete occupied namespace', () => {
    expect(createTopicId(new Set(['topic-fixed']), () => 'fixed-2')).toBe(
      'topic-fixed-2',
    )
  })

  it('fails after eight occupied ID candidates', () => {
    let counter = 0
    const occupied = new Set(
      Array.from({ length: 8 }, (_, index) => `topic-id-${index}`),
    )

    expect(() => createTopicId(occupied, () => `id-${counter++}`)).toThrow(
      '8 attempts',
    )
    expect(counter).toBe(8)
  })
})
