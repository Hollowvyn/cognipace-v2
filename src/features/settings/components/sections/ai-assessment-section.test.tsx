import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

import { sendMessage } from '@/extension/messaging'

import { defaultUserSettings, type UserSettings } from '@/features/settings/domain'

import { AiAssessmentSection } from './ai-assessment-section'

let queryClient: QueryClient
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function renderSection(draftOverrides: Partial<UserSettings['aiAssessment']> = {}) {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const draft: UserSettings = {
    ...defaultUserSettings,
    aiAssessment: { ...defaultUserSettings.aiAssessment, ...draftOverrides },
  }
  const actions = {
    setAiEnabled: vi.fn(),
    setAiModel: vi.fn(),
    setAiProvider: vi.fn(),
  }
  return {
    actions,
    ...render(<AiAssessmentSection actions={actions} draft={draft} />, {
      wrapper: Wrapper,
    }),
  }
}

beforeEach(() => {
  vi.mocked(sendMessage).mockReset()
  vi.mocked(sendMessage).mockResolvedValue({
    openai: false,
    anthropic: false,
    gemini: false,
  })
})

afterEach(() => {
  queryClient.clear()
})

describe('AiAssessmentSection', () => {
  it('renders a segmented control with all three providers', async () => {
    renderSection()
    await waitFor(() => expect(sendMessage).toHaveBeenCalled())
    expect(screen.getByRole('radio', { name: /openai/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /anthropic/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /gemini/i })).toBeInTheDocument()
  })

  it('disables the enabled switch when the active provider has no key', async () => {
    renderSection({ provider: 'openai', model: 'gpt-test', enabled: false })
    await waitFor(() => expect(sendMessage).toHaveBeenCalled())
    const toggle = screen.getByRole('switch', { name: /enabled/i })
    expect(toggle).toHaveAttribute('aria-disabled', 'true')
  })

  it('disables the enabled switch when the model is empty', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce({
      openai: true,
      anthropic: false,
      gemini: false,
    })
    renderSection({ provider: 'openai', model: '', enabled: false })
    await waitFor(() => expect(sendMessage).toHaveBeenCalled())
    expect(
      screen.getByRole('switch', { name: /enabled/i }),
    ).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows a Key set badge for providers with stored secrets', async () => {
    vi.mocked(sendMessage).mockResolvedValueOnce({
      openai: false,
      anthropic: true,
      gemini: false,
    })
    renderSection()
    await waitFor(() => expect(screen.queryByText(/key set/i)).toBeInTheDocument())
    expect(screen.getAllByText(/key set/i)).toHaveLength(1)
  })

  it('saves a key via the runtime and clears the input on success', async () => {
    vi.mocked(sendMessage)
      .mockResolvedValueOnce({ openai: false, anthropic: false, gemini: false }) // initial presence
      .mockResolvedValueOnce({ openai: true, anthropic: false, gemini: false })  // after set
    renderSection({ provider: 'openai', model: 'gpt-test', enabled: false })
    await waitFor(() => expect(sendMessage).toHaveBeenCalled())

    const user = userEvent.setup()
    const keyInput = screen
      .getAllByLabelText(/openai api key/i)
      .find((el) => el.tagName === 'INPUT') as HTMLInputElement
    await user.type(keyInput, 'sk-test')
    await user.click(screen.getByRole('button', { name: /save key/i }))

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        'genai.setAiProviderSecret',
        expect.objectContaining({
          surface: 'dashboard',
          provider: 'openai',
        }),
      ),
    )
    expect(keyInput).toHaveValue('')
  })

  it('removes a key via the runtime when the remove button is clicked', async () => {
    vi.mocked(sendMessage)
      .mockResolvedValueOnce({ openai: true, anthropic: false, gemini: false })
      .mockResolvedValueOnce({ openai: false, anthropic: false, gemini: false })
    renderSection({ provider: 'openai', model: 'gpt-test', enabled: false })
    await waitFor(() => expect(screen.queryByText(/key set/i)).toBeInTheDocument())

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /remove key/i }))

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        'genai.clearAiProviderSecret',
        { surface: 'dashboard', provider: 'openai' },
      ),
    )
  })

  it('calls actions.setAiModel when the model input changes', async () => {
    const { actions } = renderSection()
    await waitFor(() => expect(sendMessage).toHaveBeenCalled())

    const user = userEvent.setup()
    const modelInput = screen.getByLabelText(/^model$/i)
    await user.type(modelInput, 'gpt-test')
    expect(actions.setAiModel).toHaveBeenCalled()
  })
})
