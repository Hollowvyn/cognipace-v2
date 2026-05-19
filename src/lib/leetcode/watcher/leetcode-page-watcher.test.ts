import { afterEach, describe, expect, it, vi } from 'vitest'

import type { LeetCodePageEvent } from '../domain/types'
import { createLeetCodePageWatcher } from './leetcode-page-watcher'

describe('createLeetCodePageWatcher', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits page and metadata events for a LeetCode problem page', async () => {
    vi.useFakeTimers()
    document.body.innerHTML =
      '<main><h1>1. Two Sum</h1><span>Easy</span></main>'
    const events: LeetCodePageEvent[] = []
    const fetcher = vi.fn(() =>
      Promise.resolve(
        Response.json({
          data: {
            question: {
              title: 'Two Sum',
              questionFrontendId: '1',
              difficulty: 'Easy',
              isPaidOnly: false,
              topicTags: [{ name: 'Array', slug: 'array' }],
            },
          },
        }),
      ),
    )
    const watcher = createLeetCodePageWatcher({
      getCurrentUrl: () => 'https://leetcode.com/problems/two-sum/',
      hydrationDelays: [0],
      onEvent: (event) => events.push(event),
      fetch: fetcher,
      now: () => 1000,
    })

    watcher.start()
    await vi.runAllTimersAsync()
    watcher.stop()

    expect(events.map((event) => event.type)).toEqual([
      'page-changed',
      'page-ready',
      'metadata-updated',
    ])
    expect(events[1]).toMatchObject({
      type: 'page-ready',
      location: { slug: 'two-sum' },
      pageReadyAt: 1000,
      metadata: { title: 'Two Sum', source: 'graphql' },
    })
  })

  it('emits problem content when LeetCode content is readable', async () => {
    vi.useFakeTimers()
    document.body.innerHTML =
      '<main><h1>1. Two Sum</h1><span>Easy</span></main>'
    const events: LeetCodePageEvent[] = []
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
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

      return Promise.resolve(
        Response.json({
          data: {
            question: {
              title: 'Two Sum',
              questionFrontendId: '1',
              difficulty: 'Easy',
              isPaidOnly: false,
              topicTags: [{ name: 'Array', slug: 'array' }],
            },
          },
        }),
      )
    })
    const watcher = createLeetCodePageWatcher({
      getCurrentUrl: () => 'https://leetcode.com/problems/two-sum/',
      hydrationDelays: [0],
      onEvent: (event) => events.push(event),
      fetch: fetcher,
      now: () => 1000,
    })

    watcher.start()
    await vi.runAllTimersAsync()
    watcher.stop()

    const contentEvent = events.find(
      (
        event,
      ): event is Extract<
        LeetCodePageEvent,
        { type: 'problem-content-updated' }
      > => event.type === 'problem-content-updated',
    )

    expect(contentEvent?.location.slug).toBe('two-sum')
    expect(contentEvent?.content).toMatchObject({
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
    })
  })

  it('emits page changes when the active slug changes', async () => {
    vi.useFakeTimers()
    let url = 'https://leetcode.com/problems/two-sum/'
    const events: LeetCodePageEvent[] = []
    const watcher = createLeetCodePageWatcher({
      getCurrentUrl: () => url,
      hydrationDelays: [0],
      onEvent: (event) => events.push(event),
      fetch: () => Promise.resolve(new Response('', { status: 500 })),
    })

    watcher.start()
    await vi.runAllTimersAsync()
    url = 'https://leetcode.com/problems/valid-parentheses/'
    watcher.refresh()
    await vi.runAllTimersAsync()
    watcher.stop()

    expect(
      events
        .filter((event) => event.type === 'page-changed')
        .map((event) => event.location.slug),
    ).toEqual(['two-sum', 'valid-parentheses'])
  })

  it('does not schedule full hydration refreshes for noisy same-page mutations', async () => {
    vi.useFakeTimers()
    document.body.innerHTML =
      '<main><h1>1. Two Sum</h1><span>Easy</span></main>'
    const events: LeetCodePageEvent[] = []
    const fetcher = vi.fn(() =>
      Promise.resolve(
        Response.json({
          data: {
            question: {
              title: 'Two Sum',
              questionFrontendId: '1',
              difficulty: 'Easy',
              isPaidOnly: false,
              topicTags: [],
            },
          },
        }),
      ),
    )
    const watcher = createLeetCodePageWatcher({
      getCurrentUrl: () => 'https://leetcode.com/problems/two-sum/',
      hydrationDelays: [0],
      onEvent: (event) => events.push(event),
      fetch: fetcher,
      mutationRefreshDebounceMs: 100,
      samePageSnapshotRefreshCooldownMs: 4000,
    })

    watcher.start()
    await vi.runOnlyPendingTimersAsync()

    document.body.append(document.createElement('div'))
    document.body.append(document.createElement('section'))
    document.body.append(document.createElement('aside'))
    await vi.advanceTimersByTimeAsync(1000)

    watcher.stop()

    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('emits submit-clicked without saving a review', async () => {
    vi.useFakeTimers()
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
    const events: LeetCodePageEvent[] = []
    const watcher = createLeetCodePageWatcher({
      getCurrentUrl: () => 'https://leetcode.com/problems/two-sum/',
      hydrationDelays: [0],
      onEvent: (event) => events.push(event),
      fetch: () => Promise.resolve(new Response('', { status: 500 })),
      now: () => 2000,
    })

    watcher.start()
    await vi.runAllTimersAsync()
    document
      .querySelector('[data-e2e-locator="console-submit-button"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    watcher.stop()

    expect(events).toContainEqual({
      type: 'submit-clicked',
      click: {
        location: {
          slug: 'two-sum',
          url: 'https://leetcode.com/problems/two-sum/',
          host: 'leetcode.com',
        },
        clickedAt: 2000,
        buttonText: 'Submit',
      },
    })
    expect(events).toContainEqual({
      type: 'submission-started',
      attempt: {
        location: {
          slug: 'two-sum',
          url: 'https://leetcode.com/problems/two-sum/',
          host: 'leetcode.com',
        },
        clickedAt: 2000,
        submitButtonText: 'Submit',
        submittedCodeSnapshot: {
          code: 'class Solution:\n    pass',
          language: 'Python3',
          source: 'monaco',
          capturedAt: 2000,
        },
      },
    })
  })

  it('emits submission-result-updated after LeetCode renders the result', async () => {
    vi.useFakeTimers()
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
    const events: LeetCodePageEvent[] = []
    const watcher = createLeetCodePageWatcher({
      getCurrentUrl: () => 'https://leetcode.com/problems/two-sum/',
      hydrationDelays: [0],
      submissionResultReadDelays: [0],
      domSubmissionResultFallbackDelayMs: 0,
      onEvent: (event) => events.push(event),
      fetch: () => Promise.resolve(new Response('', { status: 500 })),
      now: () => 3000,
    })

    watcher.start()
    await vi.runAllTimersAsync()
    document
      .querySelector('[data-e2e-locator="console-submit-button"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    document.querySelector('main')?.insertAdjacentHTML(
      'beforeend',
      `
        <section data-e2e-locator="submission-result">
          <h3>Accepted</h3>
          <span>Runtime 8 ms</span>
          <span>Memory 17.4 MB</span>
          <span>58 / 58 testcases passed</span>
          <h3>Code | Python3</h3>
          <pre>class Solution:
    pass</pre>
        </section>
      `,
    )
    await vi.runAllTimersAsync()
    watcher.stop()

    expect(events).toContainEqual({
      type: 'submission-result-updated',
      result: {
        location: {
          slug: 'two-sum',
          url: 'https://leetcode.com/problems/two-sum/',
          host: 'leetcode.com',
        },
        submissionId: null,
        source: 'dom',
        status: 'accepted',
        statusText: 'Accepted',
        checkedAt: 3000,
        runtime: '8 ms',
        memory: '17.4 MB',
        passedTestCount: 58,
        totalTestCount: 58,
        failingTestcase: null,
        errorMessage: null,
        resultCodeSnapshot: {
          code: 'class Solution:\n    pass',
          language: 'Python3',
          source: 'code-block',
          capturedAt: 3000,
        },
      },
    })
  })

  it('emits API submission details after LeetCode finishes judging', async () => {
    vi.useFakeTimers()
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
    const events: LeetCodePageEvent[] = []
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const requestUrl = readRequestUrl(input)

      if (requestUrl.includes('/api/submissions/two-sum/')) {
        return Promise.resolve(
          Response.json({
            submission_list: [
              {
                id: '1234567890',
                timestamp: 5,
                status_display: 'Accepted',
              },
            ],
          }),
        )
      }

      if (requestUrl.includes('/submissions/detail/1234567890/check/')) {
        return Promise.resolve(
          Response.json({
            state: 'SUCCESS',
            status_code: 10,
            status_msg: 'Accepted',
            status_runtime: '4 ms',
            status_memory: '20.62 MB',
            total_correct: 63,
            total_testcases: 63,
          }),
        )
      }

      if (requestUrl.endsWith('/graphql')) {
        return Promise.resolve(
          Response.json({
            data: {
              submissionDetails: {
                statusCode: 10,
                statusDisplay: 'Accepted',
                runtimeDisplay: '4 ms',
                memoryDisplay: '20.62 MB',
                totalCorrect: 63,
                totalTestcases: 63,
                code: 'class Solution:\n    def twoSum(self):\n        return []',
                lang: { verboseName: 'Python3' },
              },
            },
          }),
        )
      }

      return Promise.resolve(new Response('', { status: 500 }))
    })
    const watcher = createLeetCodePageWatcher({
      getCurrentUrl: () => 'https://leetcode.com/problems/two-sum/',
      hydrationDelays: [],
      submissionResultReadDelays: [0],
      onEvent: (event) => events.push(event),
      fetch: fetcher,
      now: () => 5000,
    })

    watcher.start()
    document
      .querySelector('[data-e2e-locator="console-submit-button"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await vi.runAllTimersAsync()
    watcher.stop()

    expect(events).toContainEqual({
      type: 'submission-result-updated',
      result: {
        location: {
          slug: 'two-sum',
          url: 'https://leetcode.com/problems/two-sum/',
          host: 'leetcode.com',
        },
        submissionId: '1234567890',
        source: 'api',
        status: 'accepted',
        statusText: 'Accepted',
        checkedAt: 5000,
        runtime: '4 ms',
        memory: '20.62 MB',
        passedTestCount: 63,
        totalTestCount: 63,
        failingTestcase: null,
        errorMessage: null,
        resultCodeSnapshot: {
          code: 'class Solution:\n    def twoSum(self):\n        return []',
          language: 'Python3',
          source: 'api',
          capturedAt: 5000,
        },
      },
    })
  })

  it('keeps waiting instead of emitting DOM fallback while API polling is active', async () => {
    vi.useFakeTimers()
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
    const events: LeetCodePageEvent[] = []
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const requestUrl = readRequestUrl(input)

      if (requestUrl.includes('/api/submissions/two-sum/')) {
        return Promise.resolve(
          Response.json({
            submission_list: [
              {
                id: '1234567890',
                timestamp: 5,
                status_display: 'Runtime Error',
              },
            ],
          }),
        )
      }

      if (requestUrl.includes('/submissions/detail/1234567890/check/')) {
        return Promise.resolve(
          Response.json({
            state: 'PENDING',
            status_msg: 'Pending',
          }),
        )
      }

      return Promise.resolve(new Response('', { status: 500 }))
    })
    const watcher = createLeetCodePageWatcher({
      getCurrentUrl: () => 'https://leetcode.com/problems/two-sum/',
      hydrationDelays: [],
      submissionResultReadDelays: [0],
      onEvent: (event) => events.push(event),
      fetch: fetcher,
      now: () => 5000,
    })

    watcher.start()
    document
      .querySelector('[data-e2e-locator="console-submit-button"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    document.querySelector('main')?.insertAdjacentHTML(
      'beforeend',
      `
        <section data-e2e-locator="submission-result">
          <h3>Runtime Error</h3>
        </section>
      `,
    )
    await vi.runAllTimersAsync()
    watcher.stop()

    expect(
      events.some((event) => event.type === 'submission-result-updated'),
    ).toBe(false)
  })

  it('stops polling after an API submission result is emitted', async () => {
    vi.useFakeTimers()
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
    let currentTime = 5000
    const events: LeetCodePageEvent[] = []
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const requestUrl = readRequestUrl(input)

      if (requestUrl.includes('/api/submissions/two-sum/')) {
        return Promise.resolve(
          Response.json({
            submission_list: [
              {
                id: '1234567890',
                timestamp: 5,
                status_display: 'Accepted',
              },
            ],
          }),
        )
      }

      if (requestUrl.includes('/submissions/detail/1234567890/check/')) {
        return Promise.resolve(
          Response.json({
            state: 'SUCCESS',
            status_code: 10,
            status_msg: 'Accepted',
            status_runtime: '4 ms',
            status_memory: '20.62 MB',
            total_correct: 63,
            total_testcases: 63,
          }),
        )
      }

      if (requestUrl.endsWith('/graphql')) {
        return Promise.resolve(
          Response.json({
            data: {
              submissionDetails: {
                statusCode: 10,
                statusDisplay: 'Accepted',
                runtimeDisplay: '4 ms',
                memoryDisplay: '20.62 MB',
                totalCorrect: 63,
                totalTestcases: 63,
                code: 'class Solution:\n    pass',
                lang: { verboseName: 'Python3' },
              },
            },
          }),
        )
      }

      return Promise.resolve(new Response('', { status: 500 }))
    })
    const watcher = createLeetCodePageWatcher({
      getCurrentUrl: () => 'https://leetcode.com/problems/two-sum/',
      hydrationDelays: [],
      submissionResultReadDelays: [0, 1000, 2000],
      onEvent: (event) => events.push(event),
      fetch: fetcher,
      now: () => currentTime,
    })

    watcher.start()
    document
      .querySelector('[data-e2e-locator="console-submit-button"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(0)

    expect(
      events.filter((event) => event.type === 'submission-result-updated'),
    ).toHaveLength(1)
    expect(fetcher).toHaveBeenCalledTimes(3)

    currentTime = 8000
    await vi.advanceTimersByTimeAsync(3000)
    watcher.stop()

    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(
      events.filter((event) => event.type === 'submission-result-updated'),
    ).toHaveLength(1)
  })

  it('reads the submission result when LeetCode updates the page after submit', async () => {
    vi.useFakeTimers()
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
    const events: LeetCodePageEvent[] = []
    const watcher = createLeetCodePageWatcher({
      getCurrentUrl: () => 'https://leetcode.com/problems/two-sum/',
      hydrationDelays: [0],
      submissionResultReadDelays: [10000],
      domSubmissionResultFallbackDelayMs: 0,
      mutationRefreshDebounceMs: 100,
      onEvent: (event) => events.push(event),
      fetch: () => Promise.resolve(new Response('', { status: 500 })),
      now: () => 4000,
    })

    watcher.start()
    await vi.runOnlyPendingTimersAsync()
    document
      .querySelector('[data-e2e-locator="console-submit-button"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    document.querySelector('main')?.insertAdjacentHTML(
      'beforeend',
      `
        <section data-e2e-locator="submission-result">
          <h3>Accepted</h3>
          <span>Runtime 11 ms</span>
          <span>Memory 18 MB</span>
          <span>58 / 58 testcases passed</span>
        </section>
      `,
    )
    await vi.advanceTimersByTimeAsync(100)
    watcher.stop()

    expect(
      events.some(
        (event) =>
          event.type === 'submission-result-updated' &&
          event.result.status === 'accepted' &&
          event.result.runtime === '11 ms',
      ),
    ).toBe(true)
  })
})

function readRequestUrl(input: RequestInfo | URL) {
  if (input instanceof URL) {
    return input.toString()
  }

  if (typeof input === 'string') {
    return input
  }

  return input.url
}
