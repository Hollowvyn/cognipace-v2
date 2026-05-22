import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CacheInvalidationEvent } from '@/extension/messaging'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { CacheInvalidationListener } from './cache-invalidation-listener'

type CacheInvalidationMessage = {
  data: CacheInvalidationEvent
  sender: { id: string }
}

type CacheInvalidationHandler = (message: CacheInvalidationMessage) => null

type OnCacheInvalidationMessage = (
  method: 'cache.invalidate',
  handler: CacheInvalidationHandler,
) => () => void

const messagingMocks = vi.hoisted(() => ({
  onMessage: vi.fn<OnCacheInvalidationMessage>(),
}))

vi.mock('@/extension/messaging', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/extension/messaging')>()

  return {
    ...actual,
    onMessage: messagingMocks.onMessage,
  }
})

describe('CacheInvalidationListener', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    messagingMocks.onMessage.mockReturnValue(() => undefined)
  })

  it('invalidates local TanStack Query caches for background cache events', async () => {
    const { queryClient, wrapper } = createQueryTestHarness()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

    render(<CacheInvalidationListener />, { wrapper })

    const handler = messagingMocks.onMessage.mock.calls[0]?.[1]
    expect(handler).toBeDefined()

    if (!handler) {
      throw new Error('Expected cache invalidation handler to be registered.')
    }

    handler({
      data: {
        emittedAt: '2026-01-01T10:00:00.000Z',
        reason: 'practice-updated',
        source: 'content-script',
        tags: ['practice', 'queue', 'app-shell'],
      },
      sender: { id: 'extension-id' },
    })

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['practice-details'],
      })
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['today-queue'],
      })
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['app-shell-data'],
      })
    })
  })
})
