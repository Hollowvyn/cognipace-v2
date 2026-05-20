import {
  defaultFsrsSchedulingOptions,
  getRetrievability,
  type FsrsCardKind,
  type FsrsCardSnapshot,
  type ReviewRating,
} from '@/lib/fsrs'

export const practiceStatuses = [
  'new',
  'learning',
  'review',
  'mastered',
  'suspended',
] as const

export const reviewModes = ['manual', 'leetcode'] as const

export type PracticeStatus = (typeof practiceStatuses)[number]
export type ReviewMode = (typeof reviewModes)[number]

export const practicePhases = [
  'new',
  'learning',
  'review',
  'relearning',
  'suspended',
] as const

export type PracticePhase = (typeof practicePhases)[number]

export interface PracticeLogFields {
  interviewPattern?: string | null | undefined
  timeComplexity?: string | null | undefined
  spaceComplexity?: string | null | undefined
  languages?: string | null | undefined
  notes?: string | null | undefined
}

export interface SaveReviewResultInput {
  problemId: string
  rating: ReviewRating
  reviewedAt?: Date | undefined
  reviewMode?: ReviewMode | undefined
  elapsedSeconds?: number | null | undefined
  isCorrect?: boolean | null | undefined
  log?: PracticeLogFields | undefined
  cardKind?: FsrsCardKind | undefined
  targetRetention?: number | undefined
  reviewAttemptId?: string | undefined
}

export interface OverrideLastReviewResultInput {
  problemId: string
  rating: ReviewRating
  reviewedAt?: Date | undefined
  elapsedSeconds?: number | null | undefined
  isCorrect?: boolean | null | undefined
  log?: PracticeLogFields | undefined
  cardKind?: FsrsCardKind | undefined
  targetRetention?: number | undefined
}

export interface ReviewResult {
  problemId: string
  cardId: string
  rating: ReviewRating
  status: PracticeStatus
  dueAt: Date
  reviewedAt: Date
  card: FsrsCardSnapshot
  summary: PracticeSummary
}

export interface PracticeStateSnapshot {
  status: PracticeStatus
  lastReviewedAt: Date | null
  attemptCount: number
  solvedCount: number
  isSuspended: boolean
  lastRating: ReviewRating | null
  lastElapsedSeconds: number | null
  bestElapsedSeconds: number | null
  log: Required<PracticeLogFields>
}

export interface PracticeSummary {
  phase: PracticePhase
  nextReviewAt: Date | null
  lastReviewedAt: Date | null
  reviewCount: number
  lapses: number
  difficulty: number | null
  stability: number | null
  scheduledDays: number | null
  suspended: boolean
  isStarted: boolean
  isDue: boolean
  isOverdue: boolean
  overdueDays: number
  retrievability: number | null
}

export function statusFromReview(
  rating: ReviewRating,
  card: FsrsCardSnapshot,
): PracticeStatus {
  if (rating === 'again') {
    return 'learning'
  }

  if (card.state === 'new' || card.state === 'learning') {
    return 'learning'
  }

  if (card.state === 'relearning') {
    return 'learning'
  }

  return 'review'
}

export function derivePracticeSummary(input: {
  practice: PracticeStateSnapshot | null
  card: FsrsCardSnapshot | null
  now?: Date | undefined
  targetRetention?: number | undefined
}): PracticeSummary {
  const now = input.now ?? new Date()
  const targetRetention =
    input.targetRetention ?? defaultFsrsSchedulingOptions.targetRetention
  const suspended =
    input.practice?.isSuspended === true ||
    input.practice?.status === 'suspended'
  const reviewCount = input.card?.reps ?? input.practice?.attemptCount ?? 0
  const lastReviewedAt =
    input.card?.lastReviewAt ?? input.practice?.lastReviewedAt ?? null
  const isStarted =
    reviewCount > 0 ||
    Boolean(lastReviewedAt) ||
    (input.practice?.attemptCount ?? 0) > 0
  const retrievability =
    input.card && input.card.lastReviewAt
      ? getRetrievability(input.card, now, { targetRetention })
      : null
  const isDue =
    !suspended &&
    isStarted &&
    retrievability !== null &&
    retrievability < targetRetention
  const overdueDays =
    isDue && input.card
      ? Math.max(
          0,
          Math.floor((now.getTime() - input.card.dueAt.getTime()) / dayMs),
        )
      : 0

  return {
    phase: suspended
      ? 'suspended'
      : phaseFromPracticeAndCard(input.practice, input.card),
    nextReviewAt: input.card?.dueAt ?? null,
    lastReviewedAt,
    reviewCount,
    lapses: input.card?.lapses ?? 0,
    difficulty: input.card?.difficulty ?? null,
    stability: input.card?.stability ?? null,
    scheduledDays: input.card?.scheduledDays ?? null,
    suspended,
    isStarted,
    isDue,
    isOverdue: overdueDays > 0,
    overdueDays,
    retrievability,
  }
}

export function normalizeReviewLogFields(
  log?: PracticeLogFields | null,
): Required<PracticeLogFields> {
  return {
    interviewPattern: normalizeOptionalLogValue(log?.interviewPattern),
    timeComplexity: normalizeOptionalLogValue(log?.timeComplexity),
    spaceComplexity: normalizeOptionalLogValue(log?.spaceComplexity),
    languages: normalizeOptionalLogValue(log?.languages),
    notes: normalizeOptionalLogValue(log?.notes),
  }
}

function phaseFromPracticeAndCard(
  practice: PracticeStateSnapshot | null,
  card: FsrsCardSnapshot | null,
): PracticePhase {
  if (card) {
    return card.state
  }

  switch (practice?.status) {
    case 'learning':
      return 'learning'
    case 'review':
    case 'mastered':
      return 'review'
    case 'new':
    case 'suspended':
    case undefined:
      return 'new'
  }
}

function normalizeOptionalLogValue(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

const dayMs = 24 * 60 * 60 * 1000
