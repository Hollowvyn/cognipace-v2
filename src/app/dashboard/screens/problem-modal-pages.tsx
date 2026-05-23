import { useNavigate, useParams } from '@tanstack/react-router'

import { RouteModal } from '@/app/dashboard/layout/route-modal'
import {
  dashboardModalRouteMeta,
  dashboardPaths,
} from '@/app/dashboard/navigation/route-manifest'
import { ProblemForm } from '@/features/problems'

export function NewProblemModalPage() {
  const closeToLibrary = useCloseToLibrary()

  return (
    <RouteModal
      closeTo={dashboardModalRouteMeta.problemNew.closeTo}
      description={dashboardModalRouteMeta.problemNew.description}
      eyebrow="Problem"
      title={dashboardModalRouteMeta.problemNew.staticData.title}
    >
      <ProblemForm
        mode="create"
        onCancel={closeToLibrary}
        onSaved={closeToLibrary}
      />
    </RouteModal>
  )
}

export function EditProblemModalPage() {
  const closeToLibrary = useCloseToLibrary()
  const params = useParams({ from: dashboardPaths.problemEdit })

  return (
    <RouteModal
      closeTo={dashboardModalRouteMeta.problemEdit.closeTo}
      description={dashboardModalRouteMeta.problemEdit.description}
      eyebrow="Problem"
      title={dashboardModalRouteMeta.problemEdit.staticData.title}
    >
      <ProblemForm
        mode="edit"
        onCancel={closeToLibrary}
        onSaved={closeToLibrary}
        problemSlug={params.problemSlug}
      />
    </RouteModal>
  )
}

function useCloseToLibrary() {
  const navigate = useNavigate()

  return () => {
    void navigate({ replace: true, to: dashboardPaths.library })
  }
}
