import { serializeNormalizedPracticeState } from '@/features/practice/api/practice-serializers'

import type {
  ProblemForEdit,
  ProblemLibrary,
  ProblemLibraryRow as DomainProblemLibraryRow,
} from '../data/problems-repository'
import type { Problem } from '../domain'
import {
  problemForEditResponseSchema,
  problemLibraryResponseSchema,
  problemLibraryRowSchema,
  serializedProblemSchema,
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
    rows: library.rows.map(serializeProblemLibraryRow),
  })
}

export function serializeProblemLibraryRow(row: DomainProblemLibraryRow) {
  return problemLibraryRowSchema.parse({
    ...row,
    problem: serializeProblem(row.problem),
    state: serializeNormalizedPracticeState(row.state),
    nextReviewAt: row.nextReviewAt?.toISOString() ?? null,
    lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
    lastSolvedAt: row.lastSolvedAt?.toISOString() ?? null,
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
