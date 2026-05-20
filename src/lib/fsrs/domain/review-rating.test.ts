import { describe, expect, it } from 'vitest'

import {
  isReviewRating,
  parseReviewRating,
  reviewRatingToScore,
  reviewRatings,
} from './review-rating'

describe('FSRS review rating contracts', () => {
  it('keeps the public rating order stable', () => {
    expect(reviewRatings).toEqual(['again', 'hard', 'good', 'easy'])
  })

  it('parses persisted ratings through a typed boundary', () => {
    expect(parseReviewRating('again')).toBe('again')
    expect(parseReviewRating('hard')).toBe('hard')
    expect(parseReviewRating('good')).toBe('good')
    expect(parseReviewRating('easy')).toBe('easy')
    expect(() => parseReviewRating('invalid')).toThrow(
      'Invalid review rating "invalid".',
    )
  })

  it('maps ratings to stable score values', () => {
    expect(isReviewRating('good')).toBe(true)
    expect(isReviewRating('Good')).toBe(false)
    expect(reviewRatings.map(reviewRatingToScore)).toEqual([0, 1, 2, 3])
  })
})
