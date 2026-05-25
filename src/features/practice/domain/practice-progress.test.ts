import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildPracticeProgressSummary,
  toPracticeDateKey,
  type PracticeProgressAttempt,
} from './practice-progress'

const now = new Date('2026-05-25T16:30:00.000Z')

afterEach(() => {
  vi.useRealTimers()
})

describe('buildPracticeProgressSummary', () => {
  it('counts unique practiced problems for the current local day', () => {
    const summary = buildPracticeProgressSummary(
      [
        attempt('two-sum', '2026-05-25T10:00:00.000Z'),
        attempt('two-sum', '2026-05-25T11:00:00.000Z'),
        attempt('valid-parentheses', '2026-05-25T12:00:00.000Z'),
      ],
      { dailyGoal: 4, now },
    )

    expect(summary).toMatchObject({
      completedToday: 2,
      dailyGoal: 4,
      goalMetToday: false,
      todayDateKey: toPracticeDateKey(now),
    })
  })

  it('counts saved practice attempts because effort matters', () => {
    const summary = buildPracticeProgressSummary(
      [
        attempt('add-binary', '2026-05-25T10:00:00.000Z'),
        attempt('jump-game-iv', '2026-05-25T12:00:00.000Z'),
      ],
      { dailyGoal: 2, now },
    )

    expect(summary.completedToday).toBe(2)
    expect(summary.goalMetToday).toBe(true)
    expect(summary.currentStreak).toBe(1)
  })

  it('rounds fractional daily goals before evaluating progress', () => {
    const summary = buildPracticeProgressSummary(
      [
        attempt('add-binary', '2026-05-25T10:00:00.000Z'),
        attempt('jump-game-iv', '2026-05-25T12:00:00.000Z'),
      ],
      { dailyGoal: 1.6, now },
    )

    expect(summary.dailyGoal).toBe(2)
    expect(summary.goalMetToday).toBe(true)
    expect(summary.currentStreak).toBe(1)
  })

  it('clamps negative daily goals to disabled progress goals', () => {
    const summary = buildPracticeProgressSummary(
      [attempt('two-sum', '2026-05-25T10:00:00.000Z')],
      { dailyGoal: -1, now },
    )

    expect(summary).toMatchObject({
      completedToday: 1,
      dailyGoal: 0,
      goalMetToday: false,
      currentStreak: 0,
    })
  })

  it('counts a streak only across consecutive days that meet the daily goal', () => {
    const summary = buildPracticeProgressSummary(
      [
        attempt('today-a', '2026-05-25T10:00:00.000Z'),
        attempt('today-b', '2026-05-25T11:00:00.000Z'),
        attempt('yesterday-a', '2026-05-24T10:00:00.000Z'),
        attempt('yesterday-b', '2026-05-24T11:00:00.000Z'),
        attempt('old-a', '2026-05-22T10:00:00.000Z'),
        attempt('old-b', '2026-05-22T11:00:00.000Z'),
      ],
      { dailyGoal: 2, now },
    )

    expect(summary.currentStreak).toBe(2)
  })

  it('does not preserve the current streak before today meets the goal', () => {
    const summary = buildPracticeProgressSummary(
      [
        attempt('today-a', '2026-05-25T10:00:00.000Z'),
        attempt('yesterday-a', '2026-05-24T10:00:00.000Z'),
        attempt('yesterday-b', '2026-05-24T11:00:00.000Z'),
      ],
      { dailyGoal: 2, now },
    )

    expect(summary.completedToday).toBe(1)
    expect(summary.goalMetToday).toBe(false)
    expect(summary.currentStreak).toBe(0)
  })

  it('handles a disabled daily goal without divide-by-zero behavior', () => {
    const summary = buildPracticeProgressSummary(
      [attempt('two-sum', '2026-05-25T10:00:00.000Z')],
      { dailyGoal: 0, now },
    )

    expect(summary).toMatchObject({
      completedToday: 1,
      dailyGoal: 0,
      goalMetToday: false,
      currentStreak: 0,
    })
  })
})

describe('toPracticeDateKey', () => {
  it('falls back to the current local day when given an invalid date', () => {
    const fallbackNow = new Date('2026-06-02T09:15:00.000Z')

    vi.useFakeTimers()
    vi.setSystemTime(fallbackNow)

    expect(toPracticeDateKey(new Date(Number.NaN))).toBe(
      toPracticeDateKey(fallbackNow),
    )
  })
})

function attempt(
  problemSlug: string,
  reviewedAt: string,
): PracticeProgressAttempt {
  return {
    problemSlug,
    reviewedAt: new Date(reviewedAt),
  }
}
