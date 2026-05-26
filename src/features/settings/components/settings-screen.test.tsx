import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sendMessage } from '@/extension/messaging'
import { createQueryTestHarness } from '@/testing/query-test-harness'

import { defaultUserSettings } from '../domain'
import { SettingsScreen } from './settings-screen'

vi.mock('@/extension/messaging', () => ({
  sendMessage: vi.fn(),
}))

describe('SettingsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('edits settings and saves the expected dashboard patch', async () => {
    const user = userEvent.setup()
    const savedSettings = {
      ...defaultUserSettings,
      practice: {
        ...defaultUserSettings.practice,
        dailyGoal: 7,
        mode: 'freePractice' as const,
        problemFilters: {
          skipPremium: true,
        },
      },
    }
    vi.mocked(sendMessage).mockImplementation((method) => {
      if (method === 'settings.getSettings') {
        return Promise.resolve(defaultUserSettings)
      }

      if (method === 'settings.updateSettings') {
        return Promise.resolve(savedSettings)
      }

      return Promise.reject(new Error(`Unexpected method ${method}`))
    })
    const { wrapper } = createQueryTestHarness()

    render(<SettingsScreen />, { wrapper })

    await screen.findByRole('heading', { name: 'Practice Defaults' })
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Settings actions')).toBeVisible()
    expect(screen.getByText('No pending changes')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Save Settings' })).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: 'Free practice' }))
    await user.clear(screen.getByLabelText('Daily goal'))
    await user.type(screen.getByLabelText('Daily goal'), '7')
    await user.click(
      screen.getByRole('switch', { name: 'Skip premium problems' }),
    )

    expect(screen.getByText('Unsaved changes')).toBeVisible()
    expect(screen.getByLabelText('Settings actions')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Save Settings' }))

    expect(sendMessage).toHaveBeenCalledWith('settings.updateSettings', {
      surface: 'dashboard',
      patch: {
        practice: {
          dailyGoal: 7,
          mode: 'freePractice',
          problemFilters: {
            skipPremium: true,
          },
        },
      },
    })
    const toast = await screen.findByRole('status', {
      name: 'Settings feedback',
    })
    expect(toast).toHaveTextContent('Settings saved.')
    expect(screen.getByRole('button', { name: 'Save Settings' })).toBeDisabled()
    expect(screen.getByText('No pending changes')).toBeVisible()
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('shows the strict timing dependency from the disabled switch', async () => {
    const user = userEvent.setup()
    const disabledReason =
      'Enable Require solve time before using strict timing.'
    vi.mocked(sendMessage).mockResolvedValue(defaultUserSettings)
    const { wrapper } = createQueryTestHarness()

    render(<SettingsScreen />, { wrapper })

    await screen.findByRole('heading', { name: 'Practice Defaults' })
    const strictTimingSwitch = screen.getByRole('switch', {
      name: 'Strict timing',
    })

    expect(screen.queryByText(disabledReason)).not.toBeInTheDocument()
    expect(strictTimingSwitch).toHaveAttribute('aria-disabled', 'true')

    await user.hover(strictTimingSwitch)

    expect(await screen.findByRole('tooltip')).toHaveTextContent(disabledReason)
    expect(strictTimingSwitch).toHaveAttribute('aria-checked', 'false')

    await user.unhover(strictTimingSwitch)

    await waitFor(() => {
      expect(screen.queryByText(disabledReason)).not.toBeInTheDocument()
    })

    fireEvent.click(strictTimingSwitch)

    expect(screen.queryByText(disabledReason)).not.toBeInTheDocument()
    expect(strictTimingSwitch).toHaveAttribute('aria-checked', 'false')

    strictTimingSwitch.focus()

    expect(await screen.findByRole('tooltip')).toHaveTextContent(disabledReason)

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByText(disabledReason)).not.toBeInTheDocument()
    })
  })

  it('blocks invalid numeric saves with inline validation', async () => {
    const user = userEvent.setup()
    vi.mocked(sendMessage).mockResolvedValue(defaultUserSettings)
    const { wrapper } = createQueryTestHarness()

    render(<SettingsScreen />, { wrapper })

    await screen.findByRole('heading', { name: 'Practice Defaults' })
    await user.clear(screen.getByLabelText('Daily goal'))

    expect(screen.getByText('Required')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Save Settings' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Fix highlighted settings',
    )
    expect(
      screen.queryByText('Fix the highlighted settings before saving.'),
    ).not.toBeInTheDocument()
  })
})
