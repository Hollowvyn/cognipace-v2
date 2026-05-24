import { normalizeLeetCodeSlug, titleFromLeetCodeSlug } from '@/lib/leetcode'

export type ProblemSlug = string

export const problemDifficulties = [
  'easy',
  'medium',
  'hard',
  'unknown',
] as const

export type ProblemDifficulty = (typeof problemDifficulties)[number]

export interface Problem {
  slug: ProblemSlug
  title: string
  difficulty: ProblemDifficulty
  isPremium: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UpsertProblemInput {
  slug: ProblemSlug
  title?: string | null | undefined
  difficulty?: string | null | undefined
  isPremium?: boolean | null | undefined
}

export function createLeetCodeProblemSlug(slugInput: string): ProblemSlug {
  return normalizeLeetCodeSlug(slugInput)
}

export function normalizeProblemDifficulty(
  difficulty: string | null | undefined,
): ProblemDifficulty {
  const normalized = difficulty?.trim().toLowerCase()

  if (
    normalized === 'easy' ||
    normalized === 'medium' ||
    normalized === 'hard'
  ) {
    return normalized
  }

  return 'unknown'
}

export function titleFromSlug(slug: string) {
  return titleFromLeetCodeSlug(slug)
}
