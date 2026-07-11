import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  it('renders as a button by default', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: 'Click me' })
    expect(button).toBeInTheDocument()
    expect(button.tagName).toBe('BUTTON')
  })

  it('applies default type="button"', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('type', 'button')
  })

  it('allows overriding type attribute', () => {
    render(<Button type="submit">Submit</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('type', 'submit')
  })

  it('passes additional HTML attributes', () => {
    render(<Button aria-label="Custom Label" disabled>Click me</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', 'Custom Label')
    expect(button).toBeDisabled()
  })

  it('merges custom className with default classes', () => {
    render(<Button className="my-custom-class">Click me</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('my-custom-class')
    expect(button).toHaveClass('inline-flex') // One of the base classes
  })

  it('renders as a different element when asChild is true', () => {
    render(
      <Button asChild>
        <a href="https://example.com">Link Button</a>
      </Button>
    )
    const link = screen.getByRole('link', { name: 'Link Button' })
    expect(link).toBeInTheDocument()
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', 'https://example.com')
    // Should not have type="button" attribute
    expect(link).not.toHaveAttribute('type')
  })
})
