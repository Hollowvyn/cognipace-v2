import type { Db } from '@/platform/db'

import { createPracticeRepository } from '../data/practice-repository'
import type { SaveReviewResultInput } from '../domain'

export function saveReviewResult(db: Db, input: SaveReviewResultInput) {
  return createPracticeRepository(db).saveReviewResult(input)
}
