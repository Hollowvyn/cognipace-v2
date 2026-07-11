import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { InlineStatus } from './inline-status'

describe('InlineStatus', () => {
  it('renders children correctly', () => {
    render(<InlineStatus>Status message</InlineStatus>)

    const element = screen.getByText('Status message')
    expect(element).toBeInTheDocument()
  })

  it('returns null when no children are provided', () => {
    const { container } = render(<InlineStatus />)
    expect(container).toBeEmptyDOMElement()
  })

  it('applies default attributes (role, tone, aria-live)', () => {
    render(<InlineStatus>Default status</InlineStatus>)

    const element = screen.getByRole('status')
    expect(element).toBeInTheDocument()
    expect(element).toHaveAttribute('data-cp-tone', 'neutral')
    expect(element).toHaveAttribute('aria-live', 'polite')
  })

  it('allows overriding tone', () => {
    render(<InlineStatus tone="success">Success status</InlineStatus>)

    const element = screen.getByRole('status')
    expect(element).toHaveAttribute('data-cp-tone', 'success')
  })

  it('allows overriding role', () => {
    render(<InlineStatus role="alert">Alert status</InlineStatus>)

    const element = screen.getByRole('alert')
    expect(element).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('forwards custom className and other props', () => {
    render(
      <InlineStatus
        className="custom-class"
        data-testid="status-test"
        id="my-status"
      >
        Custom status
      </InlineStatus>,
    )

    const element = screen.getByTestId('status-test')
    expect(element).toBeInTheDocument()
    expect(element).toHaveClass('custom-class')
    expect(element).toHaveAttribute('id', 'my-status')
  })
})
