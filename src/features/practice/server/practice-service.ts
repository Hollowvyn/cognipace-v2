import type { Db } from '@/platform/db'

import { createPracticeRepository } from '../data/practice-repository'
import type {
  PracticeDetails,
  OverrideLastReviewResultInput,
  PracticeReadOptions,
  ResetPracticeScheduleInput,
  SaveReviewResultInput,
  SetPracticeSuspendedInput,
  UpdatePracticeLogInput,
} from '../domain'

export function getPracticeDetails(
  db: Db,
  problemSlug: string,
  options: PracticeReadOptions = {},
): Promise<PracticeDetails> {
  return createPracticeRepository(db).getPracticeDetails(problemSlug, options)
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

export function setPracticeSuspended(db: Db, input: SetPracticeSuspendedInput) {
  return createPracticeRepository(db).setPracticeSuspended(input)
}

export function resetPracticeSchedule(
  db: Db,
  input: ResetPracticeScheduleInput,
) {
  return createPracticeRepository(db).resetPracticeSchedule(input)
}

export function updateCurrentPracticeLog(
  db: Db,
  input: UpdatePracticeLogInput,
) {
  return createPracticeRepository(db).updateCurrentPracticeLog(input)
}
