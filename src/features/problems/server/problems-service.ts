import {
  parseLeetCodeProblemInput,
  parseLeetCodeProblemLocation,
} from '@/lib/leetcode'
import type { Db } from '@/platform/db'

import { createProblemsRepository } from '../data/problems-repository'
import type {
  ProblemsBulkDeleteRequest,
  ProblemsBulkUpdateProblemsRequest,
  ProblemsCreateProblemRequest,
  ProblemsDeleteProblemRequest,
  ProblemsGetLibraryRequest,
  ProblemsGetProblemForEditRequest,
  ProblemsUpdateProblemRequest,
} from '../api/problems-contracts'
import {
  serializeProblem,
  serializeProblemBulkUpdate,
  serializeProblemDeleteResult,
  serializeProblemForEdit,
  serializeProblemLibrary,
} from '../api/problems-serializers'
import type { UpsertProblemInput } from '../domain'
import { getSettings } from '@/features/settings/server/settings-service'

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

  return serializeProblem(
    await createProblemsRepository(db).upsertFromLeetCode(
      {
        slug,
        previousSlug: location?.slug,
        title: input.title,
        difficulty: input.difficulty,
        isPremium: input.isPremium,
      },
      now,
    ),
  )
}

export async function getProblemContext(db: Db, slug: string) {
  return createProblemsRepository(db).getContextBySlug(slug)
}

export async function getProblemLibrary(
  db: Db,
  request: ProblemsGetLibraryRequest,
) {
  const settings = await getSettings(db)
  const library = await createProblemsRepository(db).getLibrary({
    targetRetention: settings.review.targetRetention,
    ...(request.at ? { now: new Date(request.at) } : {}),
  })

  return serializeProblemLibrary(library)
}

export async function getProblemForEdit(
  db: Db,
  request: ProblemsGetProblemForEditRequest,
) {
  const problemForEdit = await createProblemsRepository(db).getForEdit(
    request.problemSlug,
  )

  if (!problemForEdit) {
    throw new Error(`Problem "${request.problemSlug}" was not found.`)
  }

  return serializeProblemForEdit(problemForEdit)
}

export async function createProblem(
  db: Db,
  request: ProblemsCreateProblemRequest,
) {
  return serializeProblemForEdit(
    await createProblemsRepository(db).createProblem({
      slugOrUrl: request.slugOrUrl,
      title: request.title,
      difficulty: request.difficulty,
      isPremium: request.isPremium,
      topicLabels: request.topicLabels,
      companyLabels: request.companyLabels,
    }),
  )
}

export async function updateProblem(
  db: Db,
  request: ProblemsUpdateProblemRequest,
) {
  const problemForEdit = await createProblemsRepository(db).updateProblem({
    problemSlug: request.problemSlug,
    title: request.title,
    difficulty: request.difficulty,
    isPremium: request.isPremium,
    topicLabels: request.topicLabels,
    companyLabels: request.companyLabels,
  })

  if (!problemForEdit) {
    throw new Error(`Problem "${request.problemSlug}" was not found.`)
  }

  return serializeProblemForEdit(problemForEdit)
}

export async function deleteProblem(
  db: Db,
  request: ProblemsDeleteProblemRequest,
) {
  return serializeProblemDeleteResult(
    await createProblemsRepository(db).deleteProblems([request.problemSlug]),
  )
}

export async function bulkDeleteProblems(
  db: Db,
  request: ProblemsBulkDeleteRequest,
) {
  return serializeProblemDeleteResult(
    await createProblemsRepository(db).deleteProblems(request.problemSlugs),
  )
}

export async function bulkUpdateProblems(
  db: Db,
  request: ProblemsBulkUpdateProblemsRequest,
) {
  return serializeProblemBulkUpdate(
    await createProblemsRepository(db).bulkUpdateProblems({
      problemSlugs: request.problemSlugs,
      set: request.set,
    }),
  )
}

export function readProblemSlugFromSlugOrUrl(slugOrUrl: string) {
  return parseLeetCodeProblemInput(slugOrUrl)?.slug ?? null
}
