import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SyncActionResult } from '@/features/sync/api/sync-contracts'
import { queryKeys } from '@/platform/query/query-keys'

import { SyncOpenCheck } from './sync-open-check'

const checkRemoteOnOpen =
  vi.fn<(surface: 'popup') => Promise<SyncActionResult>>()

vi.mock('@/features/sync/api/sync-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/sync/api/sync-api')>()

  return {
    ...actual,
    checkRemoteOnOpenViaRuntime: (surface: 'popup') =>
      checkRemoteOnOpen(surface),
  }
})

describe('SyncOpenCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs the safe remote check once for the mounted surface', async () => {
    checkRemoteOnOpen.mockResolvedValue(syncOpenCheckResult)

    renderWithQueryClient(<SyncOpenCheck surface="popup" />)

    await waitFor(() => {
      expect(checkRemoteOnOpen).toHaveBeenCalledTimes(1)
    })
    expect(checkRemoteOnOpen).toHaveBeenCalledWith('popup')
  })

  it('does not duplicate the open check during StrictMode effect probing', async () => {
    checkRemoteOnOpen.mockResolvedValue(syncOpenCheckResult)

    renderWithQueryClient(
      <StrictMode>
        <SyncOpenCheck surface="popup" />
      </StrictMode>,
    )

    await waitFor(() => {
      expect(checkRemoteOnOpen).toHaveBeenCalledTimes(1)
    })
  })

  it('swallows open-check errors', async () => {
    checkRemoteOnOpen.mockRejectedValue(new Error('GitHub unavailable.'))

    renderWithQueryClient(<SyncOpenCheck surface="popup" />)

    await waitFor(() => {
      expect(checkRemoteOnOpen).toHaveBeenCalledWith('popup')
    })
  })

  it('broad-invalidates app data after a successful pull', async () => {
    checkRemoteOnOpen.mockResolvedValue({
      ...syncOpenCheckResult,
      direction: 'pull',
      outcome: 'success',
    })
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    })
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

    render(
      <QueryClientProvider client={queryClient}>
        <SyncOpenCheck surface="popup" />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.sync.all,
      })
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.appShell.all,
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.settings.all,
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.problems.all,
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.practice.all,
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.queue.all,
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.tracks.all,
    })
  })

  it('refreshes sync status without broad app invalidation when the open check does not pull', async () => {
    checkRemoteOnOpen.mockResolvedValue({
      ...syncOpenCheckResult,
      direction: null,
      outcome: 'no-change',
      reason: 'remote-unchanged',
    })
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    })
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

    render(
      <QueryClientProvider client={queryClient}>
        <SyncOpenCheck surface="popup" />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.sync.all,
      })
    })
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: queryKeys.settings.all,
    })
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: queryKeys.problems.all,
    })
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: queryKeys.appShell.all,
    })
  })
})

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}

const syncOpenCheckResult = {
  action: 'check-remote-on-open',
  direction: null,
  outcome: 'no-change',
  reason: 'remote-unchanged',
  retryable: false,
  message: 'Remote check found no changes.',
  status: {
    enabled: true,
    configured: true,
    tokenConfigured: true,
    tokenStatus: {
      provider: 'github:gist',
      configured: true,
      updatedAt: '2026-05-31T11:00:00.000Z',
      fingerprint: 'abcdef123456',
    },
    gistId: 'gist_1',
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
  occurredAt: '2026-05-31T12:00:00.000Z',
} satisfies SyncActionResult
