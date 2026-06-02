import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

import { sendMessage } from '@/extension/messaging'

import {
  useClearAiProviderSecretMutation,
  useGenAiSecretPresenceQuery,
  useSetAiProviderSecretMutation,
} from './genai-settings-hooks'

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

describe('useGenAiSecretPresenceQuery', () => {
  it('fetches presence via sendMessage with dashboard surface', async () => {
    vi.mocked(sendMessage).mockResolvedValue({
      openai: true,
      anthropic: false,
      gemini: false,
    })

    const { result } = renderHook(() => useGenAiSecretPresenceQuery(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({
      openai: true,
      anthropic: false,
      gemini: false,
    })
    expect(sendMessage).toHaveBeenCalledWith(
      'genai.getAiProviderSecretPresence',
      { surface: 'dashboard' },
    )
  })
})

describe('useSetAiProviderSecretMutation', () => {
  it('translates the hook input key to apiKey at the runtime boundary', async () => {
    vi.mocked(sendMessage).mockResolvedValue({
      openai: true,
      anthropic: false,
      gemini: false,
    })

    const { result } = renderHook(() => useSetAiProviderSecretMutation(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({
        provider: 'openai',
        key: 'sk-test-key',
      })
    })

    expect(sendMessage).toHaveBeenCalledWith('genai.setAiProviderSecret', {
      surface: 'dashboard',
      provider: 'openai',
      secret: { apiKey: 'sk-test-key' },
    })
  })

  it('includes baseUrl in the runtime payload when provided', async () => {
    vi.mocked(sendMessage).mockResolvedValue({
      openai: true,
      anthropic: false,
      gemini: false,
    })

    const { result } = renderHook(() => useSetAiProviderSecretMutation(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({
        provider: 'gemini',
        key: 'g-test',
        baseUrl: 'https://proxy.example.test',
      })
    })

    expect(sendMessage).toHaveBeenCalledWith('genai.setAiProviderSecret', {
      surface: 'dashboard',
      provider: 'gemini',
      secret: { apiKey: 'g-test', baseUrl: 'https://proxy.example.test' },
    })
  })

  it('updates the presence cache on success', async () => {
    const presence = { openai: false, anthropic: true, gemini: false }
    vi.mocked(sendMessage).mockResolvedValue(presence)

    const { result } = renderHook(() => useSetAiProviderSecretMutation(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({
        provider: 'anthropic',
        key: 'sk-ant-test',
      })
    })

    expect(queryClient.getQueryData(['genai', 'secret-presence'])).toEqual(
      presence,
    )
  })
})

describe('useClearAiProviderSecretMutation', () => {
  it('calls clearAiProviderSecret via sendMessage and updates the cache', async () => {
    const presence = { openai: false, anthropic: false, gemini: false }
    vi.mocked(sendMessage).mockResolvedValue(presence)

    const { result } = renderHook(() => useClearAiProviderSecretMutation(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({ provider: 'openai' })
    })

    expect(sendMessage).toHaveBeenCalledWith('genai.clearAiProviderSecret', {
      surface: 'dashboard',
      provider: 'openai',
    })
    expect(queryClient.getQueryData(['genai', 'secret-presence'])).toEqual(
      presence,
    )
  })
})
