import type { FsrsCardKind, FsrsCardSnapshot, ReviewRating } from '@/lib/fsrs'

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

export interface SaveReviewResultInput {
  problemId: string
  rating: ReviewRating
  reviewedAt?: Date | undefined
  reviewMode?: ReviewMode | undefined
  elapsedSeconds?: number | null | undefined
  isCorrect?: boolean | null | undefined
  notes?: string | null | undefined
  cardKind?: FsrsCardKind | undefined
  targetRetention?: number | undefined
  reviewAttemptId?: string | undefined
}

export interface ReviewResult {
  problemId: string
  cardId: string
  rating: ReviewRating
  status: PracticeStatus
  dueAt: Date
  reviewedAt: Date
  card: FsrsCardSnapshot
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

  return 'review'
}
