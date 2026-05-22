import {
  RouterProvider,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { DashboardShell } from './dashboard-shell'
import { OverviewPage } from './overview-page'

import { Surface } from '@/components/ui/surface'

const rootRoute = createRootRoute({
  component: DashboardShell,
})

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: OverviewPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsStubPage,
})

const tracksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tracks',
  component: TracksStubPage,
})

const routeTree = rootRoute.addChildren([
  overviewRoute,
  settingsRoute,
  tracksRoute,
])

export const dashboardRouter = createRouter({
  history: createHashHistory(),
  routeTree,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof dashboardRouter
  }
}

export function DashboardApp() {
  return <RouterProvider router={dashboardRouter} />
}

function SettingsStubPage() {
  return (
    <DashboardStubPage
      detail="Full settings controls land in the dashboard phase. Popup shortcuts already route here."
      label="Settings"
      title="Settings"
    />
  )
}

function TracksStubPage() {
  return (
    <DashboardStubPage
      detail="Track selection and editing land in the dashboard phase. The popup can already open this route."
      label="Tracks"
      title="Tracks"
    />
  )
}

function DashboardStubPage({
  detail,
  label,
  title,
}: {
  detail: string
  label: string
  title: string
}) {
  return (
    <div className="flex flex-col gap-[var(--cp-surface-gap)]">
      <header>
        <p className="m-0 text-[length:var(--cp-kicker-font-size)] font-bold uppercase leading-none text-muted-foreground">
          {label}
        </p>
        <h2 className="mt-1 text-[length:var(--cp-title-font-size)] font-bold leading-tight text-foreground">
          {title}
        </h2>
      </header>
      <Surface>
        <p className="m-0 text-[length:var(--cp-copy-font-size)] leading-relaxed text-muted-foreground">
          {detail}
        </p>
      </Surface>
    </div>
  )
}
