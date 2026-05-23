import { useNavigate, useParams } from '@tanstack/react-router'
import { useState } from 'react'

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
      showCloseButton={false}
      title="Add problem"
      variant="form"
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
  const [title, setTitle] = useState<string>(
    dashboardModalRouteMeta.problemEdit.staticData.title,
  )

  return (
    <RouteModal
      closeTo={dashboardModalRouteMeta.problemEdit.closeTo}
      showCloseButton={false}
      title={title}
      variant="form"
    >
      <ProblemForm
        mode="edit"
        onCancel={closeToLibrary}
        onLoaded={(problem) => setTitle(`Edit: ${problem.title}`)}
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
