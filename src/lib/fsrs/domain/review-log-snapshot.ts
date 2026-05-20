import { isFsrsCardState, type FsrsCardState } from './card-snapshot'
import { isReviewRating, type ReviewRating } from './review-rating'

/** Serializable ts-fsrs review log snapshot stored for future rollback. */
export interface FsrsReviewLogSnapshot {
  rating: ReviewRating
  state: FsrsCardState
  dueAt: string
  stability: number
  difficulty: number
  /** @deprecated Upstream ts-fsrs removes elapsed_days in v6. */
  elapsedDays: number
  /** @deprecated Upstream ts-fsrs removes last_elapsed_days in v6. */
  lastElapsedDays: number
  scheduledDays: number
  learningSteps: number
  reviewedAt: string
}

/** Checks whether a parsed JSON value is a valid stored FSRS review log. */
export function isFsrsReviewLogSnapshot(
  value: unknown,
): value is FsrsReviewLogSnapshot {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.rating === 'string' &&
    isReviewRating(value.rating) &&
    typeof value.state === 'string' &&
    isFsrsCardState(value.state) &&
    isIsoDateString(value.dueAt) &&
    Number.isFinite(value.stability) &&
    Number.isFinite(value.difficulty) &&
    Number.isFinite(value.elapsedDays) &&
    Number.isFinite(value.lastElapsedDays) &&
    Number.isFinite(value.scheduledDays) &&
    Number.isFinite(value.learningSteps) &&
    isIsoDateString(value.reviewedAt)
  )
}

/** Parses a persisted FSRS review log snapshot at storage boundaries. */
export function parseFsrsReviewLogSnapshot(
  value: unknown,
): FsrsReviewLogSnapshot {
  if (isFsrsReviewLogSnapshot(value)) {
    return value
  }

  throw new Error('Invalid FSRS review log snapshot.')
}

/** Serializes an FSRS review log snapshot for persistence. */
export function serializeFsrsReviewLogSnapshot(
  log: FsrsReviewLogSnapshot,
): string {
  return JSON.stringify(log)
}

/** Parses a serialized FSRS review log snapshot from persistence. */
export function parseSerializedFsrsReviewLogSnapshot(
  value: string,
): FsrsReviewLogSnapshot {
  return parseFsrsReviewLogSnapshot(JSON.parse(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isIsoDateString(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const parsed = new Date(value)

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value
}
