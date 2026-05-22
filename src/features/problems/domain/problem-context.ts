import type { PracticeStatus } from '@/features/practice/domain'

import type { Problem } from './problem'

export interface ProblemContext {
  problem: Problem
  isTracked: boolean
  practiceStatus: PracticeStatus | null
  dueAt: Date | null
}
