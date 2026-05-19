import {
  createLeetCodeFetchRemoteClient,
  type LeetCodeMetadataResult,
  type LeetCodeProblemContentResult,
  type LeetCodeRemoteClient,
  type LeetCodeSubmissionResultRemoteResponse,
} from '@/lib/leetcode'

import type {
  SerializedLeetCodeMetadataResult,
  SerializedLeetCodeProblemContentResult,
} from '../domain/leetcode-capture-contracts'
import {
  leetcodeSubmissionResultRemoteResponseSchema,
  serializedLeetCodeMetadataResultSchema,
  serializedLeetCodeProblemContentResultSchema,
} from '../domain/leetcode-capture-contracts'

type LeetCodeProblemRemoteRequest = Parameters<
  LeetCodeRemoteClient['readProblemMetadata']
>[0]
type LeetCodeSubmissionResultRemoteRequest = Parameters<
  LeetCodeRemoteClient['readSubmissionResult']
>[0]

const leetCodeRemoteClient = createLeetCodeFetchRemoteClient()
const metadataCache = new Map<string, SerializedLeetCodeMetadataResult>()
const contentCache = new Map<string, SerializedLeetCodeProblemContentResult>()
const submissionResultCache = new Map<
  string,
  LeetCodeSubmissionResultRemoteResponse
>()
const submissionAttemptResultCache = new Map<
  string,
  LeetCodeSubmissionResultRemoteResponse
>()

export async function readLeetCodeProblemMetadataInBackground(
  request: LeetCodeProblemRemoteRequest,
) {
  const cachedResult = metadataCache.get(request.location.slug)

  if (cachedResult) {
    return cachedResult
  }

  const result = serializeLeetCodeMetadataResult(
    await leetCodeRemoteClient.readProblemMetadata(request),
  )
  metadataCache.set(request.location.slug, result)

  return result
}

export async function readLeetCodeProblemContentInBackground(
  request: LeetCodeProblemRemoteRequest,
) {
  const cachedResult = contentCache.get(request.location.slug)

  if (cachedResult) {
    return cachedResult
  }

  const result = serializeLeetCodeProblemContentResult(
    await leetCodeRemoteClient.readProblemContent(request),
  )
  contentCache.set(request.location.slug, result)

  return result
}

export async function readLeetCodeSubmissionResultInBackground(
  request: LeetCodeSubmissionResultRemoteRequest,
) {
  const attemptCacheKey = createSubmissionAttemptCacheKey(request)
  const cachedAttemptResponse =
    submissionAttemptResultCache.get(attemptCacheKey)

  if (cachedAttemptResponse) {
    return cachedAttemptResponse
  }

  const response = leetcodeSubmissionResultRemoteResponseSchema.parse(
    await leetCodeRemoteClient.readSubmissionResult(request),
  )
  const submissionId = response.result?.submissionId

  if (submissionId) {
    const cachedResponse = submissionResultCache.get(submissionId)

    if (cachedResponse) {
      submissionAttemptResultCache.set(attemptCacheKey, cachedResponse)
      return cachedResponse
    }

    submissionResultCache.set(submissionId, response)
    submissionAttemptResultCache.set(attemptCacheKey, response)
  }

  return response
}

function serializeLeetCodeMetadataResult(
  result: LeetCodeMetadataResult,
): SerializedLeetCodeMetadataResult {
  return serializedLeetCodeMetadataResultSchema.parse(
    result.ok
      ? result
      : {
          ok: false,
          errorMessage: result.error.message,
        },
  )
}

function createSubmissionAttemptCacheKey(
  request: LeetCodeSubmissionResultRemoteRequest,
) {
  return `${request.location.slug}:${request.click.clickedAt}`
}

function serializeLeetCodeProblemContentResult(
  result: LeetCodeProblemContentResult,
): SerializedLeetCodeProblemContentResult {
  return serializedLeetCodeProblemContentResultSchema.parse(
    result.ok
      ? result
      : {
          ok: false,
          errorMessage: result.error.message,
        },
  )
}
