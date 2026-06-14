import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { GenAiProviderActionResult, GenAiProviderStatus } from '../domain'
import type { AiProviderPanelActions } from './ai-provider-settings-section'
import { AiProviderConnectionDialog } from './ai-provider-connection-dialog'

describe('AiProviderConnectionDialog', () => {
  it('orders provider choices as Gemini, OpenAI, Anthropic', () => {
    renderDialog({ status: configuredStatus })

    const options = within(
      screen.getByRole('combobox', { name: /^Provider$/i }),
    ).getAllByRole('option')

    expect(options.map((option) => option.textContent)).toEqual([
      'Gemini',
      'OpenAI',
      'Anthropic',
    ])
  })

  it('masks a stored key and never renders the raw saved key', () => {
    renderDialog({ status: configuredStatus })

    expect(screen.getByLabelText(/API key/i)).toHaveValue('................')
    expect(screen.getByLabelText(/API key/i)).toHaveAttribute('readOnly')
    expect(screen.queryByDisplayValue(/AIza-raw-saved-key/i)).not.toBeInTheDocument()
  })

  it('saves model and typed key when both are provided', async () => {
    const user = userEvent.setup()
    const onSaveModel = vi.fn().mockResolvedValue(undefined)
    const onSaveSecret = vi.fn().mockResolvedValue(undefined)

    renderDialog({
      actions: createActions({ onSaveModel, onSaveSecret }),
      status: unconfiguredStatus,
    })

    await user.clear(screen.getByLabelText(/Model/i))
    await user.type(screen.getByLabelText(/Model/i), 'gemini-2.5-pro')
    await user.type(screen.getByLabelText(/API key/i), 'AIza-draft')
    await user.click(screen.getByRole('button', { name: /Save provider/i }))

    expect(onSaveModel).toHaveBeenCalledWith('gemini', 'gemini-2.5-pro')
    expect(onSaveSecret).toHaveBeenCalledWith('gemini', 'AIza-draft')
  })

  it('uses returned provider status after saving a key without waiting for refetch', async () => {
    const user = userEvent.setup()
    const onSaveModel = vi.fn().mockResolvedValue(createActionResult({
      status: unconfiguredStatus,
    }))
    const onSaveSecret = vi.fn().mockResolvedValue(createActionResult({
      action: 'save-secret',
      status: savedUnverifiedStatus,
    }))

    renderDialog({
      actions: createActions({ onSaveModel, onSaveSecret }),
      status: unconfiguredStatus,
    })

    await user.type(screen.getByLabelText(/API key/i), 'AIza-draft')
    await user.click(screen.getByRole('button', { name: /Save provider/i }))

    expect(
      screen.getByRole('button', { name: /Verify selected/i }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: /Remove key/i }),
    ).toBeInTheDocument()
  })

  it('persists the selected provider when saving provider setup', async () => {
    const user = userEvent.setup()
    const onSaveModel = vi.fn().mockResolvedValue(undefined)
    const onSelectProvider = vi.fn().mockResolvedValue(undefined)

    renderDialog({
      actions: createActions({ onSaveModel, onSelectProvider }),
      status: configuredStatus,
    })

    await user.selectOptions(
      screen.getByRole('combobox', { name: /^Provider$/i }),
      'openai',
    )
    await user.click(screen.getByRole('button', { name: /Save provider/i }))

    expect(onSelectProvider).toHaveBeenCalledWith('openai')
    expect(onSaveModel).toHaveBeenCalledWith('openai', 'gpt-4o-mini')
    expect(onSelectProvider.mock.invocationCallOrder[0]).toBeLessThan(
      onSaveModel.mock.invocationCallOrder[0] ?? 0,
    )
  })

  it('can save a model without forcing key save when the stored key is masked', async () => {
    const user = userEvent.setup()
    const onSaveModel = vi.fn().mockResolvedValue(undefined)
    const onSaveSecret = vi.fn().mockResolvedValue(undefined)

    renderDialog({
      actions: createActions({ onSaveModel, onSaveSecret }),
      status: configuredStatus,
    })

    await user.clear(screen.getByLabelText(/Model/i))
    await user.type(screen.getByLabelText(/Model/i), 'gemini-2.5-pro')
    await user.click(screen.getByRole('button', { name: /Save provider/i }))

    expect(onSaveModel).toHaveBeenCalledWith('gemini', 'gemini-2.5-pro')
    expect(onSaveSecret).not.toHaveBeenCalled()
  })

  it('tests an unsaved typed key as a draft', async () => {
    const user = userEvent.setup()
    const onTestDraft = vi.fn().mockResolvedValue(undefined)
    const onSaveSecret = vi.fn()

    renderDialog({
      actions: createActions({ onSaveSecret, onTestDraft }),
      status: unconfiguredStatus,
    })

    await user.type(screen.getByLabelText(/API key/i), 'AIza-draft')
    await user.click(screen.getByRole('button', { name: /Test key/i }))

    expect(onTestDraft).toHaveBeenCalledWith(
      'gemini',
      'gemini-2.5-flash',
      'AIza-draft',
    )
    expect(onSaveSecret).not.toHaveBeenCalled()
  })

  it('verifies the selected provider', async () => {
    const user = userEvent.setup()
    const onVerifyProvider = vi.fn().mockResolvedValue(undefined)

    renderDialog({
      actions: createActions({ onVerifyProvider }),
      status: configuredStatus,
    })

    await user.click(screen.getByRole('button', { name: /Verify selected/i }))

    expect(onVerifyProvider).toHaveBeenCalledWith('gemini')
  })

  it('removes the selected provider key', async () => {
    const user = userEvent.setup()
    const onClearSecret = vi.fn().mockResolvedValue(undefined)

    renderDialog({
      actions: createActions({ onClearSecret }),
      status: configuredStatus,
    })

    await user.click(screen.getByRole('button', { name: /Remove key/i }))

    expect(onClearSecret).toHaveBeenCalledWith('gemini')
  })

  it('disables editable controls while a provider action is pending', () => {
    renderDialog({ isPending: true, status: unconfiguredStatus })

    expect(screen.getByRole('combobox', { name: /^Provider$/i })).toBeDisabled()
    expect(screen.getByLabelText(/Model/i)).toBeDisabled()
    expect(screen.getByLabelText(/API key/i)).toBeDisabled()
  })
})

function renderDialog({
  actions = createActions(),
  isPending = false,
  status,
}: {
  actions?: AiProviderPanelActions
  isPending?: boolean
  status: GenAiProviderStatus
}) {
  return render(
    <AiProviderConnectionDialog
      actions={actions}
      isPending={isPending}
      onClose={vi.fn()}
      status={status}
    />,
  )
}

function createActionResult({
  action = 'save-model',
  status,
}: {
  action?: GenAiProviderActionResult['action']
  status: GenAiProviderStatus
}): GenAiProviderActionResult {
  return {
    action,
    outcome: 'success',
    message: 'Provider saved.',
    status,
    occurredAt: '2026-06-14T12:00:00.000Z',
  }
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

const unconfiguredStatus = {
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

const configuredStatus = {
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
      secretConfigured: false,
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
      verificationState: 'unverified',
      verifiedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  ],
} satisfies GenAiProviderStatus

const savedUnverifiedStatus = {
  ...unconfiguredStatus,
  providers: [
    {
      ...unconfiguredStatus.providers[0],
      secretConfigured: true,
    },
  ],
} satisfies GenAiProviderStatus
