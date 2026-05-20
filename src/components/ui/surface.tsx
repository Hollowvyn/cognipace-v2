import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import type { SurfaceName, ThemeMode } from './types'

import { cn } from '@/utils/cn'

export interface SurfaceRootProps extends ComponentProps<'main'> {
  asChild?: boolean
  surface: SurfaceName
  theme?: ThemeMode
}

export function SurfaceRoot({
  asChild = false,
  className,
  surface,
  theme = 'system',
  ...props
}: SurfaceRootProps) {
  const Comp = asChild ? Slot : 'main'

  return (
    <Comp
      className={cn('bg-background text-foreground', className)}
      data-cp-surface={surface}
      data-cp-theme={theme}
      {...props}
    />
  )
}

const surfaceVariants = cva(
  [
    'min-w-0 rounded-[var(--cp-panel-radius)] border border-border text-card-foreground',
    'p-[var(--cp-panel-padding)] shadow-surface',
  ],
  {
    variants: {
      variant: {
        panel: 'bg-card',
        inset: 'bg-muted',
        flat: 'border-transparent bg-transparent p-0 shadow-none',
      },
    },
    defaultVariants: {
      variant: 'panel',
    },
  },
)

export interface SurfaceProps
  extends ComponentProps<'section'>, VariantProps<typeof surfaceVariants> {
  asChild?: boolean
}

export function Surface({
  asChild = false,
  className,
  variant,
  ...props
}: SurfaceProps) {
  const Comp = asChild ? Slot : 'section'

  return (
    <Comp className={cn(surfaceVariants({ className, variant }))} {...props} />
  )
}
