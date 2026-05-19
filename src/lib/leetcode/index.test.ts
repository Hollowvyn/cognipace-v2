import { describe, expect, it } from 'vitest'

import * as leetcode from './index'

describe('LeetCode public API facade', () => {
  it('exports the stable feature-facing runtime facade', () => {
    expect(Object.keys(leetcode).sort()).toEqual(
      [
        'createEmptyLeetCodeCaptureState',
        'createLeetCodeFetchRemoteClient',
        'createLeetCodePageWatcher',
        'createLeetCodeProblemMetadataFingerprint',
        'createLeetCodeProblemUrl',
        'createLeetCodeReviewContext',
        'isLeetCodeHost',
        'isLeetCodeProblemUrl',
        'normalizeLeetCodeLanguageLabel',
        'normalizeLeetCodeSlug',
        'parseLeetCodeProblemInput',
        'parseLeetCodeProblemLocation',
        'readLeetCodeLanguageLabelFromText',
        'readLeetCodeRemoteAuthFromDocument',
        'reduceLeetCodeCaptureState',
        'titleFromLeetCodeSlug',
      ].sort(),
    )
  })

  it('does not export raw LeetCode readers from the public barrel', () => {
    expect('readLeetCodeProblemContent' in leetcode).toBe(false)
    expect('fetchLeetCodeProblemMetadata' in leetcode).toBe(false)
    expect('readLeetCodeSubmissionResult' in leetcode).toBe(false)
    expect('readLeetCodeSubmissionResultFromApi' in leetcode).toBe(false)
    expect('readLeetCodeSubmissionAttempt' in leetcode).toBe(false)
  })
})
