import { describe, expect, it, vi } from 'vitest'

import type { LeetCodeSubmissionPollingDebug } from '../domain/types'
import {
  leetcodeAcceptedSubmissionApiFixture,
  leetcodeCompileErrorSubmissionApiFixture,
  leetcodeGraphQlMissingSubmissionApiFixture,
  leetcodePendingSubmissionApiFixture,
  leetcodeRuntimeErrorSubmissionApiFixture,
  type LeetCodeSubmissionApiFixture,
  leetcodeWrongAnswerSubmissionApiFixture,
} from '../testing/submission-result-fixtures'
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
    const fetcher = createSubmissionApiFixtureFetcher(
      leetcodeAcceptedSubmissionApiFixture,
    )

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
    const requestUrls = fetcher.mock.calls.map(([input]) =>
      readRequestUrl(input),
    )

    expect(requestUrls[0]).toContain('/api/submissions/two-sum/')
    expect(requestUrls[1]).toContain('/submissions/detail/1234567890/check/')
    expect(requestUrls[2]).toBe('https://leetcode.com/graphql')
  })

  it('returns null while LeetCode is still judging the submission', async () => {
    const debugEvents: LeetCodeSubmissionPollingDebug[] = []
    const fetcher = createSubmissionApiFixtureFetcher(
      leetcodePendingSubmissionApiFixture,
    )

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
    const fetcher = createSubmissionApiFixtureFetcher(
      leetcodeAcceptedSubmissionApiFixture,
    )

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
    const fetcher = createSubmissionApiFixtureFetcher(
      leetcodeWrongAnswerSubmissionApiFixture,
    )

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
    const fetcher = createSubmissionApiFixtureFetcher(
      leetcodeRuntimeErrorSubmissionApiFixture,
    )

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
    const fetcher = createSubmissionApiFixtureFetcher(
      leetcodeCompileErrorSubmissionApiFixture,
    )

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
    const fetcher = createSubmissionApiFixtureFetcher(
      leetcodeGraphQlMissingSubmissionApiFixture,
    )

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

function createSubmissionApiFixtureFetcher(
  fixture: LeetCodeSubmissionApiFixture,
) {
  return vi.fn((input: RequestInfo | URL) => {
    const requestUrl = readRequestUrl(input)

    if (requestUrl.includes('/api/submissions/two-sum/')) {
      return Promise.resolve(Response.json(fixture.submissionListPayload))
    }

    if (requestUrl.includes('/submissions/detail/1234567890/check/')) {
      return Promise.resolve(Response.json(fixture.checkPayload))
    }

    if (requestUrl.endsWith('/graphql') && fixture.graphQlPayload) {
      return Promise.resolve(Response.json(fixture.graphQlPayload))
    }

    return Promise.resolve(new Response('', { status: 500 }))
  })
}

function readRequestUrl(input: RequestInfo | URL) {
  if (input instanceof URL) {
    return input.toString()
  }

  if (typeof input === 'string') {
    return input
  }

  return input.url
}
