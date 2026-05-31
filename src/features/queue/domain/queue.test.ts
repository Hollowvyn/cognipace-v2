import { describe, expect, it } from 'vitest'

import {
  deriveNormalizedPracticeState,
  type PracticeStateSnapshot,
} from '@/features/practice'
import { defaultUserSettings } from '@/features/settings/domain'
import type { FsrsCardSnapshot, ReviewRating } from '@/lib/fsrs'

import { buildTodayQueue, type QueueCandidate } from './queue'

const generatedAt = new Date('2026-01-01T12:00:00.000Z')
const baseProblem = {
  slug: 'two-sum',
  title: 'Two Sum',
  difficulty: 'easy' as const,
  isPremium: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

describe('buildTodayQueue', () => {
  it('fills due and reinforcement categories while ignoring unstarted problems', () => {
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
          slug: 'unstarted',
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
      {
        ...defaultUserSettings,
        practice: {
          ...defaultUserSettings.practice,
          dailyGoal: 3,
        },
      },
      generatedAt,
    )

    expect(queue.dueCount).toBe(1)
    expect(queue.newCount).toBe(1)
    expect(queue.reinforcementCount).toBe(1)
    expect(queue.items.map((item) => item.category)).toEqual([
      'due',
      'reinforcement',
    ])
  })

  it('caps by daily goal after due items first', () => {
    const queue = buildTodayQueue(
      [
        candidate({
          slug: 'unstarted',
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
      {
        ...defaultUserSettings,
        practice: {
          ...defaultUserSettings.practice,
          dailyGoal: 1,
        },
      },
      generatedAt,
    )

    expect(queue.items).toHaveLength(1)
    expect(queue.items[0]?.problemSlug).toBe('due')
    expect(queue.newCount).toBe(1)
  })

  it('excludes manually suspended and premium-filtered candidates', () => {
    const queue = buildTodayQueue(
      [
        candidate({
          slug: 'suspended',
          practice: practice({ isSuspended: true }),
        }),
        candidate({
          slug: 'premium',
          isPremium: true,
        }),
      ],
      {
        ...defaultUserSettings,
        practice: {
          ...defaultUserSettings.practice,
          problemFilters: { skipPremium: true },
        },
      },
      generatedAt,
    )

    expect(queue.items).toEqual([])
    expect(queue.excludedCount).toBe(2)
  })

  it('excludes mastered candidates from daily queue items', () => {
    const queue = buildTodayQueue(
      [
        candidate({
          slug: 'mastered',
          practice: practice({ status: 'mastered' }),
        }),
      ],
      defaultUserSettings,
      generatedAt,
    )

    expect(queue.items).toEqual([])
    expect(queue.excludedCount).toBe(1)
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
        review: {
          ...defaultUserSettings.review,
          order: 'weakestFirst',
        },
      },
      generatedAt,
    )

    expect(queue.items.map((item) => item.problemSlug)).toEqual([
      'high-lapse',
      'low-lapse',
    ])
  })

  it('counts excluded candidates without adding them to items', () => {
    const queue = buildTodayQueue(
      [
        candidate({ slug: 'suspended', practice: practice({ isSuspended: true }) }),
        candidate({ slug: 'mastered', practice: practice({ status: 'mastered' }) }),
        candidate({ slug: 'premium', isPremium: true }),
      ],
      {
        ...defaultUserSettings,
        practice: {
          ...defaultUserSettings.practice,
          problemFilters: { skipPremium: true },
        },
      },
      generatedAt,
    )

    expect(queue.excludedCount).toBe(3)
    expect(queue.items).toEqual([])
    expect(queue.topRecommendation).toBeNull()
  })

  it('uses new items as fallback only when due and reinforcement are empty', () => {
    const queue = buildTodayQueue(
      [
        candidate({ slug: 'unstarted-a' }),
        candidate({ slug: 'unstarted-b' }),
      ],
      {
        ...defaultUserSettings,
        practice: {
          ...defaultUserSettings.practice,
          dailyGoal: 3,
        },
      },
      generatedAt,
    )

    expect(queue.newCount).toBe(2)
    expect(queue.items.map((item) => item.category)).toEqual(['new', 'new'])
    expect(queue.items[0]?.reason).toBe('new-problem')
    expect(queue.topRecommendation?.problemSlug).toBe('unstarted-a')
    expect(queue.topRecommendation?.reason).toBe('new-problem')
  })

  it('does not include new items in items[] when due items are present', () => {
    const queue = buildTodayQueue(
      [
        candidate({ slug: 'unstarted' }),
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
      defaultUserSettings,
      generatedAt,
    )

    expect(queue.newCount).toBe(1)
    expect(queue.items.map((i) => i.category)).toEqual(['due'])
    expect(queue.items[0]?.reason).toBe('overdue')
    expect(queue.topRecommendation?.reason).toBe('overdue')
  })

  it('does not include new items in items[] when reinforcement items are present', () => {
    const queue = buildTodayQueue(
      [
        candidate({ slug: 'unstarted' }),
        candidate({
          slug: 'started',
          card: reviewCard({
            dueAt: new Date('2026-01-10T00:00:00.000Z'),
            lastReviewAt: new Date('2026-01-01T08:00:00.000Z'),
            stability: 30,
          }),
          practice: practice({ lastRating: 'good' }),
        }),
      ],
      defaultUserSettings,
      generatedAt,
    )

    expect(queue.newCount).toBe(1)
    expect(queue.items.map((i) => i.category)).toEqual(['reinforcement'])
    expect(queue.items[0]?.reason).toBe('reinforcement')
  })

  it('sets reason to due-now for a due item that is not overdue', () => {
    const queue = buildTodayQueue(
      [
        candidate({
          slug: 'due-now',
          card: reviewCard({
            dueAt: generatedAt,
            lastReviewAt: new Date('2025-12-01T00:00:00.000Z'),
            stability: 1,
          }),
          practice: practice({ lastRating: 'good' }),
        }),
      ],
      defaultUserSettings,
      generatedAt,
    )

    expect(queue.items[0]?.reason).toBe('due-now')
    expect(queue.topRecommendation?.reason).toBe('due-now')
  })

  it('returns null topRecommendation for an empty queue', () => {
    const queue = buildTodayQueue([], defaultUserSettings, generatedAt)

    expect(queue.topRecommendation).toBeNull()
    expect(queue.excludedCount).toBe(0)
  })
})

function candidate(input: {
  slug: string
  isPremium?: boolean
  practice?: PracticeStateSnapshot | null
  card?: FsrsCardSnapshot | null
}): QueueCandidate {
  const problemSlug = input.slug
  const cardId = `${problemSlug}:default`

  return {
    problem: {
      ...baseProblem,
      slug: problemSlug,
      title: titleFromSlug(problemSlug),
      isPremium: input.isPremium ?? false,
    },
    state: deriveNormalizedPracticeState({
      problemSlug,
      cardId,
      practice: input.practice ?? null,
      card: input.card ?? null,
      attempts: [],
      now: generatedAt,
    }),
  }
}

function practice(input: {
  lastRating?: ReviewRating
  isSuspended?: boolean
  status?: PracticeStateSnapshot['status']
}): PracticeStateSnapshot {
  const lastRating = input.lastRating ?? 'good'

  return {
    status: input.status ?? (input.isSuspended ? 'suspended' : 'review'),
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
