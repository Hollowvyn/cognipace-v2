import { parseLeetCodeProblemLocation } from '@/lib/leetcode'
import type { Db } from '@/platform/db'

import { createProblemsRepository } from '../data/problems-repository'
import type { UpsertProblemInput } from '../domain'

export interface UpsertProblemFromPageInput extends Omit<
  UpsertProblemInput,
  'slug' | 'url'
> {
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
      ...input,
      slug,
      url: location?.url ?? input.url,
    },
    now,
  )
}

export async function getProblemContext(db: Db, slug: string) {
  return createProblemsRepository(db).getContextBySlug(slug)
}
