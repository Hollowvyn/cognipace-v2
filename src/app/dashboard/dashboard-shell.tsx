import { Link, Outlet } from '@tanstack/react-router'

import { Badge } from '@/components/ui/badge'
import { SurfaceRoot } from '@/components/ui/surface'

export function DashboardShell() {
  return (
    <SurfaceRoot className="flex" surface="dashboard">
      <aside className="w-[220px] border-r border-border bg-card p-5">
        <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
          CogniPace
        </p>
        <h1 className="mt-1 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
          Dashboard
        </h1>
        <nav className="mt-6 flex flex-col gap-2" aria-label="Dashboard">
          <Link
            className="rounded-[var(--cp-radius-md)] px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to="/"
          >
            Overview
          </Link>
          <span className="rounded-md px-3 py-2 text-sm text-muted-foreground">
            Tracks
          </span>
          <span className="rounded-md px-3 py-2 text-sm text-muted-foreground">
            Library
          </span>
          <span className="rounded-md px-3 py-2 text-sm text-muted-foreground">
            Analytics
          </span>
          <span className="rounded-md px-3 py-2 text-sm text-muted-foreground">
            Settings
          </span>
        </nav>
        <div className="mt-6">
          <Badge tone="info">Foundation</Badge>
        </div>
      </aside>
      <section className="min-w-0 flex-1 p-[var(--cp-surface-padding)]">
        <Outlet />
      </section>
    </SurfaceRoot>
  )
}
