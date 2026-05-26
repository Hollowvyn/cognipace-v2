import { afterEach, describe, expect, it, vi } from 'vitest'

import type { LeetCodePageEvent } from '../domain/types'
import {
  createLeetCodeSubmissionApiFixtureFetcher,
  leetcodeAcceptedSubmissionApiFixture,
  leetcodePendingSubmissionApiFixture,
} from '../testing/submission-result-fixtures'
import { createLeetCodePageWatcher } from './leetcode-page-watcher'

type PageWatcherOptions = Parameters<typeof createLeetCodePageWatcher>[0]
type PageWatcherTestOptions = Omit<Partial<PageWatcherOptions>, 'onEvent'>

const problemUrl = 'https://leetcode.com/problems/two-sum/'
const problemLocation = {
  slug: 'two-sum',
  url: problemUrl,
  host: 'leetcode.com',
}

describe('createLeetCodePageWatcher', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits page and metadata events for a LeetCode problem page', async () => {
    vi.useFakeTimers()
    renderProblemHeader()
    const fetcher = createQuestionMetadataFetcher()
    const { events, watcher } = createWatcherTestHarness({
      fetch: fetcher,
      now: () => 1000,
    })

    watcher.start()
    await vi.runAllTimersAsync()
    watcher.stop()

    expect(findEvent(events, 'page-ready')).toMatchObject({
      location: { slug: 'two-sum' },
      pageReadyAt: 1000,
      metadata: { title: 'Two Sum', source: 'graphql' },
    })
  })

  it('emits problem content when LeetCode content is readable', async () => {
    vi.useFakeTimers()
    renderProblemHeader()
    const { events, watcher } = createWatcherTestHarness({
      fetch: createQuestionContentFetcher(),
      now: () => 1000,
    })

    watcher.start()
    await vi.runAllTimersAsync()
    watcher.stop()

    expect(findEvent(events, 'problem-content-updated')).toMatchObject({
      location: { slug: 'two-sum' },
      content: {
        statement: 'Return indices.',
        examples: [
          {
            input: 'nums = [2,7]',
            output: '[0,1]',
          },
        ],
        constraints: ['2 <= nums.length'],
        hints: ['Use a hash map.'],
        source: 'graphql',
        confidence: 'high',
      },
    })
  })

  it('emits page changes when the active slug changes', async () => {
    vi.useFakeTimers()
    let currentUrl = problemUrl
    const { events, watcher } = createWatcherTestHarness({
      getCurrentUrl: () => currentUrl,
    })

    watcher.start()
    await vi.runAllTimersAsync()
    currentUrl = 'https://leetcode.com/problems/valid-parentheses/'
    watcher.refresh()
    await vi.runAllTimersAsync()
    watcher.stop()

    expect(
      filterEvents(events, 'page-changed').map((event) => event.location.slug),
    ).toEqual(['two-sum', 'valid-parentheses'])
  })

  it('emits submit-clicked without saving a review', async () => {
    vi.useFakeTimers()
    renderProblemEditorPage()
    const { events, watcher } = createWatcherTestHarness({
      now: () => 2000,
    })

    watcher.start()
    await vi.runAllTimersAsync()
    dispatchSubmitClick()
    watcher.stop()

    expect(findEvent(events, 'submit-clicked')).toMatchObject({
      click: { location: problemLocation, buttonText: 'Submit' },
    })
    expect(findEvent(events, 'submission-started')).toMatchObject({
      attempt: {
        submittedCodeSnapshot: {
          code: 'class Solution:\n    pass',
          language: 'Python3',
          source: 'monaco',
        },
      },
    })
  })

  it('emits submission-result-updated after LeetCode renders the result', async () => {
    vi.useFakeTimers()
    renderProblemEditorPage()
    const { events, watcher } = createWatcherTestHarness({
      submissionResultReadDelays: [0],
      domSubmissionResultFallbackDelayMs: 0,
      now: () => 3000,
    })

    watcher.start()
    await vi.runAllTimersAsync()
    dispatchSubmitClick()
    appendAcceptedSubmissionResult({ runtime: '8 ms', memory: '17.4 MB' })
    await vi.runAllTimersAsync()
    watcher.stop()

    expect(findEvent(events, 'submission-result-updated')).toMatchObject({
      result: {
        location: problemLocation,
        source: 'dom',
        status: 'accepted',
        statusText: 'Accepted',
        runtime: '8 ms',
        memory: '17.4 MB',
        passedTestCount: 58,
        totalTestCount: 58,
        resultCodeSnapshot: {
          code: 'class Solution:\n    pass',
          language: 'Python3',
          source: 'code-block',
        },
      },
    })
  })

  it('emits API submission details after LeetCode finishes judging', async () => {
    vi.useFakeTimers()
    renderProblemEditorPage()
    const { events, watcher } = createWatcherTestHarness({
      hydrationDelays: [],
      submissionResultReadDelays: [0],
      fetch: createLeetCodeSubmissionApiFixtureFetcher(
        leetcodeAcceptedSubmissionApiFixture,
      ),
      now: () => 5000,
    })

    watcher.start()
    dispatchSubmitClick()
    await vi.runAllTimersAsync()
    watcher.stop()

    expect(findEvent(events, 'submission-result-updated')).toMatchObject({
      result: {
        location: problemLocation,
        submissionId: '1234567890',
        source: 'api',
        status: 'accepted',
        statusText: 'Accepted',
        runtime: '4 ms',
        memory: '20.62 MB',
        passedTestCount: 63,
        totalTestCount: 63,
        resultCodeSnapshot: {
          code: 'class Solution:\n    def twoSum(self):\n        return []',
          language: 'Python3',
          source: 'api',
        },
      },
    })
  })

  it('keeps waiting instead of emitting DOM fallback while API polling is active', async () => {
    vi.useFakeTimers()
    renderProblemEditorPage()
    const { events, watcher } = createWatcherTestHarness({
      hydrationDelays: [],
      submissionResultReadDelays: [0],
      fetch: createLeetCodeSubmissionApiFixtureFetcher(
        leetcodePendingSubmissionApiFixture,
      ),
      now: () => 5000,
    })

    watcher.start()
    dispatchSubmitClick()
    appendRuntimeErrorSubmissionResult()
    await vi.runAllTimersAsync()
    watcher.stop()

    expect(filterEvents(events, 'submission-result-updated')).toHaveLength(0)
    expect(readSubmissionPollingPhases(events)).not.toContain(
      'dom-fallback-used',
    )
  })

  it('emits polling timeout debug when no result becomes available', async () => {
    vi.useFakeTimers()
    renderProblemEditorPage()
    let currentTime = 0
    const { events, watcher } = createWatcherTestHarness({
      hydrationDelays: [],
      submissionResultReadDelays: [1000],
      submissionResultWatchDurationMs: 1000,
      domSubmissionResultFallbackDelayMs: 1000,
      now: () => currentTime,
    })

    watcher.start()
    dispatchSubmitClick()
    currentTime = 1000
    await vi.advanceTimersByTimeAsync(1000)
    watcher.stop()

    expect(readSubmissionPollingPhases(events)).toContain('timed-out')
    expect(filterEvents(events, 'submission-result-updated')).toHaveLength(0)
  })

  it('reads the submission result when LeetCode updates the page after submit', async () => {
    vi.useFakeTimers()
    renderProblemEditorPage()
    const { events, watcher } = createWatcherTestHarness({
      submissionResultReadDelays: [10000],
      domSubmissionResultFallbackDelayMs: 0,
      mutationRefreshDebounceMs: 100,
      now: () => 4000,
    })

    watcher.start()
    await vi.runOnlyPendingTimersAsync()
    dispatchSubmitClick()
    appendAcceptedSubmissionResult({ runtime: '11 ms', includeCode: false })
    await vi.advanceTimersByTimeAsync(100)
    watcher.stop()

    expect(findEvent(events, 'submission-result-updated')).toMatchObject({
      result: {
        status: 'accepted',
        runtime: '11 ms',
      },
    })
  })
})

function createWatcherTestHarness(options: PageWatcherTestOptions = {}) {
  const events: LeetCodePageEvent[] = []
  const watcher = createLeetCodePageWatcher({
    getCurrentUrl: () => problemUrl,
    hydrationDelays: [0],
    fetch: () => Promise.resolve(new Response('', { status: 500 })),
    ...options,
    onEvent: (event) => events.push(event),
  })

  return { events, watcher }
}

function createQuestionMetadataFetcher(
  question: {
    topicTags?: { name: string; slug: string }[] | undefined
  } = {},
) {
  return vi.fn(() =>
    Promise.resolve(createQuestionMetadataResponse(question.topicTags)),
  )
}

function createQuestionContentFetcher() {
  return vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    const requestBody = typeof init?.body === 'string' ? init.body : ''

    if (requestBody.includes('questionContent')) {
      return Promise.resolve(
        Response.json({
          data: {
            question: {
              content:
                '<p>Return indices.</p><p><strong>Example 1:</strong></p><pre>Input: nums = [2,7]\nOutput: [0,1]</pre><p><strong>Constraints:</strong></p><ul><li>2 <= nums.length</li></ul>',
              hints: ['Use a hash map.'],
            },
          },
        }),
      )
    }

    return Promise.resolve(createQuestionMetadataResponse())
  })
}

function createQuestionMetadataResponse(
  topicTags: { name: string; slug: string }[] = [
    { name: 'Array', slug: 'array' },
  ],
) {
  return Response.json({
    data: {
      question: {
        title: 'Two Sum',
        questionFrontendId: '1',
        difficulty: 'Easy',
        isPaidOnly: false,
        topicTags,
      },
    },
  })
}

function renderProblemHeader() {
  document.body.innerHTML = '<main><h1>1. Two Sum</h1><span>Easy</span></main>'
}

function renderProblemEditorPage() {
  document.body.innerHTML = `
    <main>
      <h1>1. Two Sum</h1>
      <button data-cy="lang-select">Python3</button>
      <div class="view-lines">
        <div class="view-line">class Solution:</div>
        <div class="view-line">    pass</div>
      </div>
      <button data-e2e-locator="console-submit-button">Submit</button>
    </main>
  `
}

function dispatchSubmitClick() {
  const submitButton = document.querySelector(
    '[data-e2e-locator="console-submit-button"]',
  )

  expect(submitButton).not.toBeNull()
  submitButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function appendAcceptedSubmissionResult(options: {
  runtime: string
  memory?: string | undefined
  includeCode?: boolean | undefined
}) {
  document.querySelector('main')?.insertAdjacentHTML(
    'beforeend',
    `
      <section data-e2e-locator="submission-result">
        <h3>Accepted</h3>
        <span>Runtime ${options.runtime}</span>
        <span>Memory ${options.memory ?? '18 MB'}</span>
        <span>58 / 58 testcases passed</span>
        ${
          options.includeCode === false
            ? ''
            : `<h3>Code | Python3</h3>
              <pre>class Solution:
    pass</pre>`
        }
      </section>
    `,
  )
}

function appendRuntimeErrorSubmissionResult() {
  document.querySelector('main')?.insertAdjacentHTML(
    'beforeend',
    `
      <section data-e2e-locator="submission-result">
        <h3>Runtime Error</h3>
      </section>
    `,
  )
}

function findEvent<TEventType extends LeetCodePageEvent['type']>(
  events: LeetCodePageEvent[],
  type: TEventType,
) {
  return events.find(
    (event): event is Extract<LeetCodePageEvent, { type: TEventType }> =>
      event.type === type,
  )
}

function filterEvents<TEventType extends LeetCodePageEvent['type']>(
  events: LeetCodePageEvent[],
  type: TEventType,
) {
  return events.filter(
    (event): event is Extract<LeetCodePageEvent, { type: TEventType }> =>
      event.type === type,
  )
}

function readSubmissionPollingPhases(events: LeetCodePageEvent[]) {
  return filterEvents(events, 'submission-polling-updated').map(
    (event) => event.debug.phase,
  )
}
