import { parseLeetCodeProblemLocation } from '@/lib/leetcode'
import type { Db } from '@/platform/db'

import { createProblemsRepository } from '../data/problems-repository'
import type { UpsertProblemInput } from '../domain'

export interface UpsertProblemFromPageInput
  extends Omit<UpsertProblemInput, 'slug'> {
  slug?: string | null | undefined
  url: string
}

export async function upsertProblemFromPage(
  db: Db,
  input: UpsertProblemFromPageInput,
  now = new Date(),
) {
  const location = parseLeetCodeProblemLocation(input.url)
  const slug = input.slug ?? location?.slug

  if (!slug) {
    throw new Error('Current page is not a canonical LeetCode problem URL.')
  }

  return createProblemsRepository(db).upsertFromLeetCode(
    {
      slug,
      title: input.title,
      difficulty: input.difficulty,
      isPremium: input.isPremium,
    },
    now,
  )
}

export async function getProblemContext(db: Db, slug: string) {
  return createProblemsRepository(db).getContextBySlug(slug)
}
