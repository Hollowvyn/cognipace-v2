import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { queryKeys } from '@/platform/query/query-keys'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { useGithubSyncController } from './use-github-sync-controller'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('useGithubSyncController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('broad-invalidates cached views when connecting a Gist pulls remote data successfully', async () => {
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'sync.getStatus') {
        return Promise.resolve(configuredStatus)
      }

      if (method === 'sync.connectGithubGist') {
        return Promise.resolve({
          ...syncActionResult,
          action: 'connect-gist',
          direction: 'pull',
          outcome: 'success',
        })
      }

      return Promise.reject(new Error(`Unexpected method ${method}`))
    })
    const { queryClient, wrapper } = createQueryTestHarness()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useGithubSyncController(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toEqual(configuredStatus)
    })

    await act(async () => {
      await result.current.actions.onConnectGist('gist_1')
    })

    expect(sendMessage).toHaveBeenCalledWith('sync.connectGithubGist', {
      surface: 'dashboard',
      gistId: 'gist_1',
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

  it('does not broad-invalidate cached views when connecting a Gist does not pull successfully', async () => {
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'sync.getStatus') {
        return Promise.resolve(configuredStatus)
      }

      if (method === 'sync.connectGithubGist') {
        return Promise.resolve({
          ...syncActionResult,
          action: 'connect-gist',
          direction: null,
          outcome: 'no-change',
        })
      }

      return Promise.reject(new Error(`Unexpected method ${method}`))
    })
    const { queryClient, wrapper } = createQueryTestHarness()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useGithubSyncController(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toEqual(configuredStatus)
    })

    await act(async () => {
      await result.current.actions.onConnectGist('gist_1')
    })

    expect(sendMessage).toHaveBeenCalledWith('sync.connectGithubGist', {
      surface: 'dashboard',
      gistId: 'gist_1',
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.sync.all,
    })
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: queryKeys.settings.all,
    })
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: queryKeys.appShell.all,
    })
  })

  it('broad-invalidates cached views for successful pulls but only refreshes sync status for pushes', async () => {
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'sync.getStatus') {
        return Promise.resolve(configuredStatus)
      }

      if (method === 'sync.pullLatest') {
        return Promise.resolve({
          ...syncActionResult,
          action: 'pull-latest',
          direction: 'pull',
          outcome: 'success',
        })
      }

      if (method === 'sync.pushLocal') {
        return Promise.resolve({
          ...syncActionResult,
          action: 'push-local',
          direction: 'push',
          outcome: 'success',
        })
      }

      return Promise.reject(new Error(`Unexpected method ${method}`))
    })
    const { queryClient, wrapper } = createQueryTestHarness()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useGithubSyncController(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toEqual(configuredStatus)
    })

    await act(async () => {
      await result.current.actions.onPullLatest()
    })

    expect(sendMessage).toHaveBeenCalledWith('sync.pullLatest', {
      surface: 'dashboard',
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.settings.all,
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.appShell.all,
    })

    invalidateQueries.mockClear()

    await act(async () => {
      await result.current.actions.onPushLocal(true)
    })

    expect(sendMessage).toHaveBeenCalledWith('sync.pushLocal', {
      surface: 'dashboard',
      confirmRemoteOverwrite: true,
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.sync.all,
    })
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: queryKeys.settings.all,
    })
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: queryKeys.appShell.all,
    })
  })
})

const configuredStatus = {
  enabled: true,
  configured: true,
  tokenConfigured: true,
  tokenStatus: {
    provider: 'github:gist',
    configured: true,
    updatedAt: '2026-05-26T12:00:00.000Z',
    fingerprint: 'abcdef123456',
  },
  gistId: 'gist_1',
  isSyncing: false,
  lastSyncAt: '2026-05-26T12:00:00.000Z',
  lastSyncDirection: 'push',
  lastPullAt: null,
  lastPushAt: '2026-05-26T12:00:00.000Z',
  needsPush: false,
  lastBlockingReason: null,
  lastError: null,
  conflict: null,
} as const

const syncActionResult = {
  action: 'connect-gist',
  direction: null,
  outcome: 'success',
  reason: null,
  retryable: false,
  message: 'GitHub Gist connected and pulled.',
  status: configuredStatus,
  occurredAt: '2026-05-26T12:00:00.000Z',
} as const
