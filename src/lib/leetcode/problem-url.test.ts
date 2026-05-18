import { describe, expect, it } from 'vitest'

import {
  normalizeLeetCodeSlug,
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
})

describe('normalizeLeetCodeSlug', () => {
  it('normalizes user-provided slugs', () => {
    expect(normalizeLeetCodeSlug(' Two Sum!! ')).toBe('twosum')
  })
})
