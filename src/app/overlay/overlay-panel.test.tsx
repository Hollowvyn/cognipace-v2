import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { OverlayPanel } from './overlay-panel'
import type { LeetCodeOverlaySession } from './use-leetcode-overlay-session'

const premiumSession = {
  location: {
    slug: 'binary-tree-upside-down',
    url: 'https://leetcode.com/problems/binary-tree-upside-down/',
    host: 'leetcode.com',
  },
  metadata: {
    location: {
      slug: 'binary-tree-upside-down',
      url: 'https://leetcode.com/problems/binary-tree-upside-down/',
      host: 'leetcode.com',
    },
    title: 'Binary Tree Upside Down',
    frontendId: '156',
    difficulty: 'Medium',
    isPremium: true,
    topics: [{ name: 'Tree', slug: 'tree' }],
    source: 'graphql',
    confidence: 'high',
    capturedAt: 100,
  },
  problemContent: null,
  context: null,
  codeSnapshot: null,
  lastSubmissionClick: null,
  lastSubmissionAttempt: null,
  lastSubmissionPollingDebug: null,
  lastSubmissionResult: null,
  status: 'ready',
  feedback: null,
  elapsedSeconds: 239,
  saveReview: vi.fn(),
} satisfies LeetCodeOverlaySession

describe('OverlayPanel', () => {
  it('shows when a LeetCode problem is premium locked', () => {
    render(<OverlayPanel {...premiumSession} />)

    expect(screen.getByText('Premium')).toBeInTheDocument()
    expect(screen.getByText('Premium locked on LeetCode')).toBeInTheDocument()
  })

  it('shows submitted attempt debug details', () => {
    render(
      <OverlayPanel
        {...premiumSession}
        lastSubmissionAttempt={{
          location: premiumSession.location,
          clickedAt: 5000,
          submitButtonText: 'Submit',
          submittedCodeSnapshot: {
            code: 'class Solution:\n    pass',
            language: 'Python3',
            source: 'monaco',
            capturedAt: 5000,
          },
        }}
      />,
    )

    expect(screen.getByText('Submitted snapshot')).toBeInTheDocument()
    expect(screen.getByText('Python3')).toBeInTheDocument()
    expect(screen.getByText('monaco')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Submission attempt debug').textContent,
    ).toContain('class Solution:')
  })

  it('shows problem content debug details', () => {
    render(
      <OverlayPanel
        {...premiumSession}
        problemContent={{
          location: premiumSession.location,
          statement: 'Given a binary tree, flip it upside down.',
          examples: [
            {
              label: 'Example 1',
              input: 'root = [1,2,3]',
              output: '[2,3,1]',
              explanation: null,
              rawText: 'Input: root = [1,2,3]\nOutput: [2,3,1]',
            },
          ],
          constraints: ['The number of nodes is in the range [0, 10].'],
          hints: ['Think recursively.'],
          source: 'graphql',
          confidence: 'high',
          capturedAt: 6000,
          contentFingerprint: 'lc-content-debug123',
        }}
      />,
    )

    expect(screen.getByText('Problem content')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Problem content debug').textContent,
    ).toContain('Given a binary tree')
    expect(
      screen.getByLabelText('Problem content debug').textContent,
    ).toContain('debug123')
  })

  it('shows when the submission result is still pending', () => {
    render(
      <OverlayPanel
        {...premiumSession}
        lastSubmissionAttempt={{
          location: premiumSession.location,
          clickedAt: 5000,
          submitButtonText: 'Submit',
          submittedCodeSnapshot: {
            code: 'class Solution:\n    pass',
            language: 'Python3',
            source: 'monaco',
            capturedAt: 5000,
          },
        }}
      />,
    )

    expect(screen.getByText('Waiting for result')).toBeInTheDocument()
    expect(
      screen.getByText('Watching LeetCode submission APIs'),
    ).toBeInTheDocument()
  })

  it('shows submission polling debug details', () => {
    render(
      <OverlayPanel
        {...premiumSession}
        lastSubmissionPollingDebug={{
          phase: 'checking-result',
          submissionId: '1234567890',
          checkState: 'PENDING',
          statusText: 'Pending',
          checkedAt: 5000,
        }}
      />,
    )

    expect(screen.getByText('Polling debug')).toBeInTheDocument()
    expect(screen.getByText('checking result')).toBeInTheDocument()
    expect(screen.getByText('1234567890')).toBeInTheDocument()
    expect(screen.getByText('PENDING')).toBeInTheDocument()
  })

  it('shows submission result debug details', () => {
    render(
      <OverlayPanel
        {...premiumSession}
        lastSubmissionResult={{
          location: premiumSession.location,
          submissionId: '1234567890',
          source: 'api',
          status: 'accepted',
          statusText: 'Accepted',
          checkedAt: 5000,
          runtime: '8 ms',
          memory: '17.4 MB',
          passedTestCount: 58,
          totalTestCount: 58,
          failingTestcase: null,
          errorMessage: null,
          compileError: null,
          runtimeError: null,
          lastTestcase: null,
          codeOutput: null,
          expectedOutput: null,
          stdOutput: null,
          resultCodeSnapshot: {
            code: 'class Solution:\n    pass',
            language: 'Python3',
            source: 'code-block',
            capturedAt: 5000,
          },
        }}
      />,
    )

    expect(screen.getByText('Submission result')).toBeInTheDocument()
    expect(screen.getByText('Accepted')).toBeInTheDocument()
    expect(screen.getByText('8 ms')).toBeInTheDocument()
    expect(screen.getByText('58/58')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Submission result debug').textContent,
    ).toContain('class Solution:')
  })

  it('shows complete submission result detail fields', () => {
    render(
      <OverlayPanel
        {...premiumSession}
        lastSubmissionResult={{
          location: premiumSession.location,
          submissionId: '1234567890',
          source: 'api',
          status: 'runtime-error',
          statusText: 'Runtime Error',
          checkedAt: 5000,
          runtime: null,
          memory: null,
          passedTestCount: 0,
          totalTestCount: 63,
          failingTestcase: '[2,7,11,15]\n9',
          errorMessage: 'IndexError: list index out of range',
          compileError: null,
          runtimeError: 'IndexError: list index out of range',
          lastTestcase: '[2,7,11,15]\n9',
          codeOutput: '[]',
          expectedOutput: '[0,1]',
          stdOutput: 'before crash',
          resultCodeSnapshot: {
            code: 'class Solution:\n    raise IndexError()',
            language: 'Python3',
            source: 'api',
            capturedAt: 5000,
          },
        }}
      />,
    )

    const resultPanel = screen.getByLabelText('Submission result debug')

    expect(resultPanel.textContent).toContain('Runtime Error')
    expect(resultPanel.textContent).toContain('runtime error')
    expect(resultPanel.textContent).toContain(
      'IndexError: list index out of range',
    )
    expect(resultPanel.textContent).toContain('failing testcase')
    expect(resultPanel.textContent).toContain('[2,7,11,15]')
    expect(resultPanel.textContent).toContain('output')
    expect(resultPanel.textContent).toContain('[]')
    expect(resultPanel.textContent).toContain('expected')
    expect(resultPanel.textContent).toContain('[0,1]')
    expect(resultPanel.textContent).toContain('stdout')
    expect(resultPanel.textContent).toContain('before crash')
    expect(resultPanel.textContent).toContain('result code')
    expect(resultPanel.textContent).toContain('raise IndexError')
  })
})
