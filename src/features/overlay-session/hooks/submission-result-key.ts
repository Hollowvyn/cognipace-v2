import type { LeetCodeSubmissionResult } from '@/lib/leetcode'

export function createSubmissionResultKey(
  result: LeetCodeSubmissionResult,
): string {
  return [
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
  ].join('|')
}
