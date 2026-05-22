import type { MouseEvent, ReactNode } from 'react'

import { IconButton } from '@/components/ui/icon-button'
import { cn } from '@/utils/cn'

type OverlayControlButtonProps = {
  children: ReactNode
  className?: string
  disabled?: boolean
  label: string
  onClick?: () => void
  stopClickPropagation?: boolean
  tone?: 'neutral' | 'primary' | 'success' | 'danger'
  tooltip?: string
}

const toneClassName = {
  neutral: 'text-muted-foreground hover:text-foreground',
  primary: 'text-primary hover:text-primary',
  success:
    'text-[color:var(--cp-tone-success-fg)] hover:text-[color:var(--cp-tone-success-fg)]',
  danger: 'text-destructive hover:text-destructive',
} as const

export function OverlayControlButton({
  children,
  className,
  disabled,
  label,
  onClick,
  stopClickPropagation,
  tone = 'neutral',
  tooltip = label,
}: OverlayControlButtonProps) {
  return (
    <IconButton
      className={cn(
        'border-transparent bg-transparent shadow-none hover:bg-muted',
        'disabled:bg-transparent disabled:opacity-35',
        toneClassName[tone],
        className,
      )}
      disabled={disabled}
      label={label}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        if (stopClickPropagation) {
          event.stopPropagation()
        }

        onClick?.()
      }}
      size="icon"
      tooltip={tooltip}
      type="button"
      variant="ghost"
    >
      {children}
    </IconButton>
  )
}
