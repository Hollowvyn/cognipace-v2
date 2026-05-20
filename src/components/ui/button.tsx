import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '@/utils/cn'

const buttonVariants = cva(
  [
    'inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap border font-semibold leading-none',
    'rounded-[var(--cp-control-radius)] text-[length:var(--cp-control-font-size)]',
    'transition-[background-color,border-color,color,box-shadow,opacity] duration-[var(--cp-motion-duration-fast)] ease-[var(--cp-motion-ease)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[var(--cp-icon-size)]",
  ],
  {
    variants: {
      variant: {
        primary:
          'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
        secondary:
          'border-secondary bg-secondary text-secondary-foreground hover:bg-secondary/90',
        outline: 'border-border bg-card text-card-foreground hover:bg-muted',
        ghost:
          'border-transparent bg-transparent text-foreground hover:bg-muted',
        destructive:
          'border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        sm: 'h-[var(--cp-control-height-sm)] px-[calc(var(--cp-control-padding-x)*0.75)]',
        md: 'h-[var(--cp-control-height)] px-[var(--cp-control-padding-x)]',
        lg: 'h-[var(--cp-control-height-lg)] px-[calc(var(--cp-control-padding-x)*1.25)]',
        icon: 'size-[var(--cp-icon-button-size)] p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({
  asChild = false,
  className,
  size,
  type = 'button',
  variant,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      className={cn(buttonVariants({ className, size, variant }))}
      {...(!asChild ? { type } : {})}
      {...props}
    />
  )
}
