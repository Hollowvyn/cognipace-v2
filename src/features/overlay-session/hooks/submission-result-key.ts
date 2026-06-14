import type { LeetCodeSubmissionResult } from '@/lib/leetcode'

const KEY_VERSION = 'srk1'
const MAX_SLUG_CHARS = 60
const MAX_SUBMISSION_ID_CHARS = 32
const MAX_STATUS_CHARS = 32

export function createSubmissionResultKey(
  result: LeetCodeSubmissionResult,
): string {
  const material = JSON.stringify([
    result.location.slug,
    result.source,
    result.submissionId,
    result.status,
    result.statusText,
    result.runtime,
    result.memory,
    result.passedTestCount,
    result.totalTestCount,
    result.failingTestcase,
    result.errorMessage,
    result.compileError,
    result.runtimeError,
    result.lastTestcase,
    result.codeOutput,
    result.expectedOutput,
    result.stdOutput,
    result.resultCodeSnapshot.language,
    result.resultCodeSnapshot.source,
    result.resultCodeSnapshot.code,
  ])
  const hash = hashKeyMaterial(material)

  return [
    KEY_VERSION,
    toReadableKeyPart(result.location.slug, MAX_SLUG_CHARS),
    result.source,
    toReadableKeyPart(
      result.submissionId ?? 'no-submission-id',
      MAX_SUBMISSION_ID_CHARS,
    ),
    toReadableKeyPart(result.status, MAX_STATUS_CHARS),
    hash,
  ].join(':')
}

function hashKeyMaterial(material: string): string {
  let primary = 0x811c9dc5
  let secondary = 0x811c9dc5 ^ material.length

  for (let index = 0; index < material.length; index += 1) {
    const code = material.charCodeAt(index)
    primary = Math.imul(primary ^ code, 16777619)
    secondary = Math.imul(secondary ^ code, 1597334677)
  }

  return `${(primary >>> 0).toString(36)}${(secondary >>> 0).toString(36)}`
}

function toReadableKeyPart(value: string, maxChars: number): string {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]+/g, '-')

  return (sanitized || 'unknown').slice(0, maxChars)
}
