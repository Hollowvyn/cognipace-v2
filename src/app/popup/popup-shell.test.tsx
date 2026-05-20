import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { AppShellData } from '@/extension/messaging'

import { PopupShell } from './popup-shell'

const shellData: AppShellData = {
  status: {
    label: 'Foundation online',
    detail: 'Typed messaging is connected.',
  },
  metrics: [
    { label: 'Due Today', value: '--' },
    { label: 'Streak', value: '--' },
  ],
  recommendation: {
    title: 'Recommendation service pending',
    detail: 'Queue generation lands later.',
  },
  activeTrack: {
    title: 'Track service pending',
    detail: 'Tracks land later.',
  },
}

describe('PopupShell', () => {
  it('renders the popup foundation shell', () => {
    render(<PopupShell data={shellData} pingLabel="Connected" />)

    expect(
      screen.getByRole('heading', { name: 'Study Loop' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Recommendation service pending'),
    ).toBeInTheDocument()
    expect(screen.getByText('Track service pending')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh Queue' })).toBeDisabled()
  })
})
