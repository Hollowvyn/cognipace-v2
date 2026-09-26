import { describe, expect, it } from 'vitest'

import { matchesProblemTopics } from './problem-library-filtering'

describe('topic membership', () => {
  it.each([
    {
      direct: ['bst'],
      effective: ['bst', 'binary-tree', 'tree'],
      selected: ['tree'],
      mode: 'any',
      subtopics: true,
      result: true,
    },
    {
      direct: ['bst'],
      effective: ['bst', 'binary-tree', 'tree'],
      selected: ['tree'],
      mode: 'any',
      subtopics: false,
      result: false,
    },
    {
      direct: ['dfs', 'graph'],
      effective: ['dfs', 'graph'],
      selected: ['tree'],
      mode: 'any',
      subtopics: true,
      result: false,
    },
    {
      direct: ['dfs', 'binary-tree'],
      effective: ['dfs', 'binary-tree', 'tree'],
      selected: ['tree', 'dfs'],
      mode: 'all',
      subtopics: true,
      result: true,
    },
    {
      direct: ['binary-tree'],
      effective: ['binary-tree', 'tree'],
      selected: ['tree', 'dfs'],
      mode: 'all',
      subtopics: true,
      result: false,
    },
    {
      direct: ['dfs', 'graph'],
      effective: ['dfs', 'graph'],
      selected: ['tree', 'dfs'],
      mode: 'any',
      subtopics: true,
      result: true,
    },
    {
      direct: ['tree', 'binary-tree'],
      effective: ['tree', 'binary-tree'],
      selected: ['tree'],
      mode: 'any',
      subtopics: true,
      result: true,
    },
    {
      direct: ['binary-search-tree'],
      effective: ['binary-search-tree', 'binary-search', 'binary-tree', 'tree'],
      selected: ['tree', 'binary-tree'],
      mode: 'all',
      subtopics: true,
      result: true,
    },
    {
      direct: [],
      effective: [],
      selected: ['tree'],
      mode: 'any',
      subtopics: true,
      result: false,
    },
  ] as const)('$direct with $selected ($mode/$subtopics)', (example) => {
    const row = {
      topics: example.direct.map((id) => ({ id, label: id, parentTopics: [] })),
      effectiveTopicIds: [...example.effective],
    }

    expect(
      matchesProblemTopics(row, {
        topicIds: [...example.selected],
        topicMatchMode: example.mode,
        includeSubtopics: example.subtopics,
      }),
    ).toBe(example.result)
  })

  it('does not constrain an empty selection', () => {
    expect(
      matchesProblemTopics(
        { topics: [], effectiveTopicIds: [] },
        {
          topicIds: [],
          topicMatchMode: 'all',
          includeSubtopics: false,
        },
      ),
    ).toBe(true)
  })
})
