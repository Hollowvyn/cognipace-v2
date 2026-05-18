import { Link, Outlet } from '@tanstack/react-router'

import { Badge } from '@/components/ui/badge'

export function DashboardShell() {
  return (
    <main className="cp-surface cp-shell">
      <aside className="cp-dashboard-nav">
        <p className="cp-kicker">CogniPace</p>
        <h1 className="cp-title">Dashboard</h1>
        <nav className="mt-6 flex flex-col gap-2" aria-label="Dashboard">
          <Link
            className="rounded-md px-3 py-2 text-sm font-semibold hover:bg-muted"
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
          <Badge>Foundation</Badge>
        </div>
      </aside>
      <section className="cp-dashboard-main">
        <Outlet />
      </section>
    </main>
  )
}
