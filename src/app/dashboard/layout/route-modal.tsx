import { Link, useNavigate } from '@tanstack/react-router'
import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import type { DashboardModalClosePath } from '@/app/dashboard/navigation/route-manifest'

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function RouteModal({
  children,
  closeLabel = 'Close',
  closeTo,
  description,
  title,
}: {
  children?: ReactNode
  closeLabel?: string
  closeTo: DashboardModalClosePath
  description: string
  title: string
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const titleId = `dashboard-modal-${title.toLowerCase().replace(/\s+/g, '-')}`
  const descriptionId = `${titleId}-description`

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const dialog = dialogRef.current
    const firstFocusable = dialog ? getFocusableElements(dialog)[0] : undefined
    const initialFocusTarget = firstFocusable ?? dialog

    initialFocusTarget?.focus()

    return () => {
      previouslyFocused?.focus()
    }
  }, [])

  function closeModal() {
    void navigate({ to: closeTo, replace: true })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeModal()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const dialog = dialogRef.current
    const focusableElements = dialog ? getFocusableElements(dialog) : []

    if (focusableElements.length === 0) {
      event.preventDefault()
      dialog?.focus()
      return
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (!firstElement || !lastElement) {
      return
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
      return
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[var(--cp-z-dialog)] flex items-start justify-center overflow-y-auto overscroll-contain bg-background/75 p-4 pt-16 backdrop-blur-sm sm:items-center sm:pt-4"
      onKeyDown={handleKeyDown}
    >
      <Surface asChild className="w-full max-w-lg shadow-overlay">
        <div
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
                Placeholder
              </p>
              <h2
                className="mt-1 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground"
                id={titleId}
              >
                {title}
              </h2>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link replace to={closeTo}>
                {closeLabel}
              </Link>
            </Button>
          </div>
          <p
            className="mt-3 text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground"
            id={descriptionId}
          >
            {description}
          </p>
          {children ? (
            <div className="mt-4 text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
              {children}
            </div>
          ) : null}
        </div>
      </Surface>
    </div>
  )
}

function getFocusableElements(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((candidate) => !candidate.hasAttribute('disabled'))
    .filter((candidate) => candidate.getAttribute('aria-hidden') !== 'true')
    .filter((candidate) => candidate.tabIndex >= 0)
}
