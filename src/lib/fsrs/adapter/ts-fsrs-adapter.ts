import {
  createEmptyCard,
  fsrs,
  Rating,
  State,
  type Card,
  type CardInput,
  type Grade,
  type ReviewLog,
} from 'ts-fsrs'

import type { FsrsCardSnapshot, FsrsCardState } from '../domain/card-snapshot'
import {
  normalizeFsrsSchedulingOptions,
  type FsrsSchedulingOptions,
} from '../domain/scheduling-options'
import type { FsrsReviewLogSnapshot } from '../domain/review-log-snapshot'
import type { ReviewRating } from '../domain/review-rating'

interface TsFsrsScheduledReview {
  card: FsrsCardSnapshot
  log: FsrsReviewLogSnapshot
}

export function createEmptyCardSnapshot(now: Date): FsrsCardSnapshot {
  return fromTsFsrsCard(createEmptyCard(now))
}

export function scheduleCardReview(
  card: FsrsCardSnapshot,
  rating: ReviewRating,
  reviewedAt: Date,
  options: FsrsSchedulingOptions,
): TsFsrsScheduledReview {
  const scheduler = createScheduler(options)
  const result = scheduler.next(
    toTsFsrsCard(card),
    reviewedAt,
    toTsFsrsRating(rating),
  )

  return {
    card: fromTsFsrsCard(result.card),
    log: fromTsFsrsReviewLog(result.log),
  }
}

export function calculateCardRetrievability(
  card: FsrsCardSnapshot,
  at: Date,
  options: FsrsSchedulingOptions,
): number {
  return createScheduler(options).get_retrievability(
    toTsFsrsCard(card),
    at,
    false,
  )
}

function createScheduler(options: FsrsSchedulingOptions) {
  const normalized = normalizeFsrsSchedulingOptions(options)

  return fsrs({
    request_retention: normalized.targetRetention,
    enable_fuzz: normalized.enableFuzz,
    enable_short_term: normalized.enableShortTerm,
    learning_steps: normalized.learningSteps,
    relearning_steps: normalized.relearningSteps,
  })
}

function toTsFsrsCard(snapshot: FsrsCardSnapshot): CardInput {
  validateCardSnapshot(snapshot)

  const card: CardInput = {
    due: snapshot.dueAt,
    stability: snapshot.stability,
    difficulty: snapshot.difficulty,
    elapsed_days: snapshot.elapsedDays,
    scheduled_days: snapshot.scheduledDays,
    learning_steps: snapshot.learningSteps,
    reps: snapshot.reps,
    lapses: snapshot.lapses,
    state: toTsFsrsState(snapshot.state),
  }

  if (snapshot.lastReviewAt) {
    card.last_review = snapshot.lastReviewAt
  }

  return card
}

function validateCardSnapshot(snapshot: FsrsCardSnapshot): void {
  assertValidDate(snapshot.dueAt, 'dueAt')
  assertFiniteNonNegativeNumber(snapshot.stability, 'stability')
  assertFiniteNonNegativeNumber(snapshot.difficulty, 'difficulty')
  assertNonNegativeInteger(snapshot.elapsedDays, 'elapsedDays')
  assertNonNegativeInteger(snapshot.scheduledDays, 'scheduledDays')
  assertNonNegativeInteger(snapshot.learningSteps, 'learningSteps')
  assertNonNegativeInteger(snapshot.reps, 'reps')
  assertNonNegativeInteger(snapshot.lapses, 'lapses')

  if (snapshot.lastReviewAt !== null) {
    assertValidDate(snapshot.lastReviewAt, 'lastReviewAt')
  }

  if (snapshot.state !== 'new' && !snapshot.lastReviewAt) {
    throw new Error(
      `Invalid FSRS card snapshot: "${snapshot.state}" cards require lastReviewAt.`,
    )
  }
}

function assertValidDate(value: Date, fieldName: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(
      `Invalid FSRS card snapshot: "${fieldName}" must be a valid Date.`,
    )
  }
}

function assertFiniteNonNegativeNumber(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `Invalid FSRS card snapshot: "${fieldName}" must be a finite non-negative number.`,
    )
  }
}

function assertNonNegativeInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `Invalid FSRS card snapshot: "${fieldName}" must be a non-negative integer.`,
    )
  }
}

function fromTsFsrsCard(card: Card): FsrsCardSnapshot {
  return {
    dueAt: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: fromTsFsrsState(card.state),
    lastReviewAt: card.last_review ?? null,
  }
}

function fromTsFsrsReviewLog(log: ReviewLog): FsrsReviewLogSnapshot {
  return {
    rating: fromTsFsrsRating(log.rating),
    state: fromTsFsrsState(log.state),
    dueAt: log.due.toISOString(),
    stability: log.stability,
    difficulty: log.difficulty,
    elapsedDays: log.elapsed_days,
    lastElapsedDays: log.last_elapsed_days,
    scheduledDays: log.scheduled_days,
    learningSteps: log.learning_steps,
    reviewedAt: log.review.toISOString(),
  }
}

function toTsFsrsRating(rating: ReviewRating): Grade {
  return tsFsrsRatingByReviewRating[rating]
}

function fromTsFsrsRating(rating: Rating): ReviewRating {
  if (rating === Rating.Manual) {
    throw new Error('Manual ratings are not supported for review logs.')
  }

  return reviewRatingByTsFsrsRating[rating]
}

function toTsFsrsState(state: FsrsCardState): State {
  return tsFsrsStateByCardState[state]
}

function fromTsFsrsState(state: State): FsrsCardState {
  return cardStateByTsFsrsState[state]
}

const tsFsrsRatingByReviewRating = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
} as const satisfies Record<ReviewRating, Grade>

const reviewRatingByTsFsrsRating = {
  [Rating.Again]: 'again',
  [Rating.Hard]: 'hard',
  [Rating.Good]: 'good',
  [Rating.Easy]: 'easy',
} as const satisfies Record<Grade, ReviewRating>

const tsFsrsStateByCardState = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
} as const satisfies Record<FsrsCardState, State>

const cardStateByTsFsrsState = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
} as const satisfies Record<State, FsrsCardState>
