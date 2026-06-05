import { describe, expect, it } from 'vitest'

import { PROMPT_VERSION } from '../domain/recommendation-types'
import {
  buildAssessmentPrompt,
  CODE_CHAR_LIMIT,
  CODE_TRUNCATION_MARKER,
  DIAGNOSTIC_FIELD_CHAR_LIMIT,
  STATEMENT_CHAR_LIMIT,
  TEXT_TRUNCATION_MARKER,
} from './build-assessment-prompt'
import {
  makeAcceptedDecision,
  makeAcceptedSubmission,
  makeFailedDecision,
  makeFailedSubmission,
  makeNoSubmission,
  makeProblem,
  makeProviderConfig,
  makeRecallSessionContext,
  makeRecommendAssessmentInput,
  makeTiming,
} from '../testing/recommendation-fixtures'

describe('buildAssessmentPrompt — system message', () => {
  it('includes the prompt version', () => {
    const { system } = buildAssessmentPrompt(makeRecommendAssessmentInput())
    expect(system).toContain(PROMPT_VERSION)
  })

  it('includes all six non-negotiable rules', () => {
    const { system } = buildAssessmentPrompt(makeRecommendAssessmentInput())
    for (const ruleNumber of ['1.', '2.', '3.', '4.', '5.', '6.']) {
      expect(system).toContain(ruleNumber)
    }
    expect(system).toMatch(/conservative/i)
    expect(system).toMatch(/Failed submissions/)
    expect(system).toMatch(/Hard-mode/i)
  })

  it('produces identical output for identical input (deterministic)', () => {
    const input = makeRecommendAssessmentInput()
    const a = buildAssessmentPrompt(input)
    const b = buildAssessmentPrompt(input)
    expect(a.system).toBe(b.system)
    expect(a.user).toBe(b.user)
  })
})

describe('buildAssessmentPrompt — accepted submission snapshot', () => {
  it('renders an accepted submission with full context', () => {
    const input = makeRecommendAssessmentInput({
      problem: makeProblem({
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'medium',
        topics: ['array', 'hash-table'],
        statement: 'Find two numbers that add up to target.',
      }),
      submission: makeAcceptedSubmission({
        code: 'function twoSum(nums, target) { /* ... */ }',
        language: 'TypeScript',
        runtime: '42 ms',
        memory: '18 MB',
        passedTestCount: 57,
        totalTestCount: 57,
      }),
      timing: makeTiming({
        elapsedSeconds: 600,
        targetSeconds: 2100,
        timerUsed: true,
      }),
      deterministicDecision: makeAcceptedDecision(),
      sessionContext: makeRecallSessionContext(),
      providerConfig: makeProviderConfig(),
    })
    expect(buildAssessmentPrompt(input).user).toMatchSnapshot()
  })
})

describe('buildAssessmentPrompt — wrong-answer snapshot', () => {
  it('renders a failed submission with diagnostics', () => {
    const input = makeRecommendAssessmentInput({
      problem: makeProblem({
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'medium',
        topics: ['array', 'hash-table'],
      }),
      submission: makeFailedSubmission({
        code: 'function twoSum(nums, target) { return [] }',
        language: 'TypeScript',
        failingTestcase: '[2,7,11,15]\n9',
        expectedOutput: '[0,1]',
        actualOutput: '[]',
        errorMessage: '',
        passedTestCount: 10,
        totalTestCount: 11,
      }),
      timing: makeTiming({ elapsedSeconds: 900, timerUsed: true }),
      deterministicDecision: makeFailedDecision(),
      sessionContext: makeRecallSessionContext(),
      providerConfig: makeProviderConfig(),
    })
    expect(buildAssessmentPrompt(input).user).toMatchSnapshot()
  })
})

describe('buildAssessmentPrompt — no-submission snapshot', () => {
  it('omits code and diagnostics blocks for manual-overlay path', () => {
    const input = makeRecommendAssessmentInput({
      submission: makeNoSubmission(),
    })
    const { user } = buildAssessmentPrompt(input)
    expect(user).not.toContain('### Code')
    expect(user).not.toContain('### Failure diagnostics')
    expect(user).toMatch(/Status: no-submission/i)
    expect(user).toMatchSnapshot()
  })
})

describe('buildAssessmentPrompt — truncation', () => {
  it('truncates a long statement with the text marker', () => {
    const input = makeRecommendAssessmentInput({
      problem: makeProblem({
        statement: 'x'.repeat(STATEMENT_CHAR_LIMIT + 500),
      }),
    })
    const { user } = buildAssessmentPrompt(input)
    expect(user).toContain(TEXT_TRUNCATION_MARKER)
    const occurrences = user.split(TEXT_TRUNCATION_MARKER).length - 1
    expect(occurrences).toBeGreaterThanOrEqual(1)
  })

  it('truncates long code with the code marker', () => {
    const input = makeRecommendAssessmentInput({
      submission: makeAcceptedSubmission({
        code: 'x'.repeat(CODE_CHAR_LIMIT + 500),
        language: 'TypeScript',
      }),
    })
    const { user } = buildAssessmentPrompt(input)
    expect(user).toContain(CODE_TRUNCATION_MARKER)
  })

  it('truncates long failingTestcase with the text marker', () => {
    const input = makeRecommendAssessmentInput({
      submission: makeFailedSubmission({
        failingTestcase: 'x'.repeat(DIAGNOSTIC_FIELD_CHAR_LIMIT + 500),
      }),
      deterministicDecision: makeFailedDecision(),
    })
    const { user } = buildAssessmentPrompt(input)
    expect(user).toContain(TEXT_TRUNCATION_MARKER)
  })
})
