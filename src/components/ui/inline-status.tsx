import type { ComponentProps } from 'react'

import type { Tone } from './types'

import { cn } from '@/utils/cn'

export interface InlineStatusProps extends ComponentProps<'div'> {
  tone?: Tone
}

export function InlineStatus({
  children,
  className,
  role = 'status',
  tone = 'neutral',
  ...props
}: InlineStatusProps) {
  if (!children) {
    return null
  }

  return (
    <div
      aria-live="polite"
      className={cn(
        'flex min-w-0 items-start gap-2 rounded-[var(--cp-radius-md)] border border-[color:var(--cp-tone-border)] bg-[var(--cp-tone-bg)] px-3 py-2 text-[length:var(--cp-copy-font-size)] leading-snug text-[color:var(--cp-tone-fg)]',
        '[&_svg]:mt-0.5 [&_svg]:size-[var(--cp-icon-size)]',
        className,
      )}
      data-cp-tone={tone}
      role={role}
      {...props}
    >
      {children}
    </div>
  )
}
