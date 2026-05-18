import {
  RouterProvider,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { DashboardShell } from './dashboard-shell'
import { OverviewPage } from './overview-page'

const rootRoute = createRootRoute({
  component: DashboardShell,
})

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: OverviewPage,
})

const routeTree = rootRoute.addChildren([overviewRoute])

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
