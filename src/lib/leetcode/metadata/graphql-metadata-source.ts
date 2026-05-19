import { parseLeetCodeDifficulty } from '../domain/difficulty'
import type {
  LeetCodeMetadataResult,
  LeetCodeProblemLocation,
  LeetCodeProblemMetadata,
  LeetCodeTopic,
} from '../domain/types'

type LeetCodeGraphQlFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

type ParsedLeetCodeGraphQlQuestion = {
  title: string | null
  questionFrontendId: string | null
  difficulty: string | null
  isPaidOnly: boolean | null
  topicTags: LeetCodeTopic[]
}

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

export async function fetchLeetCodeProblemMetadata(
  location: LeetCodeProblemLocation,
  options: {
    fetch?: LeetCodeGraphQlFetch | undefined
    document?: Document | undefined
    now?: (() => number) | undefined
  } = {},
): Promise<LeetCodeMetadataResult> {
  const fetchLeetCodeGraphQl =
    options.fetch ?? globalThis.fetch?.bind(globalThis)

  if (!fetchLeetCodeGraphQl) {
    return { ok: false, error: new Error('Fetch is not available.') }
  }

  try {
    const graphQlHeaders = createLeetCodeGraphQlHeaders(options.document)
    const graphQlResponse = await fetchLeetCodeGraphQl(
      new URL('/graphql', location.url),
      {
        method: 'POST',
        headers: graphQlHeaders,
        body: JSON.stringify({
          query: leetCodeQuestionMetadataQuery,
          variables: { titleSlug: location.slug },
        }),
      },
    )

    if (!graphQlResponse.ok) {
      return {
        ok: false,
        error: new Error(
          `LeetCode GraphQL request failed: ${graphQlResponse.status}`,
        ),
      }
    }

    const graphQlPayload: unknown = await graphQlResponse.json()
    const parsedQuestionMetadata =
      readLeetCodeQuestionFromGraphQlPayload(graphQlPayload)

    if (!parsedQuestionMetadata) {
      return {
        ok: false,
        error: new Error('LeetCode GraphQL response did not include question.'),
      }
    }

    return {
      ok: true,
      metadata: {
        location,
        title: parsedQuestionMetadata.title || location.slug,
        frontendId: parsedQuestionMetadata.questionFrontendId,
        difficulty: parseLeetCodeDifficulty(parsedQuestionMetadata.difficulty),
        isPremium: parsedQuestionMetadata.isPaidOnly,
        topics: parsedQuestionMetadata.topicTags,
        source: 'graphql',
        confidence: 'high',
        capturedAt: options.now?.() ?? Date.now(),
      } satisfies LeetCodeProblemMetadata,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

function createLeetCodeGraphQlHeaders(documentRef: Document | undefined) {
  const graphQlHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const csrfToken = documentRef
    ? readCookieValue(documentRef.cookie, 'csrftoken')
    : null

  if (csrfToken) {
    graphQlHeaders['x-csrftoken'] = csrfToken
  }

  return graphQlHeaders
}

function readCookieValue(cookieHeader: string, cookieName: string) {
  return (
    cookieHeader
      .split(';')
      .map((cookiePart) => cookiePart.trim())
      .find((cookiePart) => cookiePart.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1) ?? null
  )
}

function readLeetCodeQuestionFromGraphQlPayload(
  graphQlPayload: unknown,
): ParsedLeetCodeGraphQlQuestion | null {
  if (!isObjectRecord(graphQlPayload) || !isObjectRecord(graphQlPayload.data)) {
    return null
  }

  const questionRecord = graphQlPayload.data.question

  if (!isObjectRecord(questionRecord)) {
    return null
  }

  return {
    title: readTrimmedString(questionRecord.title),
    questionFrontendId: readTrimmedString(questionRecord.questionFrontendId),
    difficulty: readTrimmedString(questionRecord.difficulty),
    isPaidOnly:
      typeof questionRecord.isPaidOnly === 'boolean'
        ? questionRecord.isPaidOnly
        : null,
    topicTags: readLeetCodeTopicTagsFromGraphQlValue(questionRecord.topicTags),
  }
}

function readLeetCodeTopicTagsFromGraphQlValue(
  topicTagsValue: unknown,
): LeetCodeTopic[] {
  if (!Array.isArray(topicTagsValue)) {
    return []
  }

  return topicTagsValue
    .map((topicTagRecord) => {
      if (!isObjectRecord(topicTagRecord)) {
        return null
      }

      const topicName = readTrimmedString(topicTagRecord.name)

      if (!topicName) {
        return null
      }

      return {
        name: topicName,
        slug: readTrimmedString(topicTagRecord.slug),
      } satisfies LeetCodeTopic
    })
    .filter((topicTag): topicTag is LeetCodeTopic => Boolean(topicTag))
}

function readTrimmedString(unknownValue: unknown) {
  return typeof unknownValue === 'string' && unknownValue.trim()
    ? unknownValue.trim()
    : null
}

function isObjectRecord(
  unknownValue: unknown,
): unknownValue is Record<string, unknown> {
  return typeof unknownValue === 'object' && unknownValue !== null
}
