import { Link, Outlet } from '@tanstack/react-router'
import { Plus } from 'lucide-react'

import {
  DashboardPage,
  DashboardPageBody,
  DashboardPageHeader,
} from '@/app/dashboard/layout/dashboard-page'
import { Button } from '@/components/ui/button'
import { ProblemLibraryScreen } from '@/features/problems'

import {
  dashboardPaths,
  dashboardRouteMeta,
} from '@/app/dashboard/navigation/route-manifest'

export function LibraryPage() {
  return (
    <DashboardPage className="mx-auto w-full max-w-[64rem]">
      <DashboardPageHeader title={dashboardRouteMeta.library.staticData.title}>
        Inspect every tracked problem, review state, and metadata.
      </DashboardPageHeader>
      <DashboardPageBody>
        <ProblemLibraryScreen
          newProblemAction={
            <Button asChild size="sm">
              <Link to={dashboardPaths.problemNew}>
                <Plus aria-hidden="true" />
                New Problem
              </Link>
            </Button>
          }
          renderEditProblemAction={(problem) => (
            <Button asChild size="sm" variant="ghost">
              <Link
                params={{ problemSlug: problem.slug }}
                to={dashboardPaths.problemEdit}
              >
                Edit
              </Link>
            </Button>
          )}
        />
      </DashboardPageBody>
      <Outlet />
    </DashboardPage>
  )
}
