import { describe, expect, it, vi } from 'vitest'

import { readLeetCodeSubmissionResultFromApi } from './submission-result-api-source'

const location = {
  slug: 'two-sum',
  url: 'https://leetcode.com/problems/two-sum/',
  host: 'leetcode.com',
}

const click = {
  location,
  clickedAt: 5000,
  buttonText: 'Submit',
}

const submittedCodeSnapshot = {
  code: 'class Solution:\n    pass',
  language: 'Python3',
  source: 'monaco',
  capturedAt: 5000,
} as const

describe('readLeetCodeSubmissionResultFromApi', () => {
  it('polls LeetCode submission APIs and returns accepted result details', async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const requestUrl = readRequestUrl(input)

      if (requestUrl.includes('/api/submissions/two-sum/')) {
        return Promise.resolve(
          Response.json({
            submission_list: [
              {
                id: 1234567890,
                timestamp: 4,
                status_display: 'Accepted',
                runtime: '4 ms',
                memory: '20.62 MB',
                lang_name: 'Python3',
              },
            ],
          }),
        )
      }

      if (requestUrl.includes('/submissions/detail/1234567890/check/')) {
        return Promise.resolve(
          Response.json({
            state: 'SUCCESS',
            status_code: 10,
            status_msg: 'Accepted',
            status_runtime: '4 ms',
            status_memory: '20.62 MB',
            total_correct: 63,
            total_testcases: 63,
            pretty_lang: 'Python3',
          }),
        )
      }

      if (requestUrl.endsWith('/graphql')) {
        return Promise.resolve(
          Response.json({
            data: {
              submissionDetails: {
                statusCode: 10,
                statusDisplay: 'Accepted',
                runtimeDisplay: '4 ms',
                memoryDisplay: '20.62 MB',
                totalCorrect: 63,
                totalTestcases: 63,
                code: 'class Solution:\n    def twoSum(self):\n        return []',
                lang: { verboseName: 'Python3' },
              },
            },
          }),
        )
      }

      return Promise.resolve(new Response('', { status: 500 }))
    })

    await expect(
      readLeetCodeSubmissionResultFromApi({
        location,
        click,
        submittedCodeSnapshot,
        fetch: fetcher,
        now: () => 7000,
      }),
    ).resolves.toEqual({
      location,
      submissionId: '1234567890',
      source: 'api',
      status: 'accepted',
      statusText: 'Accepted',
      checkedAt: 7000,
      runtime: '4 ms',
      memory: '20.62 MB',
      passedTestCount: 63,
      totalTestCount: 63,
      failingTestcase: null,
      errorMessage: null,
      resultCodeSnapshot: {
        code: 'class Solution:\n    def twoSum(self):\n        return []',
        language: 'Python3',
        source: 'api',
        capturedAt: 7000,
      },
    })
  })

  it('returns null while LeetCode is still judging the submission', async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const requestUrl = readRequestUrl(input)

      if (requestUrl.includes('/api/submissions/two-sum/')) {
        return Promise.resolve(
          Response.json({
            submission_list: [{ id: '1234567890', timestamp: 6 }],
          }),
        )
      }

      if (requestUrl.includes('/submissions/detail/1234567890/check/')) {
        return Promise.resolve(
          Response.json({
            state: 'PENDING',
            status_msg: 'Pending',
          }),
        )
      }

      return Promise.resolve(new Response('', { status: 500 }))
    })

    await expect(
      readLeetCodeSubmissionResultFromApi({
        location,
        click,
        submittedCodeSnapshot,
        fetch: fetcher,
      }),
    ).resolves.toBeNull()
  })

  it('ignores submissions outside the click matching window', async () => {
    const laterClick = {
      ...click,
      clickedAt: 100000,
    }
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const requestUrl = readRequestUrl(input)

      if (requestUrl.includes('/api/submissions/two-sum/')) {
        return Promise.resolve(
          Response.json({
            submission_list: [
              {
                id: '1234567890',
                timestamp: 94,
                status_display: 'Accepted',
              },
            ],
          }),
        )
      }

      return Promise.resolve(new Response('', { status: 500 }))
    })

    await expect(
      readLeetCodeSubmissionResultFromApi({
        location,
        click: laterClick,
        submittedCodeSnapshot,
        fetch: fetcher,
      }),
    ).resolves.toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('returns failed result details without using accepted-only assumptions', async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const requestUrl = readRequestUrl(input)

      if (requestUrl.includes('/api/submissions/two-sum/')) {
        return Promise.resolve(
          Response.json({
            submission_list: [
              {
                id: '1234567890',
                timestamp: 6,
                status_display: 'Wrong Answer',
              },
            ],
          }),
        )
      }

      if (requestUrl.includes('/submissions/detail/1234567890/check/')) {
        return Promise.resolve(
          Response.json({
            state: 'SUCCESS',
            status_code: 11,
            status_msg: 'Wrong Answer',
            total_correct: 57,
            total_testcases: 63,
            last_testcase: 'nums = [3,2,4], target = 6',
          }),
        )
      }

      if (requestUrl.endsWith('/graphql')) {
        return Promise.resolve(
          Response.json({
            data: {
              submissionDetails: {
                statusCode: 11,
                statusDisplay: 'Wrong Answer',
                totalCorrect: 57,
                totalTestcases: 63,
                lastTestcase: 'nums = [3,2,4], target = 6',
                code: 'class Solution:\n    pass',
                lang: { verboseName: 'Python3' },
              },
            },
          }),
        )
      }

      return Promise.resolve(new Response('', { status: 500 }))
    })

    await expect(
      readLeetCodeSubmissionResultFromApi({
        location,
        click,
        submittedCodeSnapshot,
        fetch: fetcher,
        now: () => 8000,
      }),
    ).resolves.toMatchObject({
      source: 'api',
      status: 'wrong-answer',
      statusText: 'Wrong Answer',
      passedTestCount: 57,
      totalTestCount: 63,
      failingTestcase: 'nums = [3,2,4], target = 6',
      resultCodeSnapshot: {
        code: 'class Solution:\n    pass',
        source: 'api',
      },
    })
  })
})

function readRequestUrl(input: RequestInfo | URL) {
  if (input instanceof URL) {
    return input.toString()
  }

  if (typeof input === 'string') {
    return input
  }

  return input.url
}
