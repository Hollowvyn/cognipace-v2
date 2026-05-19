import { parseLeetCodeDifficulty } from '../domain/difficulty'
import type {
  LeetCodeMetadataResult,
  LeetCodeProblemLocation,
  LeetCodeProblemMetadata,
  LeetCodeTopic,
} from '../domain/types'

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

const questionMetadataQuery = `
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
    fetch?: FetchLike | undefined
    document?: Document | undefined
    now?: (() => number) | undefined
  } = {},
): Promise<LeetCodeMetadataResult> {
  const fetcher = options.fetch ?? globalThis.fetch?.bind(globalThis)

  if (!fetcher) {
    return { ok: false, error: new Error('Fetch is not available.') }
  }

  try {
    const headers = readGraphQlHeaders(options.document)
    const response = await fetcher(new URL('/graphql', location.url), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: questionMetadataQuery,
        variables: { titleSlug: location.slug },
      }),
    })

    if (!response.ok) {
      return {
        ok: false,
        error: new Error(`LeetCode GraphQL request failed: ${response.status}`),
      }
    }

    const payload: unknown = await response.json()
    const question = readQuestion(payload)

    if (!question) {
      return {
        ok: false,
        error: new Error('LeetCode GraphQL response did not include question.'),
      }
    }

    return {
      ok: true,
      metadata: {
        location,
        title: question.title || location.slug,
        frontendId: question.questionFrontendId,
        difficulty: parseLeetCodeDifficulty(question.difficulty),
        isPremium: question.isPaidOnly,
        topics: question.topicTags,
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

function readGraphQlHeaders(documentRef: Document | undefined) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const csrfToken = documentRef
    ? readCookie(documentRef.cookie, 'csrftoken')
    : null

  if (csrfToken) {
    headers['x-csrftoken'] = csrfToken
  }

  return headers
}

function readCookie(cookie: string, name: string) {
  return (
    cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  )
}

function readQuestion(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    return null
  }

  const question = payload.data.question

  if (!isRecord(question)) {
    return null
  }

  return {
    title: readString(question.title),
    questionFrontendId: readString(question.questionFrontendId),
    difficulty: readString(question.difficulty),
    isPaidOnly:
      typeof question.isPaidOnly === 'boolean' ? question.isPaidOnly : null,
    topicTags: readTopicTags(question.topicTags),
  }
}

function readTopicTags(value: unknown): LeetCodeTopic[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((topic) => {
      if (!isRecord(topic)) {
        return null
      }

      const name = readString(topic.name)

      if (!name) {
        return null
      }

      return {
        name,
        slug: readString(topic.slug),
      } satisfies LeetCodeTopic
    })
    .filter((topic): topic is LeetCodeTopic => Boolean(topic))
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
