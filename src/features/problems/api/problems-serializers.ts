import { serializePracticeSummary } from '@/features/practice/api/practice-serializers'

import type {
  ProblemBulkUpdate,
  ProblemForEdit,
  ProblemLibrary,
} from '../data/problems-repository'
import type { Problem } from '../domain'
import {
  problemBulkUpdateResponseSchema,
  problemForEditResponseSchema,
  problemLibraryResponseSchema,
  serializedProblemSchema,
  type ProblemBulkUpdateResponse,
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
    ...library,
    generatedAt: library.generatedAt.toISOString(),
    rows: library.rows.map((row) => ({
      ...row,
      problem: serializeProblem(row.problem),
      summary: serializePracticeSummary(row.summary),
      nextReviewAt: row.nextReviewAt?.toISOString() ?? null,
      lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
      lastSolvedAt: row.lastSolvedAt?.toISOString() ?? null,
    })),
  })
}

export function serializeProblemForEdit(
  problemForEdit: ProblemForEdit,
): ProblemForEditResponse {
  return problemForEditResponseSchema.parse({
    ...problemForEdit,
    problem: serializeProblem(problemForEdit.problem),
  })
}

export function serializeProblemBulkUpdate(
  result: ProblemBulkUpdate,
): ProblemBulkUpdateResponse {
  return problemBulkUpdateResponseSchema.parse(result)
}
