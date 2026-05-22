import { Outlet } from '@tanstack/react-router'

import { DashboardPlaceholderPage } from '@/app/dashboard/layout/dashboard-placeholder-page'
import {
  dashboardPaths,
  dashboardRouteMeta,
} from '@/app/dashboard/navigation/route-manifest'

export function LibraryPage() {
  return (
    <>
      <DashboardPlaceholderPage
        action={{
          label: 'New Problem',
          to: dashboardPaths.problemNew,
        }}
        description="The all-problem table, search, filters, and problem create/edit flows will land here later."
        panelCopy="This route is ready for future problem library work without adding table state or data fetching yet."
        title={dashboardRouteMeta.library.staticData.title}
      />
      <Outlet />
    </>
  )
}
