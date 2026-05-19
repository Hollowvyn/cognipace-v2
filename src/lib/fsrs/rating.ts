import { Rating } from 'ts-fsrs'

export const reviewRatings = ['again', 'hard', 'good', 'easy'] as const

export type ReviewRating = (typeof reviewRatings)[number]

export function toFsrsRating(rating: ReviewRating) {
  switch (rating) {
    case 'again':
      return Rating.Again
    case 'hard':
      return Rating.Hard
    case 'good':
      return Rating.Good
    case 'easy':
      return Rating.Easy
  }
}

export function ratingToScore(rating: ReviewRating) {
  switch (rating) {
    case 'again':
      return 0
    case 'hard':
      return 1
    case 'good':
      return 2
    case 'easy':
      return 3
  }
}
