import { describe, expect, it } from 'vitest'

import {
  createYouTubeSearchUrl,
  selectOverlayHelpSearchQuery,
} from './help-search'

describe('selectOverlayHelpSearchQuery', () => {
  it('prefers a canonical metadata title over other candidates', () => {
    expect(
      selectOverlayHelpSearchQuery({
        metadataTitle: '  1. Two Sum  ',
        problemTitle: 'Two Sum',
        problemSlug: 'two-sum',
      }),
    ).toBe('1. Two Sum')
  })

  it('uses the stored title before falling back to the problem slug', () => {
    expect(
      selectOverlayHelpSearchQuery({
        metadataTitle: null,
        problemTitle: '  Valid Parentheses  ',
        problemSlug: 'valid-parentheses',
      }),
    ).toBe('Valid Parentheses')

    expect(
      selectOverlayHelpSearchQuery({
        metadataTitle: undefined,
        problemTitle: undefined,
        problemSlug: 'valid-parentheses',
      }),
    ).toBe('valid-parentheses')
  })

  it('skips blank candidates and returns null when all candidates are blank', () => {
    expect(
      selectOverlayHelpSearchQuery({
        metadataTitle: '  ',
        problemTitle: '\n\t',
        problemSlug: '  ',
      }),
    ).toBeNull()

    expect(
      selectOverlayHelpSearchQuery({
        metadataTitle: null,
        problemTitle: null,
        problemSlug: undefined,
      }),
    ).toBeNull()
  })
})

describe('createYouTubeSearchUrl', () => {
  it('encodes a trimmed numbered title with URLSearchParams', () => {
    expect(createYouTubeSearchUrl('  1. Two Sum  ')).toBe(
      'https://www.youtube.com/results?search_query=1.+Two+Sum',
    )
  })

  it('returns null for a blank search query', () => {
    expect(createYouTubeSearchUrl('  \n\t')).toBeNull()
  })
})
