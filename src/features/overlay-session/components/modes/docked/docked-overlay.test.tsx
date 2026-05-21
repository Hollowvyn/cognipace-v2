import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DockedOverlay } from './docked-overlay'

describe('DockedOverlay', () => {
  it('restores the collapsed overlay from the recoverable handle', async () => {
    const user = userEvent.setup()
    const onRestore = vi.fn()

    render(<DockedOverlay onRestore={onRestore} />)

    await user.click(screen.getByRole('button', { name: 'Show Overlay' }))

    expect(onRestore).toHaveBeenCalledOnce()
  })
})
