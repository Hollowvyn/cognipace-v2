import { Outlet } from '@tanstack/react-router'

import { SurfaceRoot } from '@/components/ui/surface'
import { DashboardNav } from '@/app/dashboard/navigation/dashboard-nav'

export function DashboardShell() {
  function handleSkipToContent() {
    document.getElementById('dashboard-main')?.focus()
  }

  return (
    <SurfaceRoot asChild surface="dashboard">
      <div className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
        <button
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[var(--cp-z-tooltip)] focus:rounded-[var(--cp-radius-md)] focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-overlay"
          onClick={handleSkipToContent}
          type="button"
        >
          Skip to content
        </button>
        <aside className="sticky top-0 z-20 min-w-0 border-b border-border bg-card/95 px-4 py-3 text-card-foreground backdrop-blur lg:h-screen lg:w-[220px] lg:shrink-0 lg:border-b-0 lg:border-r lg:bg-card lg:p-5">
          <div className="flex min-w-0 items-center gap-3 lg:block">
            <div className="flex min-w-0 shrink-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="grid size-7 shrink-0 place-items-center rounded-[var(--cp-radius-md)] bg-primary text-[0.8125rem] font-extrabold leading-none text-primary-foreground"
              >
                C
              </span>
              <h1 className="m-0 hidden truncate text-[1rem] font-extrabold leading-tight text-foreground min-[360px]:block lg:text-[length:var(--cp-title-font-size)]">
                CogniPace
              </h1>
            </div>
            <div className="min-w-0 flex-1 lg:mt-6">
              <DashboardNav />
            </div>
          </div>
        </aside>
        <main
          className="min-w-0 flex-1 p-[var(--cp-surface-padding)]"
          id="dashboard-main"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>
    </SurfaceRoot>
  )
}
