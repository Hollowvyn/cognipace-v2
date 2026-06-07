import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  defaultUserSettings,
  type UserSettings,
} from '@/features/settings/domain'

import { RemindersSection } from './reminders-section'

function renderSection(
  overrides: Partial<UserSettings['reminders']['daily']> = {},
) {
  const draft: UserSettings = {
    ...defaultUserSettings,
    reminders: {
      daily: { ...defaultUserSettings.reminders.daily, ...overrides },
    },
  }
  const actions = {
    setRemindersEnabled: vi.fn(),
    setRemindersTime: vi.fn(),
  }
  return { actions, ...render(<RemindersSection actions={actions} draft={draft} />) }
}

describe('RemindersSection', () => {
  it('renders the Reminders section heading', () => {
    renderSection()
    expect(screen.getByRole('heading', { name: 'Reminders' })).toBeInTheDocument()
  })

  it('disables the time input when reminders are off', () => {
    renderSection({ enabled: false })
    expect(screen.getByLabelText('Reminder time')).toBeDisabled()
  })

  it('enables the time input when reminders are on', () => {
    renderSection({ enabled: true, time: '09:00' })
    expect(screen.getByLabelText('Reminder time')).not.toBeDisabled()
  })

  it('calls setRemindersEnabled(true) when the switch is clicked while off', async () => {
    const { actions } = renderSection({ enabled: false })
    const user = userEvent.setup()
    await user.click(screen.getByRole('switch', { name: 'Daily reminder' }))
    expect(actions.setRemindersEnabled).toHaveBeenCalledWith(true)
  })

  it('calls setRemindersTime when the time input changes', () => {
    const { actions } = renderSection({ enabled: true, time: '09:00' })
    fireEvent.change(screen.getByLabelText('Reminder time'), {
      target: { value: '14:30' },
    })
    expect(actions.setRemindersTime).toHaveBeenCalledWith('14:30')
  })

  it('shows an error and marks aria-invalid when enabled with an empty time', () => {
    renderSection({ enabled: true, time: '' })
    expect(screen.getByLabelText('Reminder time')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a reminder time')
  })

  it('hides the error when reminders are off even if time is empty', () => {
    renderSection({ enabled: false, time: '' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Reminder time')).not.toHaveAttribute('aria-invalid')
  })
})
