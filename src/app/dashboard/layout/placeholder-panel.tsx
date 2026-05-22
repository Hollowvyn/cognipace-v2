import type { ReactNode } from 'react'

import { Surface } from '@/components/ui/surface'

export function PlaceholderPanel({
  action,
  children,
  title = 'Coming Next',
}: {
  action?: ReactNode | undefined
  children: ReactNode
  title?: string
}) {
  return (
    <Surface>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="m-0 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
            {title}
          </h3>
          <div className="mt-2 text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
            {children}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </Surface>
  )
}
