import type { HttpClient } from '@/platform/http'

import { requestLeetCodeGraphQl } from './leetcode-graphql-client'

const leetCodeQuestionMetadataQuery = `
  query questionTitle($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      title
      titleSlug
      questionFrontendId
      difficulty
      isPaidOnly
      topicTags {
        name
        slug
      }
    }
  }
`

export function requestLeetCodeProblemMetadata(input: {
  locationUrl: string
  slug: string
  fetch?: typeof fetch | undefined
  document?: Document | undefined
  csrfToken?: string | null | undefined
  httpClient?: HttpClient | undefined
}) {
  return requestLeetCodeGraphQl({
    locationUrl: input.locationUrl,
    query: leetCodeQuestionMetadataQuery,
    variables: { titleSlug: input.slug },
    operationName: 'questionTitle',
    fetch: input.fetch,
    document: input.document,
    csrfToken: input.csrfToken,
    httpClient: input.httpClient,
  })
}
