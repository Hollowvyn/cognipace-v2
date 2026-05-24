import { Link, Outlet } from '@tanstack/react-router'
import { Pencil, Plus } from 'lucide-react'

import {
  DashboardPage,
  DashboardPageBody,
  DashboardPageHeader,
} from '@/app/dashboard/layout/dashboard-page'
import {
  dashboardPaths,
  dashboardRouteMeta,
} from '@/app/dashboard/navigation/route-manifest'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { TracksScreen } from '@/features/tracks'

export function TracksPage() {
  return (
    <DashboardPage className="mx-auto w-full max-w-[64rem]">
      <DashboardPageHeader title={dashboardRouteMeta.tracks.staticData.title}>
        Manage the active curriculum, groups, and ordered practice path.
      </DashboardPageHeader>
      <DashboardPageBody>
        <TracksScreen
          newTrackAction={
            <Button asChild size="sm">
              <Link to={dashboardPaths.trackNew}>
                <Plus aria-hidden="true" />
                New Track
              </Link>
            </Button>
          }
          renderEditProblemAction={(problem) => (
            <Button asChild size="sm" variant="ghost">
              <Link
                params={{ problemSlug: problem.slug }}
                to={dashboardPaths.trackProblemEdit}
              >
                <Pencil aria-hidden="true" />
                Edit
              </Link>
            </Button>
          )}
          renderEditTrackAction={(track) => (
            <IconButton
              asChild
              label="Edit Track"
              tooltip="Edit Track"
              variant="ghost"
            >
              <Link
                params={{ trackId: track.id }}
                to={dashboardPaths.trackEdit}
              >
                <Pencil aria-hidden="true" />
              </Link>
            </IconButton>
          )}
        />
      </DashboardPageBody>
      <Outlet />
    </DashboardPage>
  )
}
