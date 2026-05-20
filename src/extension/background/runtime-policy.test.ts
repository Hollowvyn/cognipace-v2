import { describe, expect, it } from 'vitest'

import {
  assertCanCallExtensionMethod,
  assertCanSenderCallExtensionMethod,
  canCallExtensionMethod,
  getMessageSenderSurface,
  isExtensionMethod,
} from './runtime-policy'

describe('runtime-policy', () => {
  it('allows popup shell data reads', () => {
    expect(canCallExtensionMethod('app.getShellData', 'popup')).toBe(true)
  })

  it('rejects unknown methods', () => {
    expect(isExtensionMethod('unknown.method')).toBe(false)
    expect(canCallExtensionMethod('unknown.method', 'popup')).toBe(false)
  })

  it('throws for unauthorized surfaces', () => {
    expect(() =>
      assertCanCallExtensionMethod('app.getShellData', 'background'),
    ).toThrow(/not allowed/)
  })

  it('resolves extension page surfaces from sender URLs', () => {
    expect(
      getMessageSenderSurface({
        url: 'chrome-extension://extension-id/popup.html',
      }),
    ).toBe('popup')

    expect(
      getMessageSenderSurface({
        url: 'chrome-extension://extension-id/dashboard.html',
      }),
    ).toBe('dashboard')
  })

  it('resolves content scripts from tab-backed senders', () => {
    expect(
      getMessageSenderSurface({
        tab: { id: 7 },
        url: 'https://leetcode.com/problems/two-sum/',
      }),
    ).toBe('content-script')
  })

  it('prefers extension page URLs over tab presence for dashboard pages', () => {
    expect(
      getMessageSenderSurface({
        tab: { id: 7 },
        url: 'chrome-extension://extension-id/dashboard.html',
      }),
    ).toBe('dashboard')
  })

  it('rejects content scripts claiming privileged extension surfaces', () => {
    expect(() =>
      assertCanSenderCallExtensionMethod('settings.updateSettings', 'popup', {
        tab: { id: 7 },
        url: 'https://leetcode.com/problems/two-sum/',
      }),
    ).toThrow(/cannot claim/)
  })

  it('allows dashboard senders to update settings', () => {
    expect(() =>
      assertCanSenderCallExtensionMethod(
        'settings.updateSettings',
        'dashboard',
        {
          url: 'chrome-extension://extension-id/dashboard.html',
        },
      ),
    ).not.toThrow()
  })

  it('allows content scripts to use practice controls for the current problem', () => {
    expect(() =>
      assertCanSenderCallExtensionMethod(
        'practice.setSuspended',
        'content-script',
        {
          tab: { id: 7 },
          url: 'https://leetcode.com/problems/two-sum/',
        },
      ),
    ).not.toThrow()
    expect(() =>
      assertCanSenderCallExtensionMethod(
        'practice.resetSchedule',
        'content-script',
        {
          tab: { id: 7 },
          url: 'https://leetcode.com/problems/two-sum/',
        },
      ),
    ).not.toThrow()
  })
})
