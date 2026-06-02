import {
  PROMPT_VERSION,
  type RecommendAssessmentInput,
  type AssessmentRecommendationSubmission,
} from '../domain/recommendation-types'

export const STATEMENT_CHAR_LIMIT = 2000
export const CODE_CHAR_LIMIT = 4000
export const DIAGNOSTIC_FIELD_CHAR_LIMIT = 500

export const TEXT_TRUNCATION_MARKER = '... [truncated]'
export const CODE_TRUNCATION_MARKER = '// [truncated]'

export type AssessmentPrompt = {
  system: string
  user: string
}

export function buildAssessmentPrompt(
  input: RecommendAssessmentInput,
): AssessmentPrompt {
  return {
    system: buildSystemMessage(),
    user: buildUserPayload(input),
  }
}

function buildSystemMessage(): string {
  return `You are CogniPace's LeetCode review assistant, prompt version ${PROMPT_VERSION}.

CogniPace is a LeetCode spaced-repetition practice coach. Your job is to recommend an FSRS review rating (again | hard | good | easy) for the user's just-completed practice attempt — NOT a grade or quality score.

The FSRS ratings mean:
- again: the user did not recall the solution; needs to see this soon
- hard: the user recalled with significant struggle
- good: the user recalled with normal effort
- easy: the user recalled quickly and confidently

Recommendation rules (these are non-negotiable):
1. Be conservative. When in doubt, recommend the deterministic rating.
2. Failed submissions MUST recommend "again". You may not override this.
3. Hard-mode locked overtime attempts MUST recommend "again". You may not override this.
4. Use only the facts provided in the context payload. Do not invent runtime numbers, prior attempts, or code that was not given to you.
5. Do not write or modify the user's notes or any structured log field.
6. Respond ONLY with JSON conforming to the schema you were given. No prose, no markdown, no commentary outside the JSON.

Output field rules:
- evidence: at most 5 items, each ≤200 characters, each a concrete fact from the provided context.
- improvementPoints: at most 5 actionable suggestions, ≤200 chars each.
- edgeCaseNotes: at most 5 items, ≤200 chars each.
- complexity.{time, space}: standard Big-O notation (e.g., "O(n log n)"). Use "unknown" if you cannot tell from the code.
- shouldUpdateRating: true ONLY when your recommendedRating differs from the deterministic rating AND your confidence is medium or high.
- promptVersion: always "${PROMPT_VERSION}".`
}

function buildUserPayload(input: RecommendAssessmentInput): string {
  const sections: string[] = []
  sections.push(renderProblem(input))
  sections.push(renderSubmission(input.submission))
  sections.push(renderTiming(input))
  sections.push(renderDeterministicDecision(input))
  sections.push(renderPracticeContext(input))
  sections.push(
    '## Your task\nRecommend an FSRS rating for this attempt. Respond with JSON only.',
  )
  return sections.join('\n\n')
}

function renderProblem(input: RecommendAssessmentInput): string {
  const { problem } = input
  const topics = problem.topics.length > 0 ? problem.topics.join(', ') : '(none)'
  const lines = [
    '## Problem',
    `- Slug: ${problem.slug}`,
    `- Title: ${problem.title}`,
    `- Difficulty: ${problem.difficulty}`,
    `- Topics: ${topics}`,
  ]
  if (problem.statement !== undefined && problem.statement !== '') {
    lines.push('')
    lines.push('### Statement')
    lines.push(
      truncateText(problem.statement, STATEMENT_CHAR_LIMIT, TEXT_TRUNCATION_MARKER),
    )
  }
  return lines.join('\n')
}

function renderSubmission(submission: AssessmentRecommendationSubmission): string {
  if (submission.status === 'no-submission') {
    return '## Submission\n- Status: no-submission (manual review without LeetCode result)'
  }

  const lines: string[] = ['## Submission', `- Status: ${submission.status}`]
  if (submission.language !== undefined) lines.push(`- Language: ${submission.language}`)
  if (submission.status === 'accepted') {
    if (submission.runtime !== undefined) lines.push(`- Runtime: ${submission.runtime}`)
    if (submission.memory !== undefined) lines.push(`- Memory: ${submission.memory}`)
  }
  if (
    submission.passedTestCount !== undefined &&
    submission.totalTestCount !== undefined
  ) {
    lines.push(
      `- Tests passed: ${submission.passedTestCount} of ${submission.totalTestCount}`,
    )
  }

  if (submission.code !== undefined && submission.code !== '') {
    lines.push('')
    lines.push('### Code')
    const fence =
      submission.language !== undefined ? `\`\`\`${submission.language}` : '```'
    lines.push(fence)
    lines.push(truncateText(submission.code, CODE_CHAR_LIMIT, CODE_TRUNCATION_MARKER))
    lines.push('```')
  }

  if (submission.status === 'failed') {
    const diag: string[] = []
    if (
      submission.failingTestcase !== undefined &&
      submission.failingTestcase !== ''
    ) {
      diag.push(
        `- Failing testcase: ${truncateText(submission.failingTestcase, DIAGNOSTIC_FIELD_CHAR_LIMIT, TEXT_TRUNCATION_MARKER)}`,
      )
    }
    if (
      submission.expectedOutput !== undefined &&
      submission.expectedOutput !== ''
    ) {
      diag.push(
        `- Expected output: ${truncateText(submission.expectedOutput, DIAGNOSTIC_FIELD_CHAR_LIMIT, TEXT_TRUNCATION_MARKER)}`,
      )
    }
    if (submission.actualOutput !== undefined && submission.actualOutput !== '') {
      diag.push(
        `- Actual output: ${truncateText(submission.actualOutput, DIAGNOSTIC_FIELD_CHAR_LIMIT, TEXT_TRUNCATION_MARKER)}`,
      )
    }
    if (submission.errorMessage !== undefined && submission.errorMessage !== '') {
      diag.push(
        `- Error message: ${truncateText(submission.errorMessage, DIAGNOSTIC_FIELD_CHAR_LIMIT, TEXT_TRUNCATION_MARKER)}`,
      )
    }
    if (diag.length > 0) {
      lines.push('')
      lines.push('### Failure diagnostics')
      lines.push(...diag)
    }
  }

  return lines.join('\n')
}

function renderTiming(input: RecommendAssessmentInput): string {
  const { timing } = input
  const lines = ['## Timing']
  if (timing.elapsedSeconds === null) {
    lines.push('- Elapsed: untimed')
  } else {
    lines.push(
      `- Elapsed: ${timing.elapsedSeconds} seconds (${formatDuration(timing.elapsedSeconds)})`,
    )
  }
  lines.push(
    `- Target: ${timing.targetSeconds} seconds (${formatDuration(timing.targetSeconds)})`,
  )
  lines.push(`- Timer used: ${timing.timerUsed ? 'yes' : 'no'}`)
  return lines.join('\n')
}

function renderDeterministicDecision(input: RecommendAssessmentInput): string {
  const { deterministicDecision: decision } = input
  if (decision.status !== 'accepted') {
    return `## Deterministic decision\n- Status: blocked\n- Reason code: ${decision.reason.code}`
  }
  const lines = [
    '## Deterministic decision',
    `- Rating: ${decision.rating}`,
    `- Reason code: ${decision.reason.code}`,
    `- Confidence: ${decision.confidence.toFixed(2)}`,
    `- Lock reason: ${decision.lockReason ?? 'none'}`,
  ]
  if (decision.warnings.length > 0) {
    const codes = decision.warnings.map((w) => w.code).join(', ')
    lines.push(`- Warnings: ${codes}`)
  }
  return lines.join('\n')
}

function renderPracticeContext(input: RecommendAssessmentInput): string {
  const ctx = input.sessionContext
  const lines = [
    '## Practice context',
    `- Session kind: ${ctx.sessionKind}`,
    `- Submission source: ${ctx.submissionSource}`,
  ]
  if (ctx.previousRating !== null) {
    lines.push(`- Previous rating: ${ctx.previousRating}`)
  }
  if (ctx.bestElapsedSeconds !== null) {
    lines.push(
      `- Best previous time: ${ctx.bestElapsedSeconds} seconds (${formatDuration(ctx.bestElapsedSeconds)})`,
    )
  }
  if (ctx.latestAttempt !== null) {
    const a = ctx.latestAttempt
    const elapsed = a.elapsedSeconds === null ? 'untimed' : `${a.elapsedSeconds}s`
    lines.push(
      `- Latest attempt: rating=${a.rating}, isCorrect=${a.isCorrect}, elapsed=${elapsed}`,
    )
  }
  return lines.join('\n')
}

function truncateText(value: string, limit: number, marker: string): string {
  if (value.length <= limit) return value
  const cutAt = Math.max(0, limit - marker.length)
  return value.slice(0, cutAt) + marker
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  if (minutes === 0) return `${remainder} sec`
  if (remainder === 0) return `${minutes} min`
  return `${minutes} min ${remainder} sec`
}
