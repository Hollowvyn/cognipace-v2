import { normalizeLeetCodeSlug } from '@/lib/leetcode/problem-url'

export const problemDifficulties = [
  'easy',
  'medium',
  'hard',
  'unknown',
] as const

export type ProblemDifficulty = (typeof problemDifficulties)[number]

export interface Problem {
  id: string
  source: 'leetcode'
  externalId: string | null
  slug: string
  title: string
  difficulty: ProblemDifficulty
  url: string
  isPremium: boolean
  acceptanceRate: number | null
  createdAt: Date
  updatedAt: Date
}

export interface UpsertProblemInput {
  slug: string
  title?: string | null | undefined
  difficulty?: string | null | undefined
  url?: string | null | undefined
  isPremium?: boolean | null | undefined
  externalId?: string | null | undefined
  acceptanceRate?: number | null | undefined
}

export function createLeetCodeProblemId(slug: string) {
  return `leetcode:${normalizeLeetCodeSlug(slug)}`
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
  return normalizeLeetCodeSlug(slug)
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
