import type { Db } from '@/platform/db'

import { createPracticeRepository } from '../data/practice-repository'
import type {
  PracticeDetails,
  OverrideLastReviewResultInput,
  PracticeReadOptions,
  SaveReviewResultInput,
} from '../domain'

export function getPracticeDetails(
  db: Db,
  problemId: string,
  options: PracticeReadOptions = {},
): Promise<PracticeDetails> {
  return createPracticeRepository(db).getPracticeDetails(problemId, options)
}

export function saveReviewResult(db: Db, input: SaveReviewResultInput) {
  return createPracticeRepository(db).saveReviewResult(input)
}

export function overrideLastReviewResult(
  db: Db,
  input: OverrideLastReviewResultInput,
) {
  return createPracticeRepository(db).overrideLastReviewResult(input)
}
