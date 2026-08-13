import { Link, Outlet } from '@tanstack/react-router'
import { createContext, useContext, useState, type ReactNode } from 'react'

import { dashboardPaths } from '@/app/dashboard/navigation/route-manifest'
import { SurfaceRoot } from '@/components/ui/surface'
import { DashboardNav } from '@/app/dashboard/navigation/dashboard-nav'
import { DashboardHeaderActions } from '@/app/dashboard/components/dashboard-header-actions'
import {
  useCycleThemeMode,
  useSettings,
  type ThemeMode,
} from '@/features/settings'
import { readErrorMessage } from '@/utils/errors'

interface DashboardChromeContextValue {
  headerActions: ReactNode
  themeMode: ThemeMode
}

const DashboardChromeContext =
  createContext<DashboardChromeContextValue | null>(null)

export function useDashboardChrome() {
  const context = useContext(DashboardChromeContext)

  if (!context) {
    throw new Error('useDashboardChrome must be used within DashboardShell.')
  }

  return context
}

export function DashboardShell() {
  const [themeError, setThemeError] = useState<string | null>(null)
  const settings = useSettings()
  const cycleThemeMode = useCycleThemeMode()
  const themeMode = settings.data?.appearance.themeMode ?? 'system'

  function handleSkipToContent() {
    document.getElementById('dashboard-main')?.focus()
  }

  function handleCycleThemeMode() {
    setThemeError(null)

    void cycleThemeMode
      .mutateAsync({ surface: 'dashboard' })
      .catch((error: unknown) => {
        setThemeError(readErrorMessage(error, 'Failed to update theme.'))
      })
  }

  const headerActions = (
    <DashboardHeaderActions
      isThemePending={cycleThemeMode.isPending}
      onCycleThemeMode={handleCycleThemeMode}
      themeMode={themeMode}
    />
  )

  return (
    <DashboardChromeContext.Provider value={{ headerActions, themeMode }}>
      <SurfaceRoot asChild surface="dashboard" theme={themeMode}>
        <div className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
          <button
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[var(--cp-z-tooltip)] focus:rounded-[var(--cp-radius-md)] focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-overlay"
            onClick={handleSkipToContent}
            type="button"
          >
            Skip to content
          </button>
          {themeError ? (
            <p className="sr-only" role="alert">
              {themeError}
            </p>
          ) : null}
          <aside className="sticky top-0 z-20 min-w-0 border-b border-border bg-card/95 px-4 py-3 text-card-foreground backdrop-blur lg:h-screen lg:w-[220px] lg:shrink-0 lg:border-b-0 lg:border-r lg:bg-card lg:p-5">
            <div className="flex min-w-0 items-center gap-3 lg:block">
              <div className="flex min-w-0 shrink-0 items-center gap-2">
                <h1
                  aria-label="CogniPace"
                  className="m-0 text-[1rem] font-extrabold leading-tight text-foreground lg:text-[length:var(--cp-title-font-size)]"
                >
                  <Link
                    aria-label="Open Overview"
                    className="inline-flex min-w-0 items-center gap-2 rounded-[var(--cp-radius-md)] transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    to={dashboardPaths.overview}
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-7 shrink-0 place-items-center rounded-[var(--cp-radius-md)] bg-primary text-[0.8125rem] font-extrabold leading-none text-primary-foreground"
                    >
                      C
                    </span>
                    <span className="hidden truncate min-[360px]:inline">
                      CogniPace
                    </span>
                  </Link>
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
    </DashboardChromeContext.Provider>
  )
}
