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

  it('emits submit-clicked without saving a review', async () => {
    vi.useFakeTimers()
    document.body.innerHTML = `
      <main>
        <h1>1. Two Sum</h1>
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
  })
})
