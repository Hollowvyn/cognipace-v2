export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'
export type FsrsCardVariant = 'default'

export const defaultFsrsCardVariant: FsrsCardVariant = 'default'

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
