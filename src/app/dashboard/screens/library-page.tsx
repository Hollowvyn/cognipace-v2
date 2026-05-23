import { Link, Outlet } from '@tanstack/react-router'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ProblemLibraryScreen } from '@/features/problems'

import { dashboardPaths } from '@/app/dashboard/navigation/route-manifest'

export function LibraryPage() {
  return (
    <>
      <ProblemLibraryScreen
        newProblemAction={
          <Button asChild size="sm">
            <Link to={dashboardPaths.problemNew}>
              <Plus aria-hidden="true" />
              New Problem
            </Link>
          </Button>
        }
      />
      <Outlet />
    </>
  )
}
