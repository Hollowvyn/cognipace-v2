import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import type { Tone } from './types'

import { cn } from '@/utils/cn'

const badgeVariants = cva(
  [
    'inline-flex max-w-full items-center gap-1 rounded-[var(--cp-badge-radius)] border',
    'px-[var(--cp-badge-padding-x)] py-[var(--cp-badge-padding-y)]',
    'text-[length:var(--cp-badge-font-size)] font-semibold leading-none',
    'bg-[var(--cp-tone-bg)] text-[color:var(--cp-tone-fg)] border-[color:var(--cp-tone-border)]',
  ],
  {
    variants: {
      variant: {
        subtle: '',
        outline: 'bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'subtle',
    },
  },
)

export interface BadgeProps
  extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {
  tone?: Tone
}

export function Badge({
  className,
  tone = 'neutral',
  variant,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ className, variant }))}
      data-cp-tone={tone}
      {...props}
    />
  )
}
