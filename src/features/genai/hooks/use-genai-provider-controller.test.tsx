import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

import { sendMessage } from '@/extension/messaging'

import type {
  GenAiProviderActionResult,
  GenAiProviderStatus,
} from '../domain'
import { useGenAiProviderController } from './use-genai-provider-controller'

let queryClient: QueryClient

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  vi.mocked(sendMessage).mockReset()
})

afterEach(() => {
  queryClient.clear()
})

describe('useGenAiProviderController', () => {
  it('loads provider status and exposes setup actions with nested secret payloads', async () => {
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'genai.getProviderStatus') {
        return Promise.resolve(providerStatus)
      }

      return Promise.resolve(providerActionResult)
    })

    const { result } = renderHook(() => useGenAiProviderController(), {
      wrapper,
    })

    await waitFor(() => expect(result.current.status).toEqual(providerStatus))

    expect(result.current.isLoading).toBe(false)

    await act(async () => {
      await result.current.actions.onSaveSecret('gemini', 'AIza-draft')
    })

    expect(sendMessage).toHaveBeenCalledWith('genai.getProviderStatus', {
      surface: 'dashboard',
    })
    expect(sendMessage).toHaveBeenCalledWith('genai.saveProviderSecret', {
      surface: 'dashboard',
      provider: 'gemini',
      secret: { apiKey: 'AIza-draft' },
    })
  })
})

const providerStatus = {
  selectedProvider: 'gemini',
  selectedReady: false,
  providers: [
    {
      provider: 'gemini',
      label: 'Gemini',
      model: 'gemini-2.5-flash',
      secretConfigured: false,
      verificationState: 'unverified',
      verifiedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  ],
} satisfies GenAiProviderStatus

const providerActionResult = {
  action: 'save-secret',
  outcome: 'success',
  message: 'Provider key saved.',
  status: providerStatus,
  occurredAt: '2026-06-14T12:00:00.000Z',
} satisfies GenAiProviderActionResult
