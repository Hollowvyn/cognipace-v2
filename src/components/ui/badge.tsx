import type { ComponentProps } from 'react'

import { cn } from '@/utils/cn'

export function Badge({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}
