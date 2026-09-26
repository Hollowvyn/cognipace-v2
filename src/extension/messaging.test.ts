import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest'
import type { Browser } from 'wxt/browser'

import { onMessage, sendMessage, type PingResponse } from './messaging'

type RuntimeListener = (
  message: unknown,
  sender: Browser.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => boolean

describe('extension messaging transport', () => {
  const listeners = new Set<RuntimeListener>()
  const cleanup: (() => void)[] = []
  const sender = {
    id: 'cognipace-test',
    url: 'chrome-extension://cognipace-test/popup.html',
  }

  beforeEach(() => {
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: {
          addListener: (listener: RuntimeListener) => listeners.add(listener),
          removeListener: (listener: RuntimeListener) =>
            listeners.delete(listener),
        },
        sendMessage: (
          message: unknown,
          respond: (response: unknown) => void,
        ) => {
          for (const listener of listeners) {
            listener(message, sender, respond)
          }
        },
      },
    })
  })

  afterEach(() => {
    cleanup.splice(0).forEach((remove) => remove())
    vi.unstubAllGlobals()
  })

  it('round-trips a typed response and preserves the actual Chrome sender', async () => {
    cleanup.push(
      onMessage('runtime.ping', (message) => {
        expect(message.sender).toEqual(sender)
        return Promise.resolve({
          ok: true as const,
          surface: message.data.surface,
          receivedAt: '2026-09-26T12:00:00.000Z',
        })
      }),
    )

    const response = await sendMessage('runtime.ping', { surface: 'popup' })

    expectTypeOf(response).toEqualTypeOf<PingResponse>()
    expect(response).toEqual({
      ok: true,
      surface: 'popup',
      receivedAt: '2026-09-26T12:00:00.000Z',
    })
  })

  it('rejects the caller when the receiving handler fails', async () => {
    cleanup.push(
      onMessage('runtime.ping', () => {
        throw new Error('Sender is not authorized')
      }),
    )

    await expect(
      sendMessage('runtime.ping', { surface: 'popup' }),
    ).rejects.toThrow('Sender is not authorized')
  })

  it('targets a content-script tab using the Chrome callback transport', async () => {
    const sendToTab = vi.fn(
      (
        _tabId: number,
        _message: unknown,
        _options: unknown,
        respond: (response: unknown) => void,
      ) => respond({ res: null }),
    )
    vi.stubGlobal('chrome', { tabs: { sendMessage: sendToTab } })
    const event = {
      emittedAt: '2026-09-26T12:00:00.000Z',
      reason: 'practice-updated' as const,
      source: 'dashboard' as const,
      tags: ['practice'] as const,
    }

    await expect(
      sendMessage('cache.invalidate', { ...event, tags: [...event.tags] }, 42),
    ).resolves.toBeNull()
    expect(sendToTab).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ type: 'cache.invalidate', data: event }),
      undefined,
      expect.any(Function),
    )
  })

  it('rejects a Chrome runtime transport failure', async () => {
    vi.stubGlobal('chrome', {
      runtime: {
        lastError: { message: 'Extension context invalidated' },
        sendMessage: (
          _message: unknown,
          respond: (response?: unknown) => void,
        ) => respond(),
      },
    })

    await expect(
      sendMessage('runtime.ping', { surface: 'popup' }),
    ).rejects.toThrow('Extension context invalidated')
  })
})
