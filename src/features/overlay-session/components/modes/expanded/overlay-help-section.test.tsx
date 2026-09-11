import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { createYouTubeSearchUrl } from '../../../domain'
import { OverlayHelpSection } from './overlay-help-section'

const searchQuery = 'Two Sum #1'

describe('OverlayHelpSection', () => {
  it('renders a labeled Help region with a YouTube search link', () => {
    render(<OverlayHelpSection searchQuery={searchQuery} />)

    expect(screen.getByRole('region', { name: 'Help' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Help' })).toHaveClass(
      'uppercase',
    )

    const link = screen.getByRole('link', {
      name: 'Search YouTube for this problem',
    })
    expect(link).toHaveAttribute('href', createYouTubeSearchUrl(searchQuery))
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('shows the action tooltip on hover', async () => {
    const user = userEvent.setup()
    render(<OverlayHelpSection searchQuery={searchQuery} />)

    await user.hover(
      screen.getByRole('link', { name: 'Search YouTube for this problem' }),
    )

    expect(
      await screen.findByRole('tooltip', {
        name: 'Search YouTube for this problem',
      }),
    ).toBeInTheDocument()
  })

  it.each([null, '', '   '])(
    'renders a disabled button without a link when query is %j',
    (query) => {
      render(<OverlayHelpSection searchQuery={query} />)

      expect(
        screen.getByRole('button', {
          name: 'Search YouTube for this problem',
        }),
      ).toBeDisabled()
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    },
  )
})
