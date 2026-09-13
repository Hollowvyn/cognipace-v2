import { describe, expect, it } from 'vitest'

import { derivePracticeScheduleTiming } from './practice-schedule'

describe('derivePracticeScheduleTiming', () => {
  const now = new Date(2026, 8, 13, 2, 11, 31)

  it('marks a prior local date overdue even when less than 24 hours elapsed', () => {
    expect(
      derivePracticeScheduleTiming({
        dueAt: new Date(2026, 8, 12, 23, 30),
        isStarted: true,
        isSuspended: false,
        now,
      }),
    ).toEqual({ isDue: true, isOverdue: true, overdueDays: 1 })
  })

  it('marks every instant on the current local date due today', () => {
    expect(
      derivePracticeScheduleTiming({
        dueAt: new Date(2026, 8, 13, 22),
        isStarted: true,
        isSuspended: false,
        now,
      }),
    ).toEqual({ isDue: true, isOverdue: false, overdueDays: 0 })
  })

  it('keeps a later local date scheduled', () => {
    expect(
      derivePracticeScheduleTiming({
        dueAt: new Date(2026, 8, 14, 0),
        isStarted: true,
        isSuspended: false,
        now,
      }),
    ).toEqual({ isDue: false, isOverdue: false, overdueDays: 0 })
  })

  it('allows suspension to override presentation without mutating dueAt', () => {
    const dueAt = new Date(2026, 8, 2)

    expect(
      derivePracticeScheduleTiming({
        dueAt,
        isStarted: true,
        isSuspended: true,
        now,
      }),
    ).toEqual({ isDue: false, isOverdue: false, overdueDays: 0 })

    expect(dueAt).toEqual(new Date(2026, 8, 2))
  })

  it.each([
    ['not started', false, new Date(2026, 8, 2)],
    ['missing due date', true, null],
    ['invalid due date', true, new Date(Number.NaN)],
  ])('does not classify %s cards as due', (_name, isStarted, dueAt) => {
    expect(
      derivePracticeScheduleTiming({
        dueAt,
        isStarted,
        isSuspended: false,
        now,
      }),
    ).toEqual({ isDue: false, isOverdue: false, overdueDays: 0 })
  })
})
