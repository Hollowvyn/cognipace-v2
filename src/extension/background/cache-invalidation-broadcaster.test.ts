import { beforeEach, describe, expect, it, vi } from 'vitest'

import { broadcastCacheInvalidation } from './cache-invalidation-broadcaster'

type LeetCodeTab = { id?: number | undefined }

type TabsQuery = (queryInfo: { url: string[] }) => Promise<LeetCodeTab[]>

type RuntimeSendMessage =
  (typeof import('@/extension/messaging'))['sendMessage']

const browserMocks = vi.hoisted(() => ({
  tabsQuery: vi.fn<TabsQuery>(),
}))

const messagingMocks = vi.hoisted(() => ({
  sendMessage: vi.fn<RuntimeSendMessage>(),
}))

vi.mock('wxt/browser', () => ({
  browser: {
    tabs: {
      query: browserMocks.tabsQuery,
    },
  },
}))

vi.mock('@/extension/messaging', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/extension/messaging')>()

  return {
    ...actual,
    sendMessage: messagingMocks.sendMessage,
  }
})

describe('cache invalidation broadcaster', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    messagingMocks.sendMessage.mockResolvedValue(null)
    browserMocks.tabsQuery.mockResolvedValue([{ id: 10 }, { id: 20 }, {}])
  })

  it('broadcasts typed cache invalidation events to extension pages and LeetCode tabs', async () => {
    const event = await broadcastCacheInvalidation({
      problemSlug: 'two-sum',
      reason: 'practice-updated',
      source: 'content-script',
      tags: ['practice', 'queue', 'app-shell'],
    })

    expect(event).toMatchObject({
      problemSlug: 'two-sum',
      reason: 'practice-updated',
      source: 'content-script',
      tags: ['practice', 'queue', 'app-shell'],
    })

    expect(messagingMocks.sendMessage).toHaveBeenCalledWith(
      'cache.invalidate',
      expect.objectContaining({
        reason: 'practice-updated',
        tags: ['practice', 'queue', 'app-shell'],
      }),
    )
    expect(browserMocks.tabsQuery).toHaveBeenCalledWith({
      url: [
        'https://leetcode.com/problems/*',
        'https://www.leetcode.com/problems/*',
      ],
    })
    expect(messagingMocks.sendMessage).toHaveBeenCalledWith(
      'cache.invalidate',
      expect.objectContaining({
        reason: 'practice-updated',
        tags: ['practice', 'queue', 'app-shell'],
      }),
      10,
    )
    expect(messagingMocks.sendMessage).toHaveBeenCalledWith(
      'cache.invalidate',
      expect.objectContaining({
        reason: 'practice-updated',
        tags: ['practice', 'queue', 'app-shell'],
      }),
      20,
    )
  })

  it('does not fail the source mutation when no surface can receive the event', async () => {
    messagingMocks.sendMessage.mockRejectedValue(new Error('No receiver'))
    browserMocks.tabsQuery.mockRejectedValueOnce(
      new Error('Missing tabs access'),
    )

    await expect(
      broadcastCacheInvalidation({
        reason: 'settings-updated',
        source: 'popup',
        tags: ['settings'],
      }),
    ).resolves.toMatchObject({
      reason: 'settings-updated',
    })
  })
})
