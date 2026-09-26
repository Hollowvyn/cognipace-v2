import { describe, expect, it } from 'vitest'
import {
  seedTopicAliases,
  seedTopicRelations,
  seedTopics,
} from '@/platform/db/topic-taxonomy-seed'
import { reconcileTopicRows, type TopicRows } from './topic-reconciliation'

const catalogue = {
  topics: seedTopics,
  aliases: seedTopicAliases,
  relations: seedTopicRelations,
}

function rows(overrides: Partial<TopicRows<number>> = {}): TopicRows<number> {
  return {
    topics: [
      { id: 'tree', label: 'Tree', createdAt: 1, updatedAt: 2 },
      {
        id: 'depth-first-search',
        label: 'Depth-First Search',
        createdAt: 1,
        updatedAt: 2,
      },
      { id: 'array', label: 'Array', createdAt: 1, updatedAt: 2 },
    ],
    topicAliases: [
      {
        aliasKey: 'my-tree-name',
        label: 'My Tree Name',
        topicId: 'tree',
        createdAt: 3,
        updatedAt: 4,
      },
    ],
    topicRelations: [
      {
        sourceTopicId: 'depth-first-search',
        targetTopicId: 'tree',
        kind: 'broader',
        createdAt: 5,
        updatedAt: 6,
      },
    ],
    problemTopics: [{ problemSlug: 'two-sum', topicId: 'array' }],
    ...overrides,
  }
}

const options = { legacy: true, now: 10, catalogue }

describe('reconcileTopicRows', () => {
  it('uses the complete catalogue, including Minimax as its own canonical topic', () => {
    expect(catalogue.topics).toHaveLength(81)
    expect(catalogue.topics.find(({ id }) => id === 'minimax')).toEqual({
      id: 'minimax',
      label: 'Minimax',
    })
  })

  it('rekeys custom aliases and corrects old edges without inventing assignments', () => {
    const old = rows()
    const result = reconcileTopicRows(old, options)

    expect(result.topicAliases).toContainEqual({
      aliasKey: 'my tree name',
      label: 'My Tree Name',
      topicId: 'tree',
      createdAt: 3,
      updatedAt: 4,
    })
    expect(result.topicRelations).toContainEqual({
      sourceTopicId: 'depth-first-search',
      targetTopicId: 'tree',
      kind: 'applies-to',
      createdAt: 5,
      updatedAt: 6,
    })
    expect(result.topicRelations).not.toContainEqual(
      expect.objectContaining({
        sourceTopicId: 'depth-first-search',
        targetTopicId: 'tree',
        kind: 'broader',
      }),
    )
    expect(result.problemTopics).toEqual(old.problemTopics)
    expect(result.topics.find(({ id }) => id === 'array')).toEqual(
      old.topics.find(({ id }) => id === 'array'),
    )
    expect(reconcileTopicRows(result, { ...options, now: 20 })).toEqual(result)
  })

  it('preserves canonical Array assignments instead of inferring String', () => {
    const old = rows({
      topicAliases: [
        {
          aliasKey: 'arrays & hashing',
          label: 'Arrays & Hashing',
          topicId: 'array',
          createdAt: 3,
          updatedAt: 4,
        },
      ],
    })

    const result = reconcileTopicRows(old, options)

    expect(result.problemTopics).toEqual([
      { problemSlug: 'two-sum', topicId: 'array' },
    ])
    expect(
      result.problemTopics.some(
        ({ problemSlug, topicId }) =>
          problemSlug === 'two-sum' && topicId === 'string',
      ),
    ).toBe(false)
    expect(
      result.topicAliases.some(({ label }) => label === 'Arrays & Hashing'),
    ).toBe(false)
  })

  it('retires only an exact legacy display label and target pair', () => {
    const old = rows({
      topicAliases: [
        {
          aliasKey: 'arrays & hashing',
          label: 'Arrays & Hashing',
          topicId: 'array',
          createdAt: 3,
          updatedAt: 4,
        },
        {
          aliasKey: 'custom-array-heading',
          label: ' aRRays   & hashing ',
          topicId: 'array',
          createdAt: 5,
          updatedAt: 6,
        },
      ],
    })

    const result = reconcileTopicRows(old, options)

    expect(result.topicAliases).toContainEqual({
      aliasKey: 'arrays & hashing',
      label: ' aRRays   & hashing ',
      topicId: 'array',
      createdAt: 5,
      updatedAt: 6,
    })
    expect(result.topicAliases).not.toContainEqual(
      expect.objectContaining({ label: 'Arrays & Hashing' }),
    )
  })

  it('merges distinct safe Heap aliases and remaps all references', () => {
    const old = rows({
      topics: [
        ...rows().topics,
        {
          id: 'heap-priority-queue',
          label: 'Heap (Priority Queue)',
          createdAt: 17,
          updatedAt: 18,
        },
        { id: 'custom-heap', label: 'Heap', createdAt: 7, updatedAt: 8 },
        {
          id: 'custom-priority-queue',
          label: 'Priority Queue',
          createdAt: 9,
          updatedAt: 10,
        },
        {
          id: 'custom-index',
          label: 'Heap Index',
          createdAt: 11,
          updatedAt: 12,
        },
      ],
      topicAliases: [
        {
          aliasKey: 'my heap alias',
          label: 'My Heap Alias',
          topicId: 'custom-heap',
          createdAt: 13,
          updatedAt: 14,
        },
      ],
      topicRelations: [
        {
          sourceTopicId: 'custom-index',
          targetTopicId: 'custom-heap',
          kind: 'broader',
          createdAt: 15,
          updatedAt: 16,
        },
        {
          sourceTopicId: 'custom-index',
          targetTopicId: 'custom-priority-queue',
          kind: 'broader',
          createdAt: 17,
          updatedAt: 18,
        },
        {
          sourceTopicId: 'custom-index',
          targetTopicId: 'heap-priority-queue',
          kind: 'broader',
          createdAt: 19,
          updatedAt: 20,
        },
        ...rows().topicRelations,
      ],
      problemTopics: [
        { problemSlug: 'heap-one', topicId: 'custom-heap' },
        { problemSlug: 'heap-one', topicId: 'custom-priority-queue' },
      ],
    })

    const result = reconcileTopicRows(old, options)

    expect(result.problemTopics).toContainEqual({
      problemSlug: 'heap-one',
      topicId: 'heap-priority-queue',
    })
    expect(
      result.problemTopics.filter(
        ({ problemSlug }) => problemSlug === 'heap-one',
      ),
    ).toHaveLength(1)
    expect(result.topicAliases).toContainEqual({
      aliasKey: 'my heap alias',
      label: 'My Heap Alias',
      topicId: 'heap-priority-queue',
      createdAt: 13,
      updatedAt: 14,
    })
    expect(result.topicAliases).toContainEqual({
      aliasKey: 'heap',
      label: 'Heap',
      topicId: 'heap-priority-queue',
      createdAt: 7,
      updatedAt: 8,
    })
    expect(result.topicRelations).toContainEqual({
      sourceTopicId: 'custom-index',
      targetTopicId: 'heap-priority-queue',
      kind: 'broader',
      createdAt: 19,
      updatedAt: 20,
    })
    expect(result.topics.some(({ id }) => id === 'custom-heap')).toBe(false)
    expect(result.topics.some(({ id }) => id === 'custom-priority-queue')).toBe(
      false,
    )

    expect(
      reconcileTopicRows(
        {
          ...old,
          topics: [...old.topics].reverse(),
          topicAliases: [...old.topicAliases].reverse(),
          topicRelations: [...old.topicRelations].reverse(),
          problemTopics: [...old.problemTopics].reverse(),
        },
        options,
      ),
    ).toEqual(result)
  })

  it('preserves an existing alias when a merged label produces the same key', () => {
    const old = rows({
      topics: [
        ...rows().topics,
        { id: 'custom-heap', label: 'Heap', createdAt: 7, updatedAt: 8 },
      ],
      topicAliases: [
        {
          aliasKey: 'heap',
          label: 'Heap',
          topicId: 'custom-heap',
          createdAt: 50,
          updatedAt: 60,
        },
      ],
    })

    const result = reconcileTopicRows(old, options)

    expect(
      result.topicAliases.find(({ aliasKey }) => aliasKey === 'heap'),
    ).toEqual({
      aliasKey: 'heap',
      label: 'Heap',
      topicId: 'heap-priority-queue',
      createdAt: 50,
      updatedAt: 60,
    })
  })

  it('collapses same-target aliases deterministically regardless of input order', () => {
    const old = rows({
      topicAliases: [
        {
          aliasKey: 'z-old-key',
          label: 'My   Tree Alias',
          topicId: 'tree',
          createdAt: 7,
          updatedAt: 8,
        },
        {
          aliasKey: 'a-old-key',
          label: ' my tree alias ',
          topicId: 'tree',
          createdAt: 9,
          updatedAt: 10,
        },
      ],
    })

    const result = reconcileTopicRows(old, options)
    const collapsed = result.topicAliases.find(
      ({ aliasKey }) => aliasKey === 'my tree alias',
    )

    expect(collapsed).toEqual({
      aliasKey: 'my tree alias',
      label: ' my tree alias ',
      topicId: 'tree',
      createdAt: 9,
      updatedAt: 10,
    })
    expect(
      reconcileTopicRows(
        { ...old, topicAliases: [...old.topicAliases].reverse() },
        options,
      ),
    ).toEqual(result)
  })

  it('preserves unrelated custom broader edges', () => {
    const old = rows({
      topics: [
        ...rows().topics,
        { id: 'custom-a', label: 'Custom A', createdAt: 7, updatedAt: 8 },
        { id: 'custom-b', label: 'Custom B', createdAt: 9, updatedAt: 10 },
      ],
      topicRelations: [
        ...rows().topicRelations,
        {
          sourceTopicId: 'custom-a',
          targetTopicId: 'custom-b',
          kind: 'broader',
          createdAt: 11,
          updatedAt: 12,
        },
      ],
    })

    expect(reconcileTopicRows(old, options).topicRelations).toContainEqual({
      sourceTopicId: 'custom-a',
      targetTopicId: 'custom-b',
      kind: 'broader',
      createdAt: 11,
      updatedAt: 12,
    })
  })

  it('does not infer identity from a slug-like custom ID', () => {
    const old = rows({
      topics: [
        ...rows().topics,
        {
          id: 'heap-custom',
          label: 'My Heap Notes',
          createdAt: 7,
          updatedAt: 8,
        },
      ],
      problemTopics: [{ problemSlug: 'heap-problem', topicId: 'heap-custom' }],
    })

    const result = reconcileTopicRows(old, options)

    expect(result.topics).toContainEqual({
      id: 'heap-custom',
      label: 'My Heap Notes',
      createdAt: 7,
      updatedAt: 8,
    })
    expect(result.problemTopics).toContainEqual({
      problemSlug: 'heap-problem',
      topicId: 'heap-custom',
    })
  })

  it('rejects conflicting aliases without mutating the input', () => {
    const old = rows({
      topicAliases: [
        {
          aliasKey: 'heap',
          label: 'Heap',
          topicId: 'array',
          createdAt: 3,
          updatedAt: 4,
        },
      ],
    })
    const before = structuredClone(old)

    expect(() => reconcileTopicRows(old, options)).toThrow(/heap/i)
    expect(old).toEqual(before)
  })

  it('rejects malformed current-format alias keys', () => {
    const old = rows({
      topicAliases: [
        {
          aliasKey: 'old-slug',
          label: 'Old Slug',
          topicId: 'tree',
          createdAt: 3,
          updatedAt: 4,
        },
      ],
    })

    expect(() =>
      reconcileTopicRows(old, { ...options, legacy: false }),
    ).toThrow('Invalid topic alias key: old-slug')
  })

  it('rejects normalized canonical-label collisions', () => {
    const old = rows({
      topics: [
        ...rows().topics,
        { id: 'custom-array', label: ' ARRAY ', createdAt: 7, updatedAt: 8 },
      ],
    })

    expect(() => reconcileTopicRows(old, options)).toThrow(/collision/i)
  })

  it('rejects duplicate direct joins and typed edges before any merge', () => {
    const duplicatedJoin = rows({
      problemTopics: [
        { problemSlug: 'same', topicId: 'array' },
        { problemSlug: 'same', topicId: 'array' },
      ],
    })
    const duplicatedEdge = rows({
      topicRelations: [...rows().topicRelations, ...rows().topicRelations],
    })

    expect(() => reconcileTopicRows(duplicatedJoin, options)).toThrow(
      /duplicate/i,
    )
    expect(() => reconcileTopicRows(duplicatedEdge, options)).toThrow(
      /duplicate/i,
    )
  })

  it('rejects existing self-links instead of hiding them as merge artifacts', () => {
    const selfLinked = rows({
      topicRelations: [
        {
          sourceTopicId: 'tree',
          targetTopicId: 'tree',
          kind: 'broader',
          createdAt: 5,
          updatedAt: 6,
        },
      ],
    })

    expect(() => reconcileTopicRows(selfLinked, options)).toThrow(/self-link/i)
  })

  it('keeps database and backup timestamp types and values unchanged', () => {
    const old: TopicRows<string> = {
      topics: [
        {
          id: 'custom',
          label: 'Custom',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      topicAliases: [],
      topicRelations: [],
      problemTopics: [{ problemSlug: 'p', topicId: 'custom' }],
    }

    const result = reconcileTopicRows(old, {
      legacy: false,
      now: '2026-02-03T00:00:00.000Z',
      catalogue,
    })

    expect(result.topics.find(({ id }) => id === 'custom')).toEqual(
      old.topics[0],
    )
    expect(result.topics.find(({ id }) => id === 'array')).toMatchObject({
      createdAt: '2026-02-03T00:00:00.000Z',
      updatedAt: '2026-02-03T00:00:00.000Z',
    })
  })
})
