import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { MapPlus, Plus } from 'lucide-react'

import {
  DashboardPage,
  DashboardPageBody,
  DashboardPageHeader,
} from '@/app/dashboard/layout/dashboard-page'
import { useDashboardChrome } from '@/app/dashboard/dashboard-shell'
import { Button } from '@/components/ui/button'
import { ProblemLibraryScreen } from '@/features/problems'
import { createLibrarySelectionTrackDraft } from '@/features/tracks'

import {
  dashboardPaths,
  dashboardRouteMeta,
} from '@/app/dashboard/navigation/route-manifest'

export function LibraryPage() {
  const navigate = useNavigate()
  const { headerActions } = useDashboardChrome()

  return (
    <DashboardPage className="mx-auto w-full max-w-[64rem]">
      <DashboardPageHeader
        actions={headerActions}
        title={dashboardRouteMeta.library.staticData.title}
      >
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
          renderSelectedRowsAction={(selectedRows, { disabled }) => (
            <Button
              disabled={disabled}
              onClick={() => {
                const draft = createLibrarySelectionTrackDraft(
                  selectedRows.map((row) => row.problem.slug),
                )

                void navigate({
                  search: { draft: draft.id },
                  to: dashboardPaths.libraryTrackNew,
                })
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <MapPlus aria-hidden="true" />
              Make Track
            </Button>
          )}
        />
      </DashboardPageBody>
      <Outlet />
    </DashboardPage>
  )
}
