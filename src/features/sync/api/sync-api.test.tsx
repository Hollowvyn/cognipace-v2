import { describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'

import {
  checkSyncOnOpenViaRuntime,
  connectGithubGistViaRuntime,
  saveGithubTokenViaRuntime,
} from './sync-api'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('sync API', () => {
  it('sends token saves through the dashboard runtime boundary', async () => {
    vi.mocked(sendMessage).mockResolvedValue(syncActionResult)

    await saveGithubTokenViaRuntime('ghp_secret')

    expect(sendMessage).toHaveBeenCalledWith('sync.saveGithubToken', {
      surface: 'dashboard',
      token: 'ghp_secret',
    })
  })

  it('sends existing Gist connection through the runtime boundary', async () => {
    vi.mocked(sendMessage).mockResolvedValue(syncActionResult)

    await connectGithubGistViaRuntime('gist_1')

    expect(sendMessage).toHaveBeenCalledWith('sync.connectGithubGist', {
      surface: 'dashboard',
      gistId: 'gist_1',
    })
  })

  it('allows safe sync checks from non-dashboard surfaces', async () => {
    vi.mocked(sendMessage).mockResolvedValue(null)

    await checkSyncOnOpenViaRuntime('content-script')

    expect(sendMessage).toHaveBeenCalledWith('sync.checkOnOpen', {
      surface: 'content-script',
    })
  })
})

const syncActionResult = {
  message: 'GitHub sync updated.',
  status: {
    enabled: false,
    configured: false,
    tokenConfigured: false,
    tokenStatus: {
      provider: 'github:gist',
      configured: false,
      updatedAt: null,
      fingerprint: null,
    },
    gistId: null,
    isSyncing: false,
    lastSyncAt: null,
    lastSyncDirection: null,
    lastError: null,
    conflict: null,
  },
} as const
