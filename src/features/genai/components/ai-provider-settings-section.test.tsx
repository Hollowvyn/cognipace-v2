import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { GenAiProviderStatus } from '../domain'
import type { AiProviderPanelActions } from './ai-provider-settings-section'
import { AiProviderPanel } from './ai-provider-settings-section'

describe('AiProviderPanel', () => {
  it('renders the selected provider, model, default Gemini status, and manage action', () => {
    renderPanel({ status: defaultStatus })

    expect(
      screen.getByRole('heading', { name: /AI Provider/i }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Gemini').length).toBeGreaterThan(0)
    expect(screen.getByText('gemini-2.5-flash')).toBeInTheDocument()
    expect(screen.getByText('Not configured')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Manage provider/i }),
    ).toBeEnabled()
    expect(
      screen.getByText(/Add and verify a provider key/i),
    ).toBeInTheDocument()
  })

  it('only enables selection for ready providers', () => {
    renderPanel({ status: mixedStatus })

    const selector = screen.getByLabelText(/Selected AI provider/i)
    expect(within(selector).getByRole('option', { name: /Gemini/i })).toBeEnabled()
    expect(
      within(selector).getByRole('option', { name: /OpenAI/i }),
    ).toBeDisabled()
    expect(
      within(selector).getByRole('option', { name: /Anthropic/i }),
    ).toBeDisabled()
  })

  it('tests the selected provider when it is configured', async () => {
    const user = userEvent.setup()
    const onVerifyProvider = vi.fn()

    renderPanel({
      actions: createActions({ onVerifyProvider }),
      status: mixedStatus,
    })

    await user.click(screen.getByRole('button', { name: /Test selected/i }))

    expect(onVerifyProvider).toHaveBeenCalledWith('gemini')
  })
})

function renderPanel({
  actions = createActions(),
  status,
}: {
  actions?: AiProviderPanelActions
  status: GenAiProviderStatus
}) {
  return render(<AiProviderPanel actions={actions} isPending={false} status={status} />)
}

function createActions(
  overrides: Partial<AiProviderPanelActions> = {},
): AiProviderPanelActions {
  return {
    onClearSecret: vi.fn(),
    onSaveModel: vi.fn(),
    onSaveSecret: vi.fn(),
    onSelectProvider: vi.fn(),
    onTestDraft: vi.fn(),
    onVerifyProvider: vi.fn(),
    ...overrides,
  }
}

const defaultStatus = {
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

const mixedStatus = {
  selectedProvider: 'gemini',
  selectedReady: true,
  providers: [
    {
      provider: 'gemini',
      label: 'Gemini',
      model: 'gemini-2.5-flash',
      secretConfigured: true,
      verificationState: 'valid',
      verifiedAt: '2026-06-14T12:00:00.000Z',
      lastErrorCode: null,
      lastErrorMessage: null,
    },
    {
      provider: 'openai',
      label: 'OpenAI',
      model: 'gpt-4o-mini',
      secretConfigured: true,
      verificationState: 'unverified',
      verifiedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
    {
      provider: 'anthropic',
      label: 'Anthropic',
      model: 'claude-haiku-4-5',
      secretConfigured: false,
      verificationState: 'invalid',
      verifiedAt: null,
      lastErrorCode: 'auth',
      lastErrorMessage: 'Authentication failed.',
    },
  ],
} satisfies GenAiProviderStatus
