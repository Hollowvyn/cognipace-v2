import type { PracticeProgressSummary } from '@/features/practice'

export interface AppShellMetricsInput {
  dueCount: number
  practiceProgress: Pick<PracticeProgressSummary, 'currentStreak'>
}

export function createAppShellMetrics(input: AppShellMetricsInput) {
  return [
    { label: 'Due Today', value: String(input.dueCount) },
    {
      label: 'Streak',
      value: formatPracticeStreakValue(input.practiceProgress.currentStreak),
    },
  ]
}

function formatPracticeStreakValue(streak: number) {
  const normalizedStreak = Math.max(0, Math.round(streak))

  return `${normalizedStreak} ${normalizedStreak === 1 ? 'day' : 'days'}`
}
