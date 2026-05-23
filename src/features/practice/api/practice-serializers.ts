import type {
  PracticeDetails,
  PracticeLogFields,
  PracticeReviewAttemptSnapshot,
  PracticeStateSnapshot,
  PracticeSummary,
  ReviewResult,
} from '../domain'
import {
  practiceDetailsSchema,
  practiceReviewResultSchema,
  type SerializedPracticeDetails,
  type SerializedReviewResult,
} from './practice-contracts'

export function serializePracticeDetails(
  details: PracticeDetails,
): SerializedPracticeDetails {
  return practiceDetailsSchema.parse({
    problemSlug: details.problemSlug,
    cardId: details.cardId,
    practice: details.practice
      ? serializePracticeState(details.practice)
      : null,
    card: details.card
      ? {
          ...details.card,
          dueAt: details.card.dueAt.toISOString(),
          lastReviewAt: details.card.lastReviewAt?.toISOString() ?? null,
        }
      : null,
    summary: serializePracticeSummary(details.summary),
    currentLog: serializePracticeLog(details.currentLog),
    recentAttempts: details.recentAttempts.map(serializePracticeAttempt),
    latestAttempt: details.latestAttempt
      ? serializePracticeAttempt(details.latestAttempt)
      : null,
    canOverrideLatestReview: details.canOverrideLatestReview,
  })
}

export function serializeReviewResult(
  result: ReviewResult,
): SerializedReviewResult {
  return practiceReviewResultSchema.parse({
    problemSlug: result.problemSlug,
    cardId: result.cardId,
    rating: result.rating,
    status: result.status,
    dueAt: result.dueAt.toISOString(),
    reviewedAt: result.reviewedAt.toISOString(),
    summary: serializePracticeSummary(result.summary),
  })
}

export function serializePracticeSummary(summary: PracticeSummary) {
  return {
    ...summary,
    nextReviewAt: summary.nextReviewAt?.toISOString() ?? null,
    lastReviewedAt: summary.lastReviewedAt?.toISOString() ?? null,
  }
}

function serializePracticeState(practice: PracticeStateSnapshot) {
  return {
    ...practice,
    lastReviewedAt: practice.lastReviewedAt?.toISOString() ?? null,
    log: serializePracticeLog(practice.log),
  }
}

function serializePracticeAttempt(attempt: PracticeReviewAttemptSnapshot) {
  return {
    ...attempt,
    reviewedAt: attempt.reviewedAt.toISOString(),
    log: serializePracticeLog(attempt.log),
    createdAt: attempt.createdAt.toISOString(),
    updatedAt: attempt.updatedAt.toISOString(),
  }
}

function serializePracticeLog(log: Required<PracticeLogFields>) {
  return {
    interviewPattern: log.interviewPattern ?? null,
    timeComplexity: log.timeComplexity ?? null,
    spaceComplexity: log.spaceComplexity ?? null,
    languages: log.languages ?? null,
    notes: log.notes ?? null,
  }
}
