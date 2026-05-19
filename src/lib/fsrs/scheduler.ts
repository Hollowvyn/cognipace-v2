import { createEmptyCard, fsrs, generatorParameters } from 'ts-fsrs'

import { fromFsrsCard, toFsrsCard, type FsrsCardSnapshot } from './card'
import { toFsrsRating, type ReviewRating } from './rating'

export interface FsrsSchedulerOptions {
  targetRetention?: number | undefined
  enableFuzz?: boolean | undefined
}

export interface ScheduledReview {
  card: FsrsCardSnapshot
  reviewedAt: Date
  rating: ReviewRating
}

export function createInitialFsrsCard(now = new Date()) {
  return fromFsrsCard(createEmptyCard(now))
}

export function scheduleReview(
  card: FsrsCardSnapshot,
  rating: ReviewRating,
  reviewedAt = new Date(),
  options: FsrsSchedulerOptions = {},
): ScheduledReview {
  const scheduler = createScheduler(options)
  const result = scheduler.next(
    toFsrsCard(card),
    reviewedAt,
    toFsrsRating(rating),
  )

  return {
    card: fromFsrsCard(result.card),
    reviewedAt,
    rating,
  }
}

export function getRetrievability(
  card: FsrsCardSnapshot,
  at = new Date(),
  options: FsrsSchedulerOptions = {},
) {
  return createScheduler(options).get_retrievability(
    toFsrsCard(card),
    at,
    false,
  )
}

function createScheduler(options: FsrsSchedulerOptions) {
  return fsrs(
    generatorParameters({
      request_retention: options.targetRetention ?? 0.85,
      enable_fuzz: options.enableFuzz ?? false,
    }),
  )
}
