import { describe, expect, it } from 'vitest'

import {
  createLeetCodeProblemUrl,
  isLeetCodeProblemUrl,
  normalizeLeetCodeSlug,
  parseLeetCodeProblemInput,
  parseLeetCodeProblemLocation,
} from './problem-url'

describe('parseLeetCodeProblemLocation', () => {
  it('returns a normalized problem location for LeetCode problem URLs', () => {
    expect(
      parseLeetCodeProblemLocation(
        'https://leetcode.com/problems/two-sum/description/',
      ),
    ).toEqual({
      slug: 'two-sum',
      url: 'https://leetcode.com/problems/two-sum/',
      host: 'leetcode.com',
    })
  })

  it('returns null for non-problem pages', () => {
    expect(
      parseLeetCodeProblemLocation('https://leetcode.com/explore/'),
    ).toBeNull()
  })

  it('returns null for non-LeetCode hosts', () => {
    expect(
      parseLeetCodeProblemLocation('https://example.com/problems/two-sum/'),
    ).toBeNull()
  })

  it('returns null for malformed urls instead of throwing', () => {
    expect(parseLeetCodeProblemLocation('not a url')).toBeNull()
  })
})

describe('normalizeLeetCodeSlug', () => {
  it('normalizes user-provided slugs', () => {
    expect(normalizeLeetCodeSlug(' Two Sum!! ')).toBe('two-sum')
    expect(normalizeLeetCodeSlug('Problems/merge-intervals/')).toBe(
      'merge-intervals',
    )
    expect(
      normalizeLeetCodeSlug(
        'https://leetcode.com/problems/two-sum/?envType=study-plan-v2',
      ),
    ).toBe('two-sum')
  })
})

describe('parseLeetCodeProblemInput', () => {
  it('accepts either a URL or bare slug', () => {
    expect(parseLeetCodeProblemInput('valid-parentheses')).toEqual({
      slug: 'valid-parentheses',
      url: 'https://leetcode.com/problems/valid-parentheses/',
      host: 'leetcode.com',
    })
  })
})

describe('createLeetCodeProblemUrl', () => {
  it('creates canonical LeetCode problem URLs', () => {
    expect(createLeetCodeProblemUrl(' Two Sum ')).toBe(
      'https://leetcode.com/problems/two-sum/',
    )
  })
})

describe('isLeetCodeProblemUrl', () => {
  it('checks for valid LeetCode problem URLs', () => {
    expect(isLeetCodeProblemUrl('https://leetcode.com/problems/two-sum/')).toBe(
      true,
    )
    expect(isLeetCodeProblemUrl('https://leetcode.com/explore/')).toBe(false)
  })
})
