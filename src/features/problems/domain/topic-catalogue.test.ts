import { describe, expect, it } from 'vitest'

import {
  seedTopicAliases,
  seedTopicRelations,
  seedTopics,
} from '@/platform/db/topic-taxonomy-seed'

import { buildTopicGraph } from './topic-graph'
import { buildTopicLookup } from './topic-taxonomy'

const sourceLabels = [
  'Array',
  'String',
  'Hash Table',
  'Math',
  'Dynamic Programming',
  'Sorting',
  'Greedy',
  'Binary Search',
  'Depth-First Search',
  'Database',
  'Bit Manipulation',
  'Matrix',
  'Prefix Sum',
  'Tree',
  'Two Pointers',
  'Breadth-First Search',
  'Heap (Priority Queue)',
  'Simulation',
  'Counting',
  'Graph Theory',
  'Stack',
  'Binary Tree',
  'Sliding Window',
  'Enumeration',
  'Design',
  'Backtracking',
  'Number Theory',
  'Union-Find',
  'Segment Tree',
  'Linked List',
  'Ordered Set',
  'Monotonic Stack',
  'Divide and Conquer',
  'Combinatorics',
  'Trie',
  'Queue',
  'Bitmask',
  'Binary Indexed Tree',
  'Recursion',
  'Hash Function',
  'Geometry',
  'Memoization',
  'Shortest Path',
  'Binary Search Tree',
  'Topological Sort',
  'String Matching',
  'Rolling Hash',
  'Game Theory',
  'Monotonic Queue',
  'Interactive',
  'Data Stream',
  'Brainteaser',
  'Merge Sort',
  'Minimax',
  'Doubly-Linked List',
  'Randomized',
  'Counting Sort',
  'Iterator',
  'Concurrency',
  'Suffix Array',
  'Quickselect',
  'Sweep Line',
  'Probability and Statistics',
  'Minimum Spanning Tree',
  'Bucket Sort',
  'Shell',
  'Meet in the Middle',
  'Reservoir Sampling',
  'Eulerian Circuit',
  'Radix Sort',
  'Strongly Connected Component',
  'Rejection Sampling',
  'Biconnected Component',
]

describe('curated topic catalogue', () => {
  it('keeps stable IDs, aliases, and the complete source inventory resolvable', () => {
    expect(
      seedTopics.find((row) => row.id === 'meet-in-the-middle')?.label,
    ).toBe('Meet in the Middle')
    expect(
      seedTopics.find((row) => row.id === 'heap-priority-queue')?.label,
    ).toBe('Heap (Priority Queue)')
    const lookup = buildTopicLookup(seedTopics, seedTopicAliases)
    expect(lookup.get('heap')?.id).toBe('heap-priority-queue')
    expect(lookup.get('bit')?.id).toBe('binary-indexed-tree')
    expect(lookup.get('dsu')?.id).toBe('union-find')
    expect(lookup.get('kmp')?.id).toBe('kmp')
    expect(lookup.get('minimax')?.id).toBe('minimax')
    expect(lookup.get('arrays & hashing')).toBeUndefined()
    expect(
      [...sourceLabels, 'Heap'].filter(
        (label) => !lookup.has(label.toLowerCase()),
      ),
    ).toEqual([])
    expect(lookup.get('intervals')?.id).toBe('intervals')
  })

  it('keeps BFS independent in the broader hierarchy', () => {
    expect(
      buildTopicGraph(seedTopics, seedTopicRelations).ancestorsOf(
        'breadth-first-search',
      ),
    ).toEqual([])
  })
})
