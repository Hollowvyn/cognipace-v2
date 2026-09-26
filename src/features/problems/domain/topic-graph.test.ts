import { describe, expect, it } from 'vitest'
import { buildTopicGraph, type TopicRelation } from './topic-graph'

describe('buildTopicGraph', () => {
  it('deduplicates ancestors without treating applicability as membership', () => {
    const graph = buildTopicGraph(
      [
        { id: 'tree' },
        { id: 'binary-tree' },
        { id: 'bst' },
        { id: 'dfs' },
        { id: 'graph' },
      ],
      [
        { sourceTopicId: 'bst', targetTopicId: 'binary-tree', kind: 'broader' },
        {
          sourceTopicId: 'binary-tree',
          targetTopicId: 'tree',
          kind: 'broader',
        },
        { sourceTopicId: 'bst', targetTopicId: 'tree', kind: 'broader' },
        { sourceTopicId: 'dfs', targetTopicId: 'tree', kind: 'applies-to' },
        { sourceTopicId: 'dfs', targetTopicId: 'graph', kind: 'applies-to' },
      ],
    )

    expect(graph.effectiveTopicIds(['bst', 'tree'])).toEqual([
      'binary-tree',
      'bst',
      'tree',
    ])
    expect(graph.ancestorsOf('bst')).toEqual(['binary-tree', 'tree'])
    expect(graph.ancestorsOf('dfs')).toEqual([])
  })

  it('rejects a cycle in broader relations', () => {
    expect(() =>
      buildTopicGraph(
        [{ id: 'tree' }, { id: 'bst' }],
        [
          { sourceTopicId: 'bst', targetTopicId: 'tree', kind: 'broader' },
          { sourceTopicId: 'tree', targetTopicId: 'bst', kind: 'broader' },
        ],
      ),
    ).toThrow(/cycle/i)
  })

  it('rejects duplicate topic IDs', () => {
    expect(() => buildTopicGraph([{ id: 'tree' }, { id: 'tree' }], [])).toThrow(
      /duplicate topic ID/i,
    )
  })

  it.each([
    [
      'self-link',
      [{ id: 'tree' }],
      [{ sourceTopicId: 'tree', targetTopicId: 'tree', kind: 'broader' }],
      /self/i,
    ],
    [
      'dangling source',
      [{ id: 'tree' }],
      [{ sourceTopicId: 'unknown', targetTopicId: 'tree', kind: 'broader' }],
      /unknown|dangling/i,
    ],
    [
      'dangling target',
      [{ id: 'tree' }],
      [{ sourceTopicId: 'tree', targetTopicId: 'unknown', kind: 'broader' }],
      /unknown|dangling/i,
    ],
    [
      'duplicate typed edge',
      [{ id: 'tree' }, { id: 'bst' }],
      [
        { sourceTopicId: 'bst', targetTopicId: 'tree', kind: 'broader' },
        { sourceTopicId: 'bst', targetTopicId: 'tree', kind: 'broader' },
      ],
      /duplicate/i,
    ],
    [
      'unknown relation kind',
      [{ id: 'tree' }, { id: 'bst' }],
      [{ sourceTopicId: 'bst', targetTopicId: 'tree', kind: 'related' }],
      /kind|relation/i,
    ],
  ] as const)('rejects %s', (_caseName, topics, relations, message) => {
    expect(() =>
      buildTopicGraph(topics, relations as unknown as TopicRelation[]),
    ).toThrow(message)
  })

  it('allows disconnected roots', () => {
    const graph = buildTopicGraph([{ id: 'tree' }, { id: 'graph' }], [])

    expect(graph.ancestorsOf('tree')).toEqual([])
    expect(graph.ancestorsOf('graph')).toEqual([])
  })

  it('does not treat an applies-to cycle as a hierarchy cycle', () => {
    const graph = buildTopicGraph(
      [{ id: 'tree' }, { id: 'dfs' }],
      [
        { sourceTopicId: 'dfs', targetTopicId: 'tree', kind: 'applies-to' },
        { sourceTopicId: 'tree', targetTopicId: 'dfs', kind: 'applies-to' },
      ],
    )

    expect(graph.effectiveTopicIds(['dfs'])).toEqual(['dfs'])
  })

  it('walks a 2,000-node chain without recursive depth limits', () => {
    const topics = Array.from({ length: 2_000 }, (_, index) => ({
      id: `topic-${index}`,
    }))
    const relations = topics.slice(0, -1).map((topic, index) => ({
      sourceTopicId: topic.id,
      targetTopicId: topics[index + 1]!.id,
      kind: 'broader' as const,
    }))
    const graph = buildTopicGraph(topics, relations)

    expect(graph.ancestorsOf('topic-0')).toHaveLength(1_999)
  })

  it('throws when ancestors are requested for an unknown topic', () => {
    const graph = buildTopicGraph([{ id: 'tree' }], [])

    expect(() => graph.ancestorsOf('unknown')).toThrow(/unknown/i)
  })
})
