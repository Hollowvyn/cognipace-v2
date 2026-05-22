import { Outlet } from '@tanstack/react-router'

import { DashboardPlaceholderPage } from '@/app/dashboard/layout/dashboard-placeholder-page'
import {
  dashboardPaths,
  dashboardRouteMeta,
} from '@/app/dashboard/navigation/route-manifest'

export function TracksPage() {
  return (
    <>
      <DashboardPlaceholderPage
        action={{
          label: 'New Track',
          to: dashboardPaths.trackNew,
        }}
        description="Track catalog, active track, groups, and custom track create/edit flows will land here later."
        panelCopy="This route is ready for future track management without adding catalog data or progression logic yet."
        title={dashboardRouteMeta.tracks.staticData.title}
      />
      <Outlet />
    </>
  )
}
