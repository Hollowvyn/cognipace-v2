import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { Tone } from './types'

export const FEEDBACK_TOAST_AUTO_HIDE_MS = 3500

export interface FeedbackToastStatus {
  message: string
  tone: Extract<Tone, 'danger' | 'info' | 'neutral' | 'success' | 'warning'>
}

interface FeedbackToastProps {
  autoHideMs?: number
  dismissLabel?: string
  label?: string
  status: FeedbackToastStatus | null
}

export function FeedbackToast({
  autoHideMs = FEEDBACK_TOAST_AUTO_HIDE_MS,
  dismissLabel = 'Dismiss feedback',
  label = 'Feedback',
  status,
}: FeedbackToastProps) {
  const [dismissedStatus, setDismissedStatus] =
    useState<FeedbackToastStatus | null>(null)

  useEffect(() => {
    if (!status || status.tone === 'danger') {
      return
    }

    const timeout = window.setTimeout(() => {
      setDismissedStatus(status)
    }, autoHideMs)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [autoHideMs, status])

  if (!status || dismissedStatus === status) {
    return null
  }

  const isError = status.tone === 'danger'

  return (
    <div
      aria-label={label}
      aria-live={isError ? 'assertive' : 'polite'}
      className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-[var(--cp-z-overlay)] flex w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-[var(--cp-radius-md)] border border-[color:var(--cp-tone-border)] bg-[var(--cp-tone-bg)] px-3 py-2 text-[length:var(--cp-copy-font-size)] leading-snug text-[color:var(--cp-tone-fg)] shadow-overlay"
      data-cp-tone={status.tone}
      role={isError ? 'alert' : 'status'}
    >
      <span className="min-w-0 flex-1">{status.message}</span>
      <button
        aria-label={dismissLabel}
        className="-mr-1 grid size-6 shrink-0 place-items-center rounded-[var(--cp-radius-sm)] text-current opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          setDismissedStatus(status)
        }}
        type="button"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}
