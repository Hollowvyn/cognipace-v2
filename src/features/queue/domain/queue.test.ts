import { describe, expect, it } from 'vitest'

import { defaultUserSettings } from '@/features/settings'
import type { FsrsCardSnapshot, ReviewRating } from '@/lib/fsrs'

import { buildTodayQueue, type QueueCandidate } from './queue'

const generatedAt = new Date('2026-01-01T12:00:00.000Z')
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
  it('fills due, active-track new, and reinforcement categories in priority order', () => {
    const queue = buildTodayQueue(
      [
        candidate({
          slug: 'reinforcement',
          card: reviewCard({
            dueAt: new Date('2026-01-10T00:00:00.000Z'),
            lastReviewAt: new Date('2026-01-01T08:00:00.000Z'),
            stability: 30,
          }),
          practice: practice({ lastRating: 'good' }),
        }),
        candidate({
          slug: 'new',
          activeTrackPosition: 1,
        }),
        candidate({
          slug: 'due',
          card: reviewCard({
            dueAt: new Date('2025-12-25T00:00:00.000Z'),
            lastReviewAt: new Date('2025-12-01T00:00:00.000Z'),
            stability: 1,
          }),
          practice: practice({ lastRating: 'again' }),
        }),
      ],
      { ...defaultUserSettings, dailyQuestionGoal: 3 },
      generatedAt,
    )

    expect(queue.dueCount).toBe(1)
    expect(queue.newCount).toBe(1)
    expect(queue.reinforcementCount).toBe(1)
    expect(queue.items.map((item) => item.category)).toEqual([
      'due',
      'new',
      'reinforcement',
    ])
  })

  it('caps by daily goal after due items first', () => {
    const queue = buildTodayQueue(
      [
        candidate({
          slug: 'new',
          activeTrackPosition: 1,
        }),
        candidate({
          slug: 'due',
          card: reviewCard({
            dueAt: new Date('2025-12-25T00:00:00.000Z'),
            lastReviewAt: new Date('2025-12-01T00:00:00.000Z'),
            stability: 1,
          }),
          practice: practice({ lastRating: 'hard' }),
        }),
      ],
      { ...defaultUserSettings, dailyQuestionGoal: 1 },
      generatedAt,
    )

    expect(queue.items).toHaveLength(1)
    expect(queue.items[0]?.slug).toBe('due')
  })

  it('excludes manually suspended and premium-filtered candidates', () => {
    const queue = buildTodayQueue(
      [
        candidate({
          slug: 'suspended',
          activeTrackPosition: 1,
          practice: practice({ isSuspended: true }),
        }),
        candidate({
          slug: 'premium',
          activeTrackPosition: 2,
          isPremium: true,
        }),
      ],
      {
        ...defaultUserSettings,
        questionFilters: { skipPremium: true },
      },
      generatedAt,
    )

    expect(queue.items).toEqual([])
  })

  it('honors weakest-first ordering for review items', () => {
    const queue = buildTodayQueue(
      [
        candidate({
          slug: 'low-lapse',
          card: reviewCard({
            lapses: 1,
            difficulty: 8,
            dueAt: new Date('2025-12-24T00:00:00.000Z'),
            lastReviewAt: new Date('2025-12-01T00:00:00.000Z'),
            stability: 1,
          }),
          practice: practice({ lastRating: 'again' }),
        }),
        candidate({
          slug: 'high-lapse',
          card: reviewCard({
            lapses: 3,
            difficulty: 4,
            dueAt: new Date('2025-12-25T00:00:00.000Z'),
            lastReviewAt: new Date('2025-12-01T00:00:00.000Z'),
            stability: 1,
          }),
          practice: practice({ lastRating: 'again' }),
        }),
      ],
      {
        ...defaultUserSettings,
        memoryReview: {
          ...defaultUserSettings.memoryReview,
          reviewOrder: 'weakestFirst',
        },
      },
      generatedAt,
    )

    expect(queue.items.map((item) => item.slug)).toEqual([
      'high-lapse',
      'low-lapse',
    ])
  })
})

function candidate(input: {
  slug: string
  activeTrackPosition?: number | null
  isPremium?: boolean
  practice?: QueueCandidate['practice']
  card?: FsrsCardSnapshot | null
}): QueueCandidate {
  return {
    problem: {
      ...baseProblem,
      id: `leetcode:${input.slug}`,
      slug: input.slug,
      title: titleFromSlug(input.slug),
      isPremium: input.isPremium ?? false,
    },
    activeTrackPosition: input.activeTrackPosition ?? null,
    practice: input.practice ?? null,
    card: input.card ?? null,
  }
}

function practice(input: {
  lastRating?: ReviewRating
  isSuspended?: boolean
}): NonNullable<QueueCandidate['practice']> {
  const lastRating = input.lastRating ?? 'good'

  return {
    status: input.isSuspended ? 'suspended' : 'review',
    lastReviewedAt: new Date('2026-01-01T08:00:00.000Z'),
    attemptCount: 1,
    solvedCount: lastRating === 'again' ? 0 : 1,
    isSuspended: input.isSuspended ?? false,
    lastRating,
    lastElapsedSeconds: null,
    bestElapsedSeconds: null,
    log: {
      interviewPattern: null,
      timeComplexity: null,
      spaceComplexity: null,
      languages: null,
      notes: null,
    },
  }
}

function reviewCard(
  overrides: Partial<FsrsCardSnapshot> = {},
): FsrsCardSnapshot {
  return {
    dueAt: new Date('2025-12-25T00:00:00.000Z'),
    stability: 1,
    difficulty: 5,
    elapsedDays: 1,
    scheduledDays: 1,
    learningSteps: 0,
    reps: 1,
    lapses: 0,
    state: 'review',
    lastReviewAt: new Date('2025-12-01T00:00:00.000Z'),
    ...overrides,
  }
}

function titleFromSlug(slug: string) {
  return slug
    .split('-')
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ')
}
