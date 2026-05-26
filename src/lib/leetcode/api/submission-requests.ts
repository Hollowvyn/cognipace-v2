import {
  createHttpClient,
  createRestRequest,
  type HttpClient,
} from '@/platform/http'

export function requestSubmissionList(input: {
  httpClient?: HttpClient | undefined
  fetch?: typeof fetch | undefined
  locationUrl: string
  slug: string
}) {
  return createRestRequest<unknown>({
    baseUrl: input.locationUrl,
    path: `/api/submissions/${input.slug}/`,
    method: 'GET',
    credentials: 'include',
    searchParams: {
      offset: '0',
      limit: '5',
    },
  })(input.httpClient ?? createHttpClient({ fetch: input.fetch }))
}

export function requestSubmissionCheck(input: {
  httpClient?: HttpClient | undefined
  fetch?: typeof fetch | undefined
  locationUrl: string
  submissionId: string
}) {
  return createRestRequest<unknown>({
    baseUrl: input.locationUrl,
    path: `/submissions/detail/${encodeURIComponent(
      input.submissionId,
    )}/check/`,
    method: 'GET',
    credentials: 'include',
  })(input.httpClient ?? createHttpClient({ fetch: input.fetch }))
}
