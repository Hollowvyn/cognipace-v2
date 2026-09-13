/**
 * Derives presentation timing from the persisted FSRS due date.
 *
 * FSRS owns the due instant; this helper only projects that instant onto the
 * user's local calendar so a card is due for the whole day it is scheduled.
 */
export function derivePracticeScheduleTiming(input: {
  dueAt: Date | null
  isStarted: boolean
  isSuspended: boolean
  now: Date
}) {
  if (
    input.isSuspended ||
    !input.isStarted ||
    !input.dueAt ||
    Number.isNaN(input.dueAt.getTime()) ||
    Number.isNaN(input.now.getTime())
  ) {
    return { isDue: false, isOverdue: false, overdueDays: 0 }
  }

  const today = localCalendarOrdinal(input.now)
  const dueDate = localCalendarOrdinal(input.dueAt)
  const overdueDays = Math.max(0, today - dueDate)

  return {
    isDue: dueDate <= today,
    isOverdue: overdueDays > 0,
    overdueDays,
  }
}

function localCalendarOrdinal(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / dayMs,
  )
}

const dayMs = 24 * 60 * 60 * 1000
