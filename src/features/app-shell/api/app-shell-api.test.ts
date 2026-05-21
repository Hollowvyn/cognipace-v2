import { describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'

import {
  appShellQueryKeys,
  getOverlayAppShellDataViaRuntime,
  getPopupAppShellDataViaRuntime,
} from './app-shell-api'
import type { AppShellData } from './app-shell-contracts'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('app-shell runtime API', () => {
  it('uses explicit query keys for each surface', () => {
    expect(appShellQueryKeys.popup()).toEqual(['app-shell-data', 'popup'])
    expect(appShellQueryKeys.dashboard()).toEqual([
      'app-shell-data',
      'dashboard',
    ])
    expect(appShellQueryKeys.overlay('two-sum')).toEqual([
      'app-shell-data',
      'overlay',
      'two-sum',
    ])
    expect(appShellQueryKeys.overlay()).toEqual([
      'app-shell-data',
      'overlay',
      null,
    ])
  })

  it('reads overlay app-shell data with the optional problem slug', async () => {
    const payload = { surface: 'overlay' } as AppShellData
    vi.mocked(sendMessage).mockResolvedValueOnce(payload)

    await expect(getOverlayAppShellDataViaRuntime('two-sum')).resolves.toBe(
      payload,
    )
    expect(sendMessage).toHaveBeenCalledWith('app.getShellData', {
      surface: 'overlay',
      problemSlug: 'two-sum',
    })
  })

  it('rejects an unexpected surface at the client boundary', async () => {
    const payload = {
      surface: 'dashboard',
    } as AppShellData
    vi.mocked(sendMessage).mockResolvedValueOnce(payload)

    await expect(getPopupAppShellDataViaRuntime()).rejects.toThrow(
      'Expected popup app-shell data.',
    )
  })
})
