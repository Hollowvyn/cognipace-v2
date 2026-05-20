/** Supported recall ratings exposed by the public practice facade. */
export const reviewRatings = ['again', 'hard', 'good', 'easy'] as const

/** User-facing recall rating accepted by CogniPace practice flows. */
export type ReviewRating = (typeof reviewRatings)[number]

const reviewRatingScores = {
  again: 0,
  hard: 1,
  good: 2,
  easy: 3,
} as const satisfies Record<ReviewRating, number>

/** Checks whether a persisted string is a supported review rating. */
export function isReviewRating(value: string): value is ReviewRating {
  return reviewRatings.includes(value as ReviewRating)
}

/** Parses a persisted review rating at storage and API boundaries. */
export function parseReviewRating(value: string): ReviewRating {
  if (isReviewRating(value)) {
    return value
  }

  throw new Error(`Invalid review rating "${value}".`)
}

/** Converts review ratings to stable ordering scores for queue ranking. */
export function reviewRatingToScore(rating: ReviewRating): number {
  return reviewRatingScores[rating]
}
