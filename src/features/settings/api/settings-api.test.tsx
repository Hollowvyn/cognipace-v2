import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { defaultUserSettings } from '@/features/settings'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { useUpdateSettings } from './settings-api'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('settings API hooks', () => {
  it('invalidates settings and app-shell data after settings updates', async () => {
    const { queryClient, wrapper } = createQueryTestHarness()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    vi.mocked(sendMessage).mockResolvedValue(defaultUserSettings)
    const { result } = renderHook(() => useUpdateSettings(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({
        surface: 'dashboard',
        patch: { timing: { hardMode: true } },
      })
    })

    await waitFor(() => {
      for (const queryKey of [
        ['settings'],
        ['today-queue'],
        ['practice-details'],
        ['app-shell-data'],
      ]) {
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey })
      }
    })
  })
})
