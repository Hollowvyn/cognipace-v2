import { describe, expect, it } from 'vitest'

import { createProblemsRepository } from '../data/problems-repository'
import { createTestDb } from '@/platform/db/test-db'
import { serializeProblemLibrary } from './problems-serializers'

describe('problem serializers', () => {
  it('preserves effective membership and aliases from the repository', async () => {
    const handle = await createTestDb()
    const repository = createProblemsRepository(handle.db)

    await repository.createProblem({
      slugOrUrl: 'bst-serializer-test',
      title: 'BST Serializer Test',
      difficulty: 'unknown',
      isPremium: false,
      topicLabels: ['BST'],
      companyLabels: [],
    })

    const serialized = serializeProblemLibrary(
      await repository.getLibrary({
        now: new Date('2026-01-01T10:01:00.000Z'),
      }),
    )
    const row = serialized.rows.find(
      ({ problem }) => problem.slug === 'bst-serializer-test',
    )

    expect(row?.topics.map(({ id }) => id)).toEqual(['binary-search-tree'])
    expect(row?.effectiveTopicIds).toEqual([
      'binary-search-tree',
      'binary-tree',
      'tree',
    ])
    expect(serialized.options.topics).toContainEqual({
      id: 'depth-first-search',
      label: 'Depth-First Search',
      aliases: ['DFS'],
    })
  })
})
