import { Outlet } from '@tanstack/react-router'

import { SurfaceRoot } from '@/components/ui/surface'
import { DashboardNav } from '@/app/dashboard/navigation/dashboard-nav'

export function DashboardShell() {
  return (
    <SurfaceRoot asChild surface="dashboard">
      <div className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
        <a
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[var(--cp-z-tooltip)] focus:rounded-[var(--cp-radius-md)] focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-overlay"
          href="#dashboard-main"
        >
          Skip to content
        </a>
        <aside className="min-w-0 border-b border-border bg-card p-4 lg:sticky lg:top-0 lg:h-screen lg:w-[220px] lg:shrink-0 lg:border-b-0 lg:border-r lg:p-5">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="grid size-7 shrink-0 place-items-center rounded-[var(--cp-radius-md)] bg-primary text-[0.8125rem] font-extrabold leading-none text-primary-foreground"
            >
              C
            </span>
            <h1 className="m-0 truncate text-[length:var(--cp-title-font-size)] font-extrabold leading-tight text-foreground">
              CogniPace
            </h1>
          </div>
          <div className="mt-4 lg:mt-6">
            <DashboardNav />
          </div>
        </aside>
        <main
          className="min-w-0 flex-1 p-[var(--cp-surface-padding)]"
          id="dashboard-main"
        >
          <Outlet />
        </main>
      </div>
    </SurfaceRoot>
  )
}
