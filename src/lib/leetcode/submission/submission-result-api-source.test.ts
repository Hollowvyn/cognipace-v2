import { describe, expect, it, vi } from 'vitest'

import type { LeetCodeSubmissionPollingDebug } from '../domain/types'
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
    const debugEvents: LeetCodeSubmissionPollingDebug[] = []
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
        onDebug: (debug) => debugEvents.push(debug),
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
      compileError: null,
      runtimeError: null,
      lastTestcase: null,
      codeOutput: null,
      expectedOutput: null,
      stdOutput: null,
      resultCodeSnapshot: {
        code: 'class Solution:\n    def twoSum(self):\n        return []',
        language: 'Python3',
        source: 'api',
        capturedAt: 7000,
      },
    })
    expect(debugEvents).toEqual([
      {
        phase: 'finding-submission',
        submissionId: null,
        checkState: null,
        statusText: null,
        checkedAt: 7000,
      },
      {
        phase: 'submission-found',
        submissionId: '1234567890',
        checkState: null,
        statusText: 'Accepted',
        checkedAt: 7000,
      },
      {
        phase: 'checking-result',
        submissionId: '1234567890',
        checkState: 'SUCCESS',
        statusText: 'Accepted',
        checkedAt: 7000,
      },
      {
        phase: 'api-result-found',
        submissionId: '1234567890',
        checkState: 'SUCCESS',
        statusText: 'Accepted',
        checkedAt: 7000,
      },
      {
        phase: 'graphql-details-found',
        submissionId: '1234567890',
        checkState: 'SUCCESS',
        statusText: 'Accepted',
        checkedAt: 7000,
      },
    ])
  })

  it('returns null while LeetCode is still judging the submission', async () => {
    const debugEvents: LeetCodeSubmissionPollingDebug[] = []
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
        now: () => 7000,
        onDebug: (debug) => debugEvents.push(debug),
      }),
    ).resolves.toBeNull()
    expect(debugEvents.map((debug) => debug.phase)).toEqual([
      'finding-submission',
      'submission-found',
      'checking-result',
    ])
    expect(debugEvents.at(-1)).toMatchObject({
      submissionId: '1234567890',
      checkState: 'PENDING',
      statusText: 'Pending',
    })
  })

  it('ignores submissions outside the click matching window', async () => {
    const debugEvents: LeetCodeSubmissionPollingDebug[] = []
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
        now: () => 7000,
        onDebug: (debug) => debugEvents.push(debug),
      }),
    ).resolves.toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(debugEvents.map((debug) => debug.phase)).toEqual([
      'finding-submission',
      'submission-not-found',
    ])
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
                codeOutput: '[0,1]',
                expectedOutput: '[1,2]',
                stdOutput: 'debug line',
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
      lastTestcase: 'nums = [3,2,4], target = 6',
      codeOutput: '[0,1]',
      expectedOutput: '[1,2]',
      stdOutput: 'debug line',
      resultCodeSnapshot: {
        code: 'class Solution:\n    pass',
        source: 'api',
      },
    })
  })

  it('returns runtime error details as separate result fields', async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const requestUrl = readRequestUrl(input)

      if (requestUrl.includes('/api/submissions/two-sum/')) {
        return Promise.resolve(
          Response.json({
            submission_list: [
              {
                id: '1234567890',
                timestamp: 6,
                status_display: 'Runtime Error',
              },
            ],
          }),
        )
      }

      if (requestUrl.includes('/submissions/detail/1234567890/check/')) {
        return Promise.resolve(
          Response.json({
            state: 'SUCCESS',
            status_code: 15,
            status_msg: 'Runtime Error',
            runtime_error: 'IndexError: list index out of range',
            last_testcase: '[2,7,11,15]\n9',
            code_output: '',
            expected_output: '[0,1]',
            std_output: 'before crash',
            total_correct: 0,
            total_testcases: 63,
          }),
        )
      }

      if (requestUrl.endsWith('/graphql')) {
        return Promise.resolve(
          Response.json({
            data: {
              submissionDetails: {
                statusCode: 15,
                statusDisplay: 'Runtime Error',
                runtimeError: 'IndexError: list index out of range',
                lastTestcase: '[2,7,11,15]\n9',
                codeOutput: '',
                expectedOutput: '[0,1]',
                stdOutput: 'before crash',
                totalCorrect: 0,
                totalTestcases: 63,
                code: 'class Solution:\n    raise IndexError()',
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
      status: 'runtime-error',
      statusText: 'Runtime Error',
      errorMessage: 'IndexError: list index out of range',
      runtimeError: 'IndexError: list index out of range',
      compileError: null,
      lastTestcase: '[2,7,11,15]\n9',
      codeOutput: null,
      expectedOutput: '[0,1]',
      stdOutput: 'before crash',
    })
  })

  it('returns compile error details as separate result fields', async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const requestUrl = readRequestUrl(input)

      if (requestUrl.includes('/api/submissions/two-sum/')) {
        return Promise.resolve(
          Response.json({
            submission_list: [
              {
                id: '1234567890',
                timestamp: 6,
                status_display: 'Compile Error',
              },
            ],
          }),
        )
      }

      if (requestUrl.includes('/submissions/detail/1234567890/check/')) {
        return Promise.resolve(
          Response.json({
            state: 'SUCCESS',
            status_code: 20,
            status_msg: 'Compile Error',
            compile_error: "NameError: name 'List' is not defined",
            std_output: 'compile stdout',
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
      status: 'compile-error',
      statusText: 'Compile Error',
      errorMessage: "NameError: name 'List' is not defined",
      compileError: "NameError: name 'List' is not defined",
      runtimeError: null,
      stdOutput: 'compile stdout',
    })
  })

  it('reports missing GraphQL details while keeping check API result data', async () => {
    const debugEvents: LeetCodeSubmissionPollingDebug[] = []
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const requestUrl = readRequestUrl(input)

      if (requestUrl.includes('/api/submissions/two-sum/')) {
        return Promise.resolve(
          Response.json({
            submission_list: [
              {
                id: '1234567890',
                timestamp: 5,
                status_display: 'Accepted',
                runtime: '4 ms',
                memory: '20.62 MB',
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
            total_correct: 63,
            total_testcases: 63,
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
        onDebug: (debug) => debugEvents.push(debug),
      }),
    ).resolves.toMatchObject({
      source: 'api',
      status: 'accepted',
      statusText: 'Accepted',
      runtime: '4 ms',
      memory: '20.62 MB',
      resultCodeSnapshot: {
        code: submittedCodeSnapshot.code,
        source: 'monaco',
      },
    })
    expect(debugEvents.at(-1)).toEqual({
      phase: 'graphql-details-missing',
      submissionId: '1234567890',
      checkState: 'SUCCESS',
      statusText: 'Accepted',
      checkedAt: 8000,
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
