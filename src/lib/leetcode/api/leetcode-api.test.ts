import { describe, expect, it, vi } from 'vitest'

import { createHttpClient } from '@/platform/http'

import { requestLeetCodeGraphQl } from './leetcode-graphql-client'
import { requestSubmissionCheck } from './submission-requests'

describe('LeetCode API requests', () => {
  it('sends GraphQL requests through platform http with csrf and credentials', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ data: { question: { title: 'Two Sum' } } }),
        {
          status: 200,
        },
      ),
    )

    await requestLeetCodeGraphQl({
      httpClient: createHttpClient({ fetch: fetchMock }),
      locationUrl: 'https://leetcode.com/problems/two-sum/',
      query: 'query q { question { title } }',
      variables: {},
      csrfToken: 'csrf_1',
    })

    const requestInit = fetchMock.mock.calls[0]?.[1]
    const headers = requestInit?.headers

    expect(fetchMock).toHaveBeenCalledWith(
      'https://leetcode.com/graphql',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    )
    expect(headers).toBeInstanceOf(Headers)
    expect(headers instanceof Headers ? headers.get('x-csrftoken') : null).toBe(
      'csrf_1',
    )
  })

  it('sends submission check requests through platform http', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ state: 'SUCCESS', status_code: 10 }), {
        status: 200,
      }),
    )

    await requestSubmissionCheck({
      httpClient: createHttpClient({ fetch: fetchMock }),
      locationUrl: 'https://leetcode.com/problems/two-sum/',
      submissionId: '123',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://leetcode.com/submissions/detail/123/check/',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    )
  })
})
