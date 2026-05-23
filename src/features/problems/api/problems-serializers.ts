import { serializePracticeSummary } from '@/features/practice/api/practice-serializers'

import type {
  ProblemBulkUpdate,
  ProblemDeleteResult,
  ProblemForEdit,
  ProblemLibrary,
} from '../data/problems-repository'
import type { Problem } from '../domain'
import {
  problemBulkUpdateResponseSchema,
  problemDeleteResponseSchema,
  problemForEditResponseSchema,
  problemLibraryResponseSchema,
  serializedProblemSchema,
  type ProblemBulkUpdateResponse,
  type ProblemDeleteResponse,
  type ProblemForEditResponse,
  type ProblemLibraryResponse,
  type SerializedProblem,
} from './problems-contracts'

export function serializeProblem(problem: Problem): SerializedProblem {
  return serializedProblemSchema.parse({
    ...problem,
    createdAt: problem.createdAt.toISOString(),
    updatedAt: problem.updatedAt.toISOString(),
  })
}

export function serializeProblemLibrary(
  library: ProblemLibrary,
): ProblemLibraryResponse {
  return problemLibraryResponseSchema.parse({
    generatedAt: library.generatedAt.toISOString(),
    summary: library.summary,
    options: library.options,
    rows: library.rows.map((row) => ({
      problem: serializeProblem(row.problem),
      status: row.status,
      summary: serializePracticeSummary(row.summary),
      nextReviewAt: row.nextReviewAt?.toISOString() ?? null,
      lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
      lastSolvedAt: row.lastSolvedAt?.toISOString() ?? null,
      topics: row.topics,
      companies: row.companies,
      trackMemberships: row.trackMemberships,
    })),
  })
}

export function serializeProblemForEdit(
  problemForEdit: ProblemForEdit,
): ProblemForEditResponse {
  return problemForEditResponseSchema.parse({
    problem: serializeProblem(problemForEdit.problem),
    topics: problemForEdit.topics,
    companies: problemForEdit.companies,
    trackMemberships: problemForEdit.trackMemberships,
    options: problemForEdit.options,
  })
}

export function serializeProblemDeleteResult(
  result: ProblemDeleteResult,
): ProblemDeleteResponse {
  return problemDeleteResponseSchema.parse(result)
}

export function serializeProblemBulkUpdate(
  result: ProblemBulkUpdate,
): ProblemBulkUpdateResponse {
  return problemBulkUpdateResponseSchema.parse(result)
}
