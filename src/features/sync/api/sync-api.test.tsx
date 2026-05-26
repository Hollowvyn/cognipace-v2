import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { queryKeys } from '@/platform/query/query-keys'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import {
  connectGithubGistViaRuntime,
  pullLatestViaRuntime,
  pushLocalViaRuntime,
  saveGithubTokenViaRuntime,
  useSyncAction,
} from './sync-api'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('sync API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  it('sends manual pull through the directional runtime boundary', async () => {
    vi.mocked(sendMessage).mockResolvedValue(syncActionResult)

    await pullLatestViaRuntime()

    expect(sendMessage).toHaveBeenCalledWith('sync.pullLatest', {
      surface: 'dashboard',
    })
  })

  it('sends manual push through the directional runtime boundary', async () => {
    vi.mocked(sendMessage).mockResolvedValue(syncActionResult)

    await pushLocalViaRuntime({ confirmRemoteOverwrite: true })

    expect(sendMessage).toHaveBeenCalledWith('sync.pushLocal', {
      surface: 'dashboard',
      confirmRemoteOverwrite: true,
    })
  })

  it('refreshes sync status after failed actions', async () => {
    const { queryClient, wrapper } = createQueryTestHarness()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(
      () =>
        useSyncAction(() => {
          return Promise.reject(new Error('GitHub unavailable.'))
        }),
      { wrapper },
    )

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow(
        'GitHub unavailable.',
      )
    })

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.sync.all,
    })
  })

  it('broad-invalidates local data views for actions that may pull remote data', async () => {
    const { queryClient, wrapper } = createQueryTestHarness()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(
      () =>
        useSyncAction((gistId: string) => Promise.resolve({ gistId }), {
          invalidateData: true,
        }),
      { wrapper },
    )

    await act(async () => {
      await result.current.mutateAsync('gist_1')
    })

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.settings.all,
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.problems.all,
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.appShell.all,
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.sync.all,
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
    lastPullAt: null,
    lastPushAt: null,
    needsPush: false,
    lastBlockingReason: null,
    lastError: null,
    conflict: null,
  },
  action: 'set-enabled',
  direction: null,
  outcome: 'success',
  reason: null,
  retryable: false,
  occurredAt: '2026-05-26T12:00:00.000Z',
} as const
