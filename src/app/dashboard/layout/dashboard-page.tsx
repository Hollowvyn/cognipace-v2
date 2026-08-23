import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

export function DashboardPage({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-[var(--cp-surface-gap)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function DashboardPageHeader({
  actions,
  children,
  title,
}: {
  actions?: ReactNode
  children?: ReactNode
  title: string
}) {
  return (
    <header className="min-w-0">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="m-0 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
            {title}
          </h2>
          {children ? (
            <div className="mt-2 max-w-2xl text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
              {children}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  )
}

export function DashboardPageBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[var(--cp-surface-gap)]">
      {children}
    </div>
  )
}
