import { describe, expect, it } from 'vitest'

import { defaultUserSettings } from '@/features/settings'

import { buildTodayQueue, type QueueCandidate } from './queue'

const baseProblem = {
  id: 'leetcode:two-sum',
  source: 'leetcode' as const,
  externalId: '1',
  slug: 'two-sum',
  title: 'Two Sum',
  difficulty: 'easy' as const,
  url: 'https://leetcode.com/problems/two-sum/',
  isPremium: false,
  acceptanceRate: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

describe('buildTodayQueue', () => {
  it('prioritizes due cards before new cards and respects the daily goal', () => {
    const generatedAt = new Date('2026-01-01T12:00:00.000Z')
    const candidates: QueueCandidate[] = [
      {
        problem: { ...baseProblem, id: 'leetcode:new', slug: 'new' },
        position: 1,
        practiceStatus: null,
        isSuspended: false,
        dueAt: null,
        cardState: null,
      },
      {
        problem: { ...baseProblem, id: 'leetcode:due', slug: 'due' },
        position: 2,
        practiceStatus: 'review',
        isSuspended: false,
        dueAt: new Date('2026-01-01T08:00:00.000Z'),
        cardState: 'review',
      },
    ]

    const queue = buildTodayQueue(
      candidates,
      { ...defaultUserSettings, dailyQuestionGoal: 1 },
      generatedAt,
    )

    expect(queue.items).toHaveLength(1)
    expect(queue.items[0]?.slug).toBe('due')
  })

  it('excludes suspended candidates', () => {
    const queue = buildTodayQueue(
      [
        {
          problem: baseProblem,
          position: 1,
          practiceStatus: 'suspended',
          isSuspended: true,
          dueAt: new Date('2026-01-01T08:00:00.000Z'),
          cardState: 'review',
        },
      ],
      defaultUserSettings,
      new Date('2026-01-01T12:00:00.000Z'),
    )

    expect(queue.items).toEqual([])
  })
})
