import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Badge } from './badge'

describe('Badge', () => {
  it('renders with default props', () => {
    render(<Badge>Default Badge</Badge>)
    const badge = screen.getByText('Default Badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute('data-cp-tone', 'neutral')
    expect(badge).not.toHaveClass('bg-transparent')
  })

  it('applies custom tone prop', () => {
    render(<Badge tone="danger">Danger Badge</Badge>)
    const badge = screen.getByText('Danger Badge')
    expect(badge).toHaveAttribute('data-cp-tone', 'danger')
  })

  it('applies the outline variant', () => {
    render(<Badge variant="outline">Outline Badge</Badge>)
    const badge = screen.getByText('Outline Badge')
    expect(badge).toHaveClass('bg-transparent')
  })

  it('merges custom class names', () => {
    render(<Badge className="custom-class">Custom Badge</Badge>)
    const badge = screen.getByText('Custom Badge')
    expect(badge).toHaveClass('custom-class')
    expect(badge).toHaveClass('inline-flex') // Default class
  })

  it('forwards HTML attributes', () => {
    render(
      <Badge id="badge-id" aria-label="Test Badge" data-testid="badge-test">
        HTML Badge
      </Badge>
    )
    const badge = screen.getByTestId('badge-test')
    expect(badge).toHaveAttribute('id', 'badge-id')
    expect(badge).toHaveAttribute('aria-label', 'Test Badge')
  })
})
