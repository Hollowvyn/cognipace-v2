import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Badge } from './badge'
import { IconButton } from './icon-button'
import { InlineStatus } from './inline-status'
import { SurfaceRoot } from './surface'
import { formatDuration, TimerDisplay } from './timer-display'

describe('UI primitives', () => {
  it('renders icon buttons with an accessible name', () => {
    render(
      <IconButton label="Open dashboard">
        <span aria-hidden="true">D</span>
      </IconButton>,
    )

    expect(
      screen.getByRole('button', { name: 'Open dashboard' }),
    ).toBeInTheDocument()
  })

  it('applies surface and theme attributes at the surface root', () => {
    render(
      <SurfaceRoot surface="popup" theme="dark">
        CogniPace popup
      </SurfaceRoot>,
    )

    expect(screen.getByRole('main')).toHaveAttribute('data-cp-surface', 'popup')
    expect(screen.getByRole('main')).toHaveAttribute('data-cp-theme', 'dark')
  })

  it('renders semantic tone attributes for badges and inline statuses', () => {
    render(
      <>
        <Badge tone="success">Synced</Badge>
        <InlineStatus tone="danger">Needs attention</InlineStatus>
      </>,
    )

    expect(screen.getByText('Synced')).toHaveAttribute(
      'data-cp-tone',
      'success',
    )
    expect(screen.getByRole('status')).toHaveAttribute('data-cp-tone', 'danger')
  })

  it('formats timer durations without layout-shifting numerals', () => {
    render(<TimerDisplay aria-label="Elapsed time" seconds={729} />)

    expect(formatDuration(5)).toBe('0:05')
    expect(formatDuration(729)).toBe('12:09')
    expect(formatDuration(3661)).toBe('1:01:01')
    expect(formatDuration(Number.NaN)).toBe('0:00')
    expect(screen.getByLabelText('Elapsed time')).toHaveTextContent('12:09')
    expect(screen.getByLabelText('Elapsed time')).toHaveClass('tabular-nums')
  })
})
