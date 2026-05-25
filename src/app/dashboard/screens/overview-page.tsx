import { Link } from '@tanstack/react-router'
import { BookOpen, Map } from 'lucide-react'

import {
  DashboardPage,
  DashboardPageBody,
  DashboardPageHeader,
} from '@/app/dashboard/layout/dashboard-page'
import {
  dashboardPaths,
  dashboardRouteMeta,
} from '@/app/dashboard/navigation/route-manifest'
import { OverviewScreen } from '@/features/app-shell'

export function OverviewPage() {
  return (
    <DashboardPage className="mx-auto w-full max-w-[64rem]">
      <DashboardPageHeader title={dashboardRouteMeta.overview.staticData.title}>
        What should I practice now?
      </DashboardPageHeader>
      <DashboardPageBody>
        <OverviewScreen
          libraryAction={
            <Link to={dashboardPaths.library}>
              <BookOpen aria-hidden="true" />
              Open Library
            </Link>
          }
          tracksAction={
            <Link to={dashboardPaths.tracks}>
              <Map aria-hidden="true" />
              Open Tracks
            </Link>
          }
        />
      </DashboardPageBody>
    </DashboardPage>
  )
}
