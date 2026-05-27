import type { HttpClient } from '@/platform/http'

import { requestLeetCodeGraphQl } from './leetcode-graphql-client'

const leetCodeQuestionContentQuery = `
  query questionContent($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      content
      hints
    }
  }
`

export function requestLeetCodeProblemContent(input: {
  locationUrl: string
  slug: string
  fetch?: typeof fetch | undefined
  document?: Document | undefined
  csrfToken?: string | null | undefined
  httpClient?: HttpClient | undefined
}) {
  return requestLeetCodeGraphQl({
    locationUrl: input.locationUrl,
    query: leetCodeQuestionContentQuery,
    variables: { titleSlug: input.slug },
    operationName: 'questionContent',
    fetch: input.fetch,
    document: input.document,
    csrfToken: input.csrfToken,
    httpClient: input.httpClient,
  })
}
