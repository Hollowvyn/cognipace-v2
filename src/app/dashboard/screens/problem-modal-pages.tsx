import { useNavigate, useParams } from '@tanstack/react-router'
import { useState } from 'react'

import { RouteModal } from '@/app/dashboard/layout/route-modal'
import {
  type DashboardModalClosePath,
  dashboardModalRouteMeta,
  dashboardPaths,
} from '@/app/dashboard/navigation/route-manifest'
import { ProblemForm } from '@/features/problems'

export function NewProblemModalPage() {
  const closeToLibrary = useCloseTo(dashboardPaths.library)

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
  const closeToLibrary = useCloseTo(dashboardPaths.library)
  const params = useParams({ from: dashboardPaths.problemEdit })

  return (
    <ProblemEditModal
      closeTo={dashboardModalRouteMeta.problemEdit.closeTo}
      onClose={closeToLibrary}
      problemSlug={params.problemSlug}
    />
  )
}

export function EditProblemFromTracksModalPage() {
  const closeToTracks = useCloseTo(dashboardPaths.tracks)
  const params = useParams({ from: dashboardPaths.trackProblemEdit })

  return (
    <ProblemEditModal
      closeTo={dashboardModalRouteMeta.trackProblemEdit.closeTo}
      onClose={closeToTracks}
      problemSlug={params.problemSlug}
    />
  )
}

function ProblemEditModal({
  closeTo,
  onClose,
  problemSlug,
}: {
  closeTo: DashboardModalClosePath
  onClose: () => void
  problemSlug: string
}) {
  const [title, setTitle] = useState<string>(
    dashboardModalRouteMeta.problemEdit.staticData.title,
  )

  return (
    <RouteModal
      closeTo={closeTo}
      showCloseButton={false}
      title={title}
      variant="form"
    >
      <ProblemForm
        mode="edit"
        onCancel={onClose}
        onLoaded={(problem) => setTitle(`Edit: ${problem.title}`)}
        onSaved={onClose}
        problemSlug={problemSlug}
      />
    </RouteModal>
  )
}

function useCloseTo(path: DashboardModalClosePath) {
  const navigate = useNavigate()

  return () => {
    void navigate({ replace: true, to: path })
  }
}
