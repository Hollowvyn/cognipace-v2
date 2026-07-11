import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { IconButton } from './icon-button'

describe('IconButton', () => {
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

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(
      <IconButton label="Click me" onClick={onClick}>
        <span aria-hidden="true">X</span>
      </IconButton>,
    )

    await user.click(screen.getByRole('button', { name: 'Click me' }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('passes disabled prop to the button', () => {
    render(
      <IconButton label="Disabled button" disabled>
        <span aria-hidden="true">X</span>
      </IconButton>,
    )

    expect(screen.getByRole('button', { name: 'Disabled button' })).toBeDisabled()
  })

  it('renders tooltip when provided and hovered', async () => {
    const user = userEvent.setup()

    render(
      <IconButton label="Action" tooltip="Tooltip content">
        <span aria-hidden="true">A</span>
      </IconButton>,
    )

    const button = screen.getByRole('button', { name: 'Action' })
    await user.hover(button)

    expect(await screen.findByRole('tooltip', { name: 'Tooltip content' })).toBeInTheDocument()
  })
})
