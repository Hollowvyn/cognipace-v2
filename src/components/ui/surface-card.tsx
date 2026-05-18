import type { ComponentProps } from 'react'

import { cn } from '@/utils/cn'

export function SurfaceCard({
  className,
  ...props
}: ComponentProps<'section'>) {
  return <section className={cn('cp-card', className)} {...props} />
}
