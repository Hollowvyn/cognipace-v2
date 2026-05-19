import type { Problem } from './problem'

export interface ProblemContext {
  problem: Problem
  isTracked: boolean
  practiceStatus: string | null
  dueAt: Date | null
}
