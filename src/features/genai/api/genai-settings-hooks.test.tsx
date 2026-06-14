import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

import { sendMessage } from '@/extension/messaging'
import { queryKeys } from '@/platform/query/query-keys'

import type {
  GenAiProviderActionResult,
  GenAiProviderStatus,
} from '../domain/genai-connection-types'
import {
  useClearAiProviderSecretMutation,
  useClearGenAiProviderSecretMutation,
  useGenAiProviderStatusQuery,
  useGenAiSecretPresenceQuery,
  useSaveGenAiProviderModelMutation,
  useSaveGenAiProviderSecretMutation,
  useSelectGenAiProviderMutation,
  useSetAiProviderSecretMutation,
  useTestGenAiProviderDraftMutation,
  useVerifyGenAiProviderMutation,
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

const providerStatus: GenAiProviderStatus = {
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
}

const providerActionResult: GenAiProviderActionResult = {
  action: 'save-model',
  outcome: 'success',
  message: 'Saved provider model.',
  status: providerStatus,
  occurredAt: '2026-06-14T10:00:00.000Z',
}

describe('useGenAiProviderStatusQuery', () => {
  it('fetches provider status via the dashboard runtime method', async () => {
    vi.mocked(sendMessage).mockResolvedValue(providerStatus)

    const { result } = renderHook(() => useGenAiProviderStatusQuery(), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(providerStatus)
    expect(sendMessage).toHaveBeenCalledWith('genai.getProviderStatus', {
      surface: 'dashboard',
    })
  })
})

describe('provider setup mutations', () => {
  it('saves provider models through the dashboard runtime method', async () => {
    vi.mocked(sendMessage).mockResolvedValue(providerActionResult)

    const { result } = renderHook(() => useSaveGenAiProviderModelMutation(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({
        provider: 'gemini',
        model: 'gemini-2.5-flash',
      })
    })

    expect(sendMessage).toHaveBeenCalledWith('genai.saveProviderModel', {
      surface: 'dashboard',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    })
  })

  it('saves provider secrets through the dashboard runtime method', async () => {
    vi.mocked(sendMessage).mockResolvedValue(providerActionResult)

    const { result } = renderHook(() => useSaveGenAiProviderSecretMutation(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({
        provider: 'gemini',
        secret: { apiKey: 'AIza-test' },
      })
    })

    expect(sendMessage).toHaveBeenCalledWith('genai.saveProviderSecret', {
      surface: 'dashboard',
      provider: 'gemini',
      secret: { apiKey: 'AIza-test' },
    })
  })

  it('tests provider drafts through the dashboard runtime method', async () => {
    vi.mocked(sendMessage).mockResolvedValue(providerActionResult)

    const { result } = renderHook(() => useTestGenAiProviderDraftMutation(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        secret: { apiKey: 'AIza-test' },
      })
    })

    expect(sendMessage).toHaveBeenCalledWith('genai.testProviderDraft', {
      surface: 'dashboard',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      secret: { apiKey: 'AIza-test' },
    })
  })

  it('verifies providers through the dashboard runtime method', async () => {
    vi.mocked(sendMessage).mockResolvedValue(providerActionResult)

    const { result } = renderHook(() => useVerifyGenAiProviderMutation(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({ provider: 'openai' })
    })

    expect(sendMessage).toHaveBeenCalledWith('genai.verifyProvider', {
      surface: 'dashboard',
      provider: 'openai',
    })
  })

  it('selects providers through the dashboard runtime method', async () => {
    vi.mocked(sendMessage).mockResolvedValue(providerActionResult)

    const { result } = renderHook(() => useSelectGenAiProviderMutation(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({ provider: 'anthropic' })
    })

    expect(sendMessage).toHaveBeenCalledWith('genai.selectProvider', {
      surface: 'dashboard',
      provider: 'anthropic',
    })
  })

  it('clears provider secrets through the dashboard runtime method', async () => {
    vi.mocked(sendMessage).mockResolvedValue(providerActionResult)

    const { result } = renderHook(() => useClearGenAiProviderSecretMutation(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({ provider: 'gemini' })
    })

    expect(sendMessage).toHaveBeenCalledWith('genai.clearProviderSecret', {
      surface: 'dashboard',
      provider: 'gemini',
    })
  })

  it('invalidates genai and app-shell query families when setup mutations settle', async () => {
    vi.mocked(sendMessage).mockResolvedValue(providerActionResult)
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useVerifyGenAiProviderMutation(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({ provider: 'gemini' })
    })

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.genai.all,
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.appShell.all,
    })
  })
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

  it('omits baseUrl from the runtime payload when provided', async () => {
    vi.mocked(sendMessage).mockResolvedValue({
      openai: true,
      anthropic: false,
      gemini: false,
    })

    const { result } = renderHook(() => useSetAiProviderSecretMutation(), {
      wrapper,
    })

    const input = {
      provider: 'gemini' as const,
      key: 'g-test',
      baseUrl: 'https://proxy.example.test',
    }

    await act(async () => {
      await result.current.mutateAsync(input)
    })

    expect(sendMessage).toHaveBeenCalledWith('genai.setAiProviderSecret', {
      surface: 'dashboard',
      provider: 'gemini',
      secret: { apiKey: 'g-test' },
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
