import type { UserSettings } from '@/features/settings/domain'
import {
  reconcileActiveTrackProblemReviewOverride,
  recordActiveTrackProblemReview,
} from '@/features/tracks/server/tracks-service'
import type { Db } from '@/platform/db'

import { createPracticeRepository } from '../data/practice-repository'
import type {
  OverrideLastReviewResultInput,
  ReviewResult,
  SaveReviewResultInput,
} from '../domain'

export async function saveReviewResultWithTrackProgress(
  db: Db,
  input: SaveReviewResultInput,
  settings: UserSettings,
): Promise<ReviewResult> {
  return db.transaction(async (transactionDb) => {
    const tx = transactionDb as unknown as Db
    const result = await createPracticeRepository(
      tx,
    ).saveReviewResultInTransaction(input, tx)

    if (settings.practice.mode === 'studyPlan') {
      await recordActiveTrackProblemReview(tx, {
        problemSlug: result.problemSlug,
        rating: result.rating,
        reviewedAt: result.reviewedAt,
        reviewAttemptId: result.reviewAttemptId,
      })
    }

    return result
  })
}

export async function overrideLastReviewResultWithTrackProgress(
  db: Db,
  input: OverrideLastReviewResultInput,
  settings: UserSettings,
): Promise<ReviewResult> {
  return db.transaction(async (transactionDb) => {
    const tx = transactionDb as unknown as Db
    const result = await createPracticeRepository(
      tx,
    ).overrideLastReviewResultInTransaction(input, tx)

    if (settings.practice.mode === 'studyPlan') {
      await reconcileActiveTrackProblemReviewOverride(tx, {
        problemSlug: result.problemSlug,
        rating: result.rating,
        reviewedAt: result.reviewedAt,
        reviewAttemptId: result.reviewAttemptId,
      })
    }

    return result
  })
}
